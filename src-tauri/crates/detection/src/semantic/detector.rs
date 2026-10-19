use std::collections::HashSet;
use std::time::{SystemTime, UNIX_EPOCH};

use super::cache::EmbeddingCache;
use super::chunker::Chunker;
use super::embedder::{StubEmbedder, TextEmbedder};
use super::ensemble::EnsembleSearcher;
use super::index::{SearchResult, StubIndex, VectorIndex};
use super::synonyms::SynonymExpander;
use crate::types::{Detection, DetectionSource, VerseRef};

/// Default cache capacity (number of text-chunk entries).
const DEFAULT_CACHE_CAPACITY: usize = 256;

/// Default cosine-similarity threshold below which results are discarded.
/// 0.60 reduces false positives from casual speech while still catching
/// genuine paraphrased scripture. Only strong semantic matches get through.
const DEFAULT_CONFIDENCE_THRESHOLD: f64 = 0.60;

/// When use_synonyms is enabled, single-embed runs first. Ensemble only fires
/// when the top single-embed result is in a "fuzzy" band — clearly weak
/// (< low gate) skips since nothing will save it, and confident (>= high gate)
/// skips since the answer is already strong. Keeps lag manageable.
const ENSEMBLE_FUZZY_LOW: f64 = 0.40;
const ENSEMBLE_FUZZY_HIGH: f64 = 0.65;

/// Orchestrator that combines text chunking, embedding, vector search,
/// and caching to detect Bible verses from transcript text using
/// semantic similarity.
pub struct SemanticDetector {
    embedder: Box<dyn TextEmbedder>,
    index: Box<dyn VectorIndex>,
    #[allow(dead_code)]
    chunker: Chunker,
    cache: EmbeddingCache,
    confidence_threshold: f64,
    #[allow(dead_code)]
    synonym_expander: SynonymExpander,
    ensemble: EnsembleSearcher,
    /// When true, uses ensemble search (3 strategies) for better accuracy.
    /// When false, single direct embedding for speed.
    use_synonyms: bool,
}

impl SemanticDetector {
    /// Create a new detector backed by the given embedder and index.
    pub fn new(embedder: Box<dyn TextEmbedder>, index: Box<dyn VectorIndex>) -> Self {
        Self {
            embedder,
            index,
            chunker: Chunker::new(),
            cache: EmbeddingCache::new(DEFAULT_CACHE_CAPACITY),
            confidence_threshold: DEFAULT_CONFIDENCE_THRESHOLD,
            synonym_expander: SynonymExpander::new(),
            ensemble: EnsembleSearcher::new(),
            use_synonyms: true, // Ensemble (original + synonym + concept) for stronger paraphrase accuracy. Costs ~3 embed calls per chunk.
        }
    }

    /// Create a detector with stub (no-op) implementations.
    ///
    /// The stub detector compiles and runs without model files but
    /// always returns empty results because its index is empty.
    pub fn stub() -> Self {
        Self::new(Box::new(StubEmbedder::new(1024)), Box::new(StubIndex))
    }

    /// Enable or disable synonym expansion (paraphrase detection mode).
    pub fn set_use_synonyms(&mut self, enabled: bool) {
        self.use_synonyms = enabled;
    }

    /// Returns whether synonym expansion is currently enabled.
    pub fn use_synonyms(&self) -> bool {
        self.use_synonyms
    }

    /// Returns `true` when the underlying index contains vectors and
    /// the detector can produce meaningful results.
    pub fn is_ready(&self) -> bool {
        !self.index.is_empty()
    }

    /// Warm inference and all search paths without emitting or merging detections.
    pub fn warm_up(&mut self) -> Result<(), crate::DetectionError> {
        if !self.is_ready() {
            return Ok(());
        }
        let sample =
            "Faith is confidence in what we hope for and assurance about what we do not see";
        let vector = self.embedder.embed(sample)?;
        self.index.search(&vector, 5)?;
        if self.use_synonyms {
            self.ensemble
                .search(sample, self.embedder.as_ref(), self.index.as_ref(), 5)?;
        }
        Ok(())
    }

    /// Detect Bible verses in `text` using semantic similarity.
    ///
    /// The text is split into overlapping sentence windows, each window
    /// is embedded, and the nearest verses in the vector index are
    /// returned if they exceed the confidence threshold.
    ///
    /// The returned `Detection` objects have placeholder `VerseRef`
    /// fields (all zeros / empty) — the caller is expected to resolve
    /// them using the `verse_id` from the underlying `SearchResult`.
    pub fn detect(&mut self, text: &str) -> Vec<Detection> {
        if !self.is_ready() {
            return vec![];
        }

        let mut detections = Vec::new();

        let Ok(single_results) = self.original_results(text).inspect_err(|e| {
            log::warn!("Semantic search failed: {e}");
        }) else {
            return vec![];
        };

        let top_single_similarity = single_results.first().map(|r| r.similarity).unwrap_or(0.0);

        let now = Self::timestamp_ms();

        // If the single-embed top result is already confident, skip ensemble.
        // This keeps clear quotes fast while still letting fuzzier phrases
        // benefit from synonym/concept search.
        let needs_ensemble = self.use_synonyms
            && top_single_similarity >= ENSEMBLE_FUZZY_LOW
            && top_single_similarity < ENSEMBLE_FUZZY_HIGH;

        if needs_ensemble {
            match self.ensemble.search_with_original(
                text,
                self.embedder.as_ref(),
                self.index.as_ref(),
                5,
                &single_results
                    .iter()
                    .map(|r| (r.verse_id, r.similarity))
                    .collect::<Vec<_>>(),
            ) {
                Ok(results) => {
                    for result in results {
                        if result.best_similarity >= self.confidence_threshold {
                            detections.push(Self::make_detection(
                                result.verse_id,
                                result.best_similarity,
                                text,
                                now,
                            ));
                        }
                    }
                }
                Err(e) => {
                    log::warn!("[SEMANTIC] Ensemble search failed: {e}");
                }
            }
        } else {
            let mut seen_verse_ids = HashSet::new();
            for result in &single_results {
                if result.similarity >= self.confidence_threshold
                    && seen_verse_ids.insert(result.verse_id)
                {
                    detections.push(Self::make_detection(
                        result.verse_id,
                        result.similarity,
                        text,
                        now,
                    ));
                }
            }
        }

        // Cap results: sort by confidence, keep top 5
        detections.sort_by(|a, b| {
            b.confidence
                .partial_cmp(&a.confidence)
                .unwrap_or(std::cmp::Ordering::Equal)
        });
        detections.truncate(5);

        detections
    }

    /// Update the minimum similarity threshold for a result to be
    /// included in the output.
    pub fn set_confidence_threshold(&mut self, threshold: f64) {
        self.confidence_threshold = threshold;
    }

    /// Direct query -> results for manual semantic search.
    /// Unlike `detect()`, this does NOT chunk the text or apply cooldown.
    pub fn search_query(&mut self, query: &str, k: usize) -> Vec<(i64, f64)> {
        if !self.is_ready() {
            return vec![];
        }
        let Ok(embedding) = self.embedder.embed(query) else {
            return vec![];
        };
        match self.index.search(&embedding, k) {
            Ok(results) => results.iter().map(|r| (r.verse_id, r.similarity)).collect(),
            Err(_) => vec![],
        }
    }

    // Cache only raw matches so threshold and ensemble settings still apply on each call.
    fn original_results(&mut self, text: &str) -> Result<Vec<SearchResult>, crate::DetectionError> {
        if let Some((_, results)) = self.cache.get(text) {
            return Ok(results.clone());
        }
        let embedding = self.embedder.embed(text)?;
        let results = self.index.search(&embedding, 5)?;
        self.cache
            .insert(text.to_string(), (embedding, results.clone()));
        Ok(results)
    }

    // ---- private helpers ----

    #[expect(
        clippy::cast_possible_truncation,
        reason = "timestamp millis won't exceed u64 for centuries"
    )]
    fn timestamp_ms() -> u64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64
    }

    fn make_detection(
        verse_id: i64,
        similarity: f64,
        snippet: &str,
        detected_at: u64,
    ) -> Detection {
        Detection {
            verse_ref: VerseRef {
                book_number: 0,
                book_name: String::new(),
                chapter: 0,
                verse_start: 0,
                verse_end: None,
            },
            verse_id: Some(verse_id),
            confidence: similarity,
            source: DetectionSource::SemanticLocal { similarity },
            transcript_snippet: snippet.to_string(),
            detected_at,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::semantic::index::SearchResult;
    use crate::DetectionError;

    /// A fake index that always returns a fixed set of results.
    struct FakeIndex {
        results: Vec<SearchResult>,
    }

    impl VectorIndex for FakeIndex {
        fn search(&self, _query: &[f32], k: usize) -> Result<Vec<SearchResult>, DetectionError> {
            Ok(self.results.iter().take(k).cloned().collect())
        }

        fn len(&self) -> usize {
            self.results.len()
        }
    }

    use std::sync::{Arc, Mutex};

    type EmbedCalls = Arc<Mutex<Vec<String>>>;
    type SearchCalls = Arc<Mutex<usize>>;

    struct CountedEmbedder(EmbedCalls);

    impl TextEmbedder for CountedEmbedder {
        fn embed(&self, text: &str) -> Result<Vec<f32>, DetectionError> {
            self.0.lock().unwrap().push(text.to_string());
            Ok(vec![1.0])
        }

        fn dimension(&self) -> usize {
            1
        }
    }

    struct CountedIndex {
        calls: SearchCalls,
        similarity: f64,
        fail_first: bool,
    }

    impl VectorIndex for CountedIndex {
        fn search(&self, _query: &[f32], _k: usize) -> Result<Vec<SearchResult>, DetectionError> {
            let mut calls = self.calls.lock().unwrap();
            *calls += 1;
            if self.fail_first && *calls == 1 {
                return Err(DetectionError::Internal("temporary search failure".into()));
            }
            Ok(vec![SearchResult {
                verse_id: 42,
                similarity: self.similarity,
            }])
        }

        fn len(&self) -> usize {
            1
        }
    }

    fn counted_detector(
        similarity: f64,
        fail_first: bool,
    ) -> (SemanticDetector, EmbedCalls, SearchCalls) {
        let embeds = Arc::new(Mutex::new(Vec::new()));
        let searches = Arc::new(Mutex::new(0));
        let detector = SemanticDetector::new(
            Box::new(CountedEmbedder(embeds.clone())),
            Box::new(CountedIndex {
                calls: searches.clone(),
                similarity,
                fail_first,
            }),
        );
        (detector, embeds, searches)
    }

    #[test]
    fn repeated_detection_reuses_search_but_applies_current_threshold() {
        let (mut detector, embeds, searches) = counted_detector(0.85, false);
        assert_eq!(detector.detect("a clear quote")[0].verse_id, Some(42));
        detector.set_confidence_threshold(0.9);
        assert!(detector.detect("a clear quote").is_empty());
        detector.set_confidence_threshold(0.8);
        assert!((detector.detect("a clear quote")[0].confidence - 0.85).abs() < 1e-12);
        assert_eq!(embeds.lock().unwrap().len(), 1);
        assert_eq!(*searches.lock().unwrap(), 1);
    }

    #[test]
    fn fuzzy_detection_searches_original_only_once_and_reuses_variants() {
        let text = "faith and love bring hope";
        let (mut detector, embeds, searches) = counted_detector(0.64, false);
        assert_eq!(detector.detect(text)[0].verse_id, Some(42));
        let first_calls = embeds.lock().unwrap().clone();
        assert!(
            first_calls.len() > 1,
            "synonym and concept searches must still run"
        );
        assert_eq!(first_calls.iter().filter(|query| *query == text).count(), 1);
        detector.set_use_synonyms(false);
        assert!((detector.detect(text)[0].confidence - 0.64).abs() < 1e-12);
        detector.set_use_synonyms(true);
        assert!((detector.detect(text)[0].confidence - 0.64).abs() < 1e-12);
        assert_eq!(embeds.lock().unwrap().len(), first_calls.len());
        assert_eq!(*searches.lock().unwrap(), first_calls.len());
    }

    #[test]
    fn repeated_negative_speech_reuses_search() {
        let (mut detector, embeds, searches) = counted_detector(0.2, false);
        assert!(detector.detect("please take your seats").is_empty());
        assert!(detector.detect("please take your seats").is_empty());
        assert_eq!(embeds.lock().unwrap().len(), 1);
        assert_eq!(*searches.lock().unwrap(), 1);
    }

    #[test]
    fn evicted_speech_is_searched_again() {
        let (mut detector, embeds, searches) = counted_detector(0.85, false);
        detector.cache = EmbeddingCache::new(2);
        for text in ["first quote", "second quote", "third quote", "first quote"] {
            assert_eq!(detector.detect(text)[0].verse_id, Some(42));
        }
        assert_eq!(embeds.lock().unwrap().len(), 4);
        assert_eq!(*searches.lock().unwrap(), 4);
    }

    #[test]
    fn failed_search_is_retried_instead_of_cached() {
        let (mut detector, _, searches) = counted_detector(0.85, true);
        assert!(detector.detect("a clear quote").is_empty());
        assert_eq!(detector.detect("a clear quote")[0].verse_id, Some(42));
        assert_eq!(*searches.lock().unwrap(), 2);
    }

    #[test]
    fn test_stub_returns_empty() {
        let mut detector = SemanticDetector::stub();
        let results = detector.detect("for God so loved the world");
        assert!(results.is_empty());
    }

    #[test]
    fn test_stub_is_not_ready() {
        let detector = SemanticDetector::stub();
        assert!(!detector.is_ready());
    }

    #[test]
    fn test_detection_with_fake_index() {
        let fake_results = vec![
            SearchResult {
                verse_id: 1001,
                similarity: 0.85,
            },
            SearchResult {
                verse_id: 1002,
                similarity: 0.20,
            },
        ];

        let mut detector = SemanticDetector::new(
            Box::new(StubEmbedder::new(128)),
            Box::new(FakeIndex {
                results: fake_results,
            }),
        );

        assert!(detector.is_ready());

        let detections =
            detector.detect("for God so loved the world that he gave his only begotten son");

        // Should include the high-similarity result but not the 0.20 one
        assert!(!detections.is_empty());
        for d in &detections {
            assert!(d.confidence >= 0.35);
            assert!(matches!(d.source, DetectionSource::SemanticLocal { .. }));
        }
    }

    #[test]
    fn test_threshold_adjustment() {
        let fake_results = vec![SearchResult {
            verse_id: 1001,
            similarity: 0.60,
        }];

        let mut detector = SemanticDetector::new(
            Box::new(StubEmbedder::new(128)),
            Box::new(FakeIndex {
                results: fake_results,
            }),
        );

        // Default threshold is 0.50 — should include 0.60
        let detections = detector.detect("for God so loved the world that he gave his son");
        assert!(!detections.is_empty());

        // Raise threshold above the result's similarity
        detector.set_confidence_threshold(0.70);
        let detections =
            detector.detect("whoever believes in him shall not perish but have everlasting life");
        assert!(detections.is_empty());
    }
}
