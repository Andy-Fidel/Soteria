//! Local startup benchmark. No microphone or provider requests are made.
use rhema_bible::BibleDb;
use rhema_detection::semantic::embedder::TextEmbedder;
use rhema_detection::{HnswVectorIndex, OnnxEmbedder, QuotationMatcher, SemanticDetector};
use serde::Deserialize;
use std::{
    collections::hash_map::DefaultHasher,
    hash::{Hash, Hasher},
    path::Path,
    time::Instant,
};
#[path = "../../../src/semantic_resources.rs"]
mod semantic_resources;

#[derive(Deserialize)]
struct Case {
    text: String,
}

fn fingerprint(rows: impl Iterator<Item = (i64, i32, i32, i32)>) -> u64 {
    rows.fold(0_u64, |sum, row| {
        let mut hash = DefaultHasher::new();
        row.hash(&mut hash);
        sum.wrapping_add(hash.finish())
    })
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../..");
    let temp = tempfile::tempdir()?;
    let database = temp.path().join("bible.db");
    std::fs::copy(root.join("data/rhema.db"), &database)?;
    let start = Instant::now();
    let db = BibleDb::open(&database)?;
    if std::env::args().any(|arg| arg == "metadata") {
        let load = Instant::now();
        let rows = db.load_verse_locations("en")?;
        let load_ms = load.elapsed().as_secs_f64() * 1000.0;
        let digest = fingerprint(
            rows.iter()
                .map(|v| (v.id, v.book_number, v.chapter, v.verse)),
        );
        println!(
            "{}",
            serde_json::json!({"rows":rows.len(), "digest":digest, "load_ms":load_ms})
        );
        std::hint::black_box(&rows);
        return Ok(());
    }
    let load = Instant::now();
    let verses = db.load_all_verses_for_quotation(Some("en"))?;
    let quotation_load_ms = load.elapsed().as_secs_f64() * 1000.0;
    let build = Instant::now();
    let quotation = QuotationMatcher::build(verses);
    let quotation_build_ms = build.elapsed().as_secs_f64() * 1000.0;
    let model_path = root.join("models/all-MiniLM-L6-v2/onnx/model.onnx");
    let tokenizer_path = root.join("models/all-MiniLM-L6-v2/tokenizer.json");
    let load = Instant::now();
    let embedder = OnnxEmbedder::load(&model_path, &tokenizer_path)?;
    embedder.embed("Find the Bible verse about faith and hope")?;
    let model_load_ms = load.elapsed().as_secs_f64() * 1000.0;
    let base = HnswVectorIndex::load(
        &root.join("embeddings/kjv-minilm-l6-v2.bin"),
        &root.join("embeddings/kjv-minilm-l6-v2-ids.bin"),
        embedder.dimension(),
    )?;
    let load = Instant::now();
    let index = semantic_resources::add_translations(
        base,
        Some(&db),
        &model_path,
        &tokenizer_path,
        "kjv-minilm-l6-v2",
        embedder.dimension(),
        |path| root.join(path),
    );
    let translations_ms = load.elapsed().as_secs_f64() * 1000.0;
    let vectors = index.len();
    if vectors < 90000 {
        return Err("NIV/NLT indexes did not load".into());
    }
    let mut detector = SemanticDetector::new(Box::new(embedder), index);
    detector.set_confidence_threshold(
        rhema_detection::semantic::multi_translation::CONFIDENCE_THRESHOLD,
    );
    detector.warm_up()?;
    let ready_ms = start.elapsed().as_secs_f64() * 1000.0;
    let cases: Vec<Case> = serde_json::from_str(&std::fs::read_to_string(
        root.join("data/semantic-evaluation.json"),
    )?)?;
    let mut results = Vec::new();
    for case in cases {
        let hits: Vec<_> = detector
            .detect(&case.text)
            .iter()
            .map(|d| serde_json::json!({"id":d.verse_id,"confidence":d.confidence}))
            .collect();
        results.push(serde_json::json!({"text":case.text,"hits":hits}));
    }
    std::hint::black_box(&quotation);
    println!(
        "{}",
        serde_json::json!({"quotation_load_ms":quotation_load_ms,"quotation_build_ms":quotation_build_ms,
        "model_load_ms":model_load_ms,"translations_ms":translations_ms,"ready_ms":ready_ms,"vectors":vectors,"results":results})
    );
    Ok(())
}
