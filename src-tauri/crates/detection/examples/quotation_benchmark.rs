//! Measure quotation-index startup and matching with the installed Bible database.
//! Run from the repository root; no model, microphone, or API access is needed.
use rhema_bible::BibleDb;
use rhema_detection::QuotationMatcher;
use serde::Deserialize;
use std::{path::Path, time::Instant};

#[derive(Deserialize)]
struct Case {
    text: String,
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../..");
    // BibleDb enables WAL. Benchmark a copy to preserve the installed database.
    let temporary = tempfile::tempdir()?;
    let database = temporary.path().join("bible.db");
    std::fs::copy(root.join("data/rhema.db"), &database)?;
    let start = Instant::now();
    let db = BibleDb::open(&database)?;
    let verses = db.load_all_verses_for_quotation(Some("en"))?;
    let load_ms = start.elapsed().as_secs_f64() * 1000.0;
    let verse_count = verses.len();
    let mut cases: Vec<Case> = serde_json::from_str(&std::fs::read_to_string(
        root.join("data/semantic-evaluation.json"),
    )?)?;
    // Add exact quotations sampled across the entire installed English corpus.
    for verse in verses.iter().step_by((verse_count / 30).max(1)).take(30) {
        cases.push(Case {
            text: verse.text.clone(),
        });
    }
    let build = Instant::now();
    let matcher = QuotationMatcher::build(verses);
    let build_ms = build.elapsed().as_secs_f64() * 1000.0;
    let ready_ms = start.elapsed().as_secs_f64() * 1000.0;
    let mut results = Vec::new();
    for case in &cases {
        let begin = Instant::now();
        let found = matcher.match_transcript(&case.text);
        let ms = begin.elapsed().as_secs_f64() * 1000.0;
        let hits: Vec<_> = found
            .iter()
            .map(|d| {
                serde_json::json!({
                    "id": d.verse_id,
                    "reference": d.verse_ref,
                    "confidence": d.confidence,
                    "source": d.source,
                })
            })
            .collect();
        results.push(serde_json::json!({"text": case.text, "ms": ms, "hits": hits}));
    }
    println!(
        "{}",
        serde_json::json!({
            "input_verses": verse_count, "load_ms": load_ms,
            "build_ms": build_ms, "ready_ms": ready_ms, "results": results,
        })
    );
    Ok(())
}
