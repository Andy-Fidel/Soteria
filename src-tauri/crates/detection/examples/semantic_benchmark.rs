//! Reproducible real-model detection benchmark; run from repository root.
use rhema_bible::BibleDb;
use rhema_detection::semantic::embedder::TextEmbedder;
use rhema_detection::{HnswVectorIndex, OnnxEmbedder, SemanticDetector};
use serde::Deserialize;
use std::{path::Path, time::Instant};
#[path = "../../../src/semantic_resources.rs"]
mod semantic_resources;
use rhema_detection::semantic::index::VectorIndex;

#[derive(Deserialize)]
struct Case {
    text: String,
    expected: Option<String>,
    category: String,
    split: String,
}
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../..");
    let args: Vec<String> = std::env::args().collect();
    let cases: Vec<Case> = serde_json::from_str(&std::fs::read_to_string(
        root.join("data/semantic-evaluation.json"),
    )?)?;
    // BibleDb enables WAL; use a copy so profiling never changes source journals.
    let temporary = tempfile::tempdir()?;
    let database = temporary.path().join("bible.db");
    std::fs::copy(root.join("data/rhema.db"), &database)?;
    let start = Instant::now();
    let embedder = OnnxEmbedder::load(
        &root.join("models/all-MiniLM-L6-v2/onnx/model.onnx"),
        &root.join("models/all-MiniLM-L6-v2/tokenizer.json"),
    )?;
    embedder.embed("God loved the world")?;
    let index = HnswVectorIndex::load(
        &root.join("embeddings/kjv-minilm-l6-v2.bin"),
        &root.join("embeddings/kjv-minilm-l6-v2-ids.bin"),
        embedder.dimension(),
    )?;
    let db = BibleDb::open(&database)?;
    let is_multi = args.get(1).is_some_and(|mode| mode == "multi");
    let index: Box<dyn VectorIndex> = if is_multi {
        semantic_resources::add_translations(
            index,
            Some(&db),
            &root.join("models/all-MiniLM-L6-v2/onnx/model.onnx"),
            &root.join("models/all-MiniLM-L6-v2/tokenizer.json"),
            "kjv-minilm-l6-v2",
            embedder.dimension(),
            |rel| root.join(rel),
        )
    } else {
        Box::new(index)
    };
    let vectors = index.len();
    if is_multi && vectors < 90000 {
        return Err("NIV/NLT indexes were not loaded".into());
    }
    // Validate against actual runtime inference, not only manifest labels.
    let mut parity = Vec::new();
    for translation in if is_multi && args.iter().any(|arg| arg == "--verify") {
        vec!["niv", "nlt"]
    } else {
        vec![]
    } {
        let base = root.join(format!(
            "embeddings/translation-indexes/kjv-minilm-l6-v2-{translation}"
        ));
        let extra = HnswVectorIndex::load(
            &base.with_extension("bin"),
            &base.with_file_name(format!("kjv-minilm-l6-v2-{translation}-ids.bin")),
            embedder.dimension(),
        )?;
        for position in [0, extra.verse_ids().len() / 2, extra.verse_ids().len() - 1] {
            let id = extra.verse_ids()[position];
            let verse = db
                .get_verse_by_id(id)?
                .ok_or("Index references a missing verse")?;
            let vector = embedder.embed(&verse.text)?;
            let score = extra
                .search(&vector, extra.len())?
                .iter()
                .find(|hit| hit.verse_id == id)
                .ok_or("Missing parity hit")?
                .similarity;
            if score < 0.999 {
                return Err(format!(
                    "Runtime/index mismatch: {translation} id={id} similarity={score}"
                )
                .into());
            }
            parity.push(serde_json::json!({"translation":translation,"id":id,"similarity":score}));
        }
    }
    let mut detector = SemanticDetector::new(Box::new(embedder), index);
    if is_multi {
        detector.set_confidence_threshold(
            rhema_detection::semantic::multi_translation::CONFIDENCE_THRESHOLD,
        );
    }
    let load_ms = start.elapsed().as_secs_f64() * 1000.0;
    let cold = Instant::now();
    detector.detect("God loved the world and gave his only Son");
    let cold_ms = cold.elapsed().as_secs_f64() * 1000.0;
    let mut results = Vec::new();
    for round in 0..3 {
        for case in &cases {
            let now = Instant::now();
            let found = detector.detect(&case.text);
            let ms = now.elapsed().as_secs_f64() * 1000.0;
            let hits: Vec<_> = found.iter().filter_map(|d| {
                let v = db.get_verse_by_id(d.verse_id?).ok()??;
                Some(serde_json::json!({"reference":format!("{} {}:{}",v.book_name,v.chapter,v.verse),"score":d.confidence}))
            }).collect();
            results.push(serde_json::json!({"round":round,"text":case.text,"category":case.category,"split":case.split,"expected":case.expected,"ms":ms,"hits":hits}));
        }
    }
    println!(
        "{}",
        serde_json::json!({"mode":args.get(1).map_or("baseline",String::as_str),"parity":parity,"vectors":vectors,"load_ms":load_ms,"cold_query_ms":cold_ms,"results":results})
    );
    Ok(())
}
