//! Opt-in verification in internal installers, using the actual initialized app.
//! No microphone, provider calls, session writes, or external inputs are used.
use crate::{commands, state::AppState};
use serde_json::{json, Value};
use std::{sync::Mutex, time::Instant};
use tauri::Manager;

pub async fn verify(app: &tauri::App) -> Result<Value, String> {
    let started = Instant::now();
    let resources = app.path().resource_dir().map_err(|e| e.to_string())?;
    let manifest: Value = serde_json::from_slice(
        &std::fs::read(resources.join("standard-package.json")).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;
    let speech = if manifest.get("speech").is_some() {
        Some(verify_speech(app).await?)
    } else {
        None
    };
    for relative in manifest["files"]
        .as_object()
        .ok_or("Missing resource list")?
        .keys()
    {
        let resolved = crate::resolve_resource(app, relative);
        if resolved != resources.join(relative) || !resolved.is_file() {
            return Err(format!(
                "Resource is missing or outside the bundle: {relative}"
            ));
        }
    }
    let status = commands::detection::detection_status(app.state()).await?;
    if !status.has_semantic || status.has_cloud {
        return Err("Local semantic detection must be ready without a cloud provider".into());
    }
    let translations = commands::bible::list_translations(app.state())?;
    let mut results = Vec::new();
    for abbreviation in ["KJV", "NIV", "NLT"] {
        let translation = translations
            .iter()
            .find(|item| item.abbreviation == abbreviation)
            .ok_or_else(|| format!("Missing translation: {abbreviation}"))?;
        commands::bible::set_active_translation(app.state(), translation.id)?;
        let expected = commands::bible::get_verse(app.state(), translation.id, 43, 3, 16)?
            .ok_or("John 3:16 is missing")?;

        let direct = commands::detection::detect_verses(app.state(), "John 3:16".into()).await?;
        if !direct.iter().any(|hit| {
            hit.source == "direct"
                && hit.book_number == 43
                && hit.chapter == 3
                && hit.verse == 16
                && hit.verse_text == expected.text
        }) {
            return Err(format!(
                "Direct reference/translation failed: {abbreviation}"
            ));
        }
        let quote =
            commands::detection::quotation_search(app.state(), expected.text.clone(), Some(5))?;
        if !quote.iter().any(|hit| {
            hit.book_number == 43
                && hit.chapter == 3
                && hit.verse == 16
                && hit.verse_text == expected.text
        }) {
            return Err(format!("Quotation/translation failed: {abbreviation}"));
        }
        let mut paraphrases = Vec::new();
        for (text, book, chapter, verse) in [
            ("God loved everyone so much that he sent his only Son so believers could live forever", 43, 3, 16),
            ("Do not worry about tomorrow because tomorrow will bring its own troubles", 40, 6, 34),
            ("God is working everything together for the good of those who love him", 45, 8, 28),
        ] {
            let query_started = Instant::now();
            let hits = commands::detection::semantic_search(app.state(), text.into(), Some(3)).await?;
            if !hits.iter().any(|hit| hit.book_number == book && hit.chapter == chapter && hit.verse == verse) {
                return Err(format!("Paraphrase failed for {abbreviation}: {text}"));
            }
            let expected_text = commands::bible::get_verse(app.state(), translation.id, book, chapter, verse)?
                .ok_or("Expected translated verse missing")?.text;
            if !hits.iter().any(|hit| hit.book_number == book && hit.chapter == chapter && hit.verse == verse && hit.verse_text == expected_text) {
                return Err(format!("Semantic result uses wrong translation: {abbreviation}"));
            }
            let detections = commands::detection::detect_verses(app.state(), text.into()).await?;
            if !detections.iter().any(|hit| hit.source == "semantic_local" && hit.book_number == book && hit.chapter == chapter && hit.verse == verse && hit.verse_text == expected_text) {
                return Err(format!("Paraphrase was not accepted by the detection pipeline: {abbreviation}: {text}"));
            }
            paraphrases.push(json!({"query":text,"elapsed_ms":query_started.elapsed().as_secs_f64()*1000.0,"hits":hits,"detections":detections}));
        }
        results.push(json!({"translation":abbreviation,"direct":direct,"quotation":quote,"paraphrases":paraphrases}));
    }
    let app_state = app.state::<Mutex<AppState>>();
    let state = app_state.lock().map_err(|e| e.to_string())?;
    let negatives = state
        .detection_pipeline
        .lock()
        .map_err(|e| e.to_string())?
        .process_semantic("The church car park will be closed for maintenance next Tuesday");
    if !negatives.is_empty() {
        return Err("Unrelated speech produced a semantic detection".into());
    }
    Ok(
        json!({"passed":true,"resources":resources,"executable":std::env::current_exe().map_err(|e|e.to_string())?,"flavor":crate::FLAVOR,"manifest":manifest,"speech":speech,"default_speech_provider":commands::stt::local::get_default_stt_provider(),"results":results,"elapsed_ms":started.elapsed().as_secs_f64()*1000.0}),
    )
}

async fn verify_speech(app: &tauri::App) -> Result<Value, String> {
    let readiness = commands::stt::local::prepare_local_speech(app.handle().clone()).await?;
    #[cfg(feature = "whisper")]
    {
        use rhema_stt::{SttProvider, TranscriptEvent, WhisperProvider};
        let args: Vec<_> = std::env::args().collect();
        let Some(index) = args.iter().position(|arg| arg == "--verify-whisper-audio") else {
            return Ok(json!({"ready":true,"detail":readiness}));
        };
        let input = args.get(index + 1).ok_or("Missing test audio path")?;
        let bytes = std::fs::read(input).map_err(|e| e.to_string())?;
        if bytes.len() % 2 != 0 || bytes.len() > 960_000 || bytes.len() < 32_000 {
            return Err("Test audio must be 1–30 seconds of 16 kHz mono i16 PCM".into());
        }
        let samples: Vec<_> = bytes
            .chunks_exact(2)
            .map(|b| i16::from_le_bytes([b[0], b[1]]))
            .collect();
        let (send, receive) = crossbeam_channel::unbounded();
        for chunk in samples.chunks(1024) {
            send.send(chunk.to_vec()).map_err(|e| e.to_string())?;
        }
        drop(send);
        let (events, mut receive_events) = tokio::sync::mpsc::channel(256);
        let model = commands::stt::local::model_path(app.handle())?;
        let provider = WhisperProvider::new(model.clone(), Some("en".into()), 4);
        tokio::time::timeout(
            std::time::Duration::from_secs(90),
            provider.start(receive, events),
        )
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())?;
        let mut transcript = String::new();
        let mut connected = false;
        while let Ok(event) = receive_events.try_recv() {
            match event {
                TranscriptEvent::Connected => connected = true,
                TranscriptEvent::Final {
                    transcript: text, ..
                } => {
                    transcript.push_str(&text);
                    transcript.push(' ');
                }
                TranscriptEvent::Error(error) => return Err(error),
                _ => {}
            }
        }
        if !connected || transcript.trim().is_empty() {
            return Err("Offline speech did not produce a transcript".into());
        }
        let detections =
            commands::detection::detect_verses(app.state(), transcript.clone()).await?;
        if !detections.iter().any(|hit| {
            hit.source == "direct" && hit.book_number == 43 && hit.chapter == 3 && hit.verse == 16
        }) {
            return Err(format!(
                "Offline speech-to-scripture check failed: {transcript}"
            ));
        }
        Ok(
            json!({"ready":true,"model":model,"transcript":transcript.trim(),"detections":detections,"provider_calls":false}),
        )
    }
    #[cfg(not(feature = "whisper"))]
    {
        let _ = readiness;
        Err("Whisper was not compiled into the speech package".into())
    }
}
