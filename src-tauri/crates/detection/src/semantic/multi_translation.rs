//! Search alternate wordings without letting translations crowd out unique scriptures.
use super::index::{SearchResult, VectorIndex};
use crate::DetectionError;
use std::collections::HashMap;

/// More alternate wordings increase weak matches; use a stricter live-detection gate.
pub const CONFIDENCE_THRESHOLD: f64 = 0.65;

pub struct MultiTranslationIndex {
    indexes: Vec<Box<dyn VectorIndex>>,
    canonical_ids: HashMap<i64, i64>,
}

impl MultiTranslationIndex {
    /// IDs without a canonical mapping are excluded, never guessed from row order.
    pub fn new(indexes: Vec<Box<dyn VectorIndex>>, canonical_ids: HashMap<i64, i64>) -> Self {
        Self {
            indexes,
            canonical_ids,
        }
    }
}

impl VectorIndex for MultiTranslationIndex {
    fn search(&self, query: &[f32], k: usize) -> Result<Vec<SearchResult>, DetectionError> {
        if k == 0 {
            return Ok(vec![]);
        }
        let mut best: HashMap<i64, f64> = HashMap::new();
        for index in &self.indexes {
            let mut requested = k.min(index.len());
            let hits = loop {
                let hits = index.search(query, requested)?;
                let aligned = hits
                    .iter()
                    .filter(|hit| {
                        hit.similarity.is_finite() && self.canonical_ids.contains_key(&hit.verse_id)
                    })
                    .count();
                if aligned >= k || requested >= index.len() || hits.len() < requested {
                    break hits;
                }
                // Rare versification gaps must not consume valid candidate slots.
                requested = requested.saturating_add(k - aligned).min(index.len());
            };
            for hit in hits {
                if !hit.similarity.is_finite() {
                    continue;
                }
                if let Some(&canonical) = self.canonical_ids.get(&hit.verse_id) {
                    best.entry(canonical)
                        .and_modify(|score| *score = score.max(hit.similarity))
                        .or_insert(hit.similarity);
                }
            }
        }
        let mut hits: Vec<_> = best
            .into_iter()
            .map(|(verse_id, similarity)| SearchResult {
                verse_id,
                similarity,
            })
            .collect();
        hits.sort_by(|a, b| {
            b.similarity
                .total_cmp(&a.similarity)
                .then(a.verse_id.cmp(&b.verse_id))
        });
        hits.truncate(k);
        Ok(hits)
    }
    fn len(&self) -> usize {
        self.indexes.iter().map(|index| index.len()).sum()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    struct Fixed(Vec<SearchResult>);
    impl VectorIndex for Fixed {
        fn search(&self, _: &[f32], k: usize) -> Result<Vec<SearchResult>, DetectionError> {
            Ok(self.0.iter().take(k).cloned().collect())
        }
        fn len(&self) -> usize {
            self.0.len()
        }
    }
    fn hit(id: i64, score: f64) -> SearchResult {
        SearchResult {
            verse_id: id,
            similarity: score,
        }
    }
    #[test]
    fn alternate_translations_share_one_slot_and_do_not_add_confidence() {
        let index = MultiTranslationIndex::new(
            vec![
                Box::new(Fixed(vec![hit(1, 0.7), hit(2, 0.6)])),
                Box::new(Fixed(vec![hit(11, 0.9), hit(12, 0.8)])),
                Box::new(Fixed(vec![hit(21, 0.85), hit(22, 0.75)])),
            ],
            HashMap::from([(1, 1), (2, 2), (11, 1), (12, 2), (21, 1), (22, 2)]),
        );
        assert_eq!(
            index.search(&[1.0], 2).unwrap(),
            vec![hit(1, 0.9), hit(2, 0.8)]
        );
    }
    #[test]
    fn unmapped_and_nonfinite_hits_are_excluded() {
        let index = MultiTranslationIndex::new(
            vec![Box::new(Fixed(vec![
                hit(1, f64::NAN),
                hit(2, 0.9),
                hit(3, 0.7),
            ]))],
            HashMap::from([(1, 1), (3, 3)]),
        );
        assert_eq!(index.search(&[1.0], 5).unwrap(), vec![hit(3, 0.7)]);
        assert!(index.search(&[1.0], 0).unwrap().is_empty());
    }
    #[test]
    fn one_embedding_searches_all_three_translations() {
        use std::sync::{
            atomic::{AtomicUsize, Ordering},
            Arc,
        };
        struct CountingEmbedder(Arc<AtomicUsize>);
        impl super::super::embedder::TextEmbedder for CountingEmbedder {
            fn embed(&self, _: &str) -> Result<Vec<f32>, DetectionError> {
                self.0.fetch_add(1, Ordering::SeqCst);
                Ok(vec![1.0])
            }
            fn dimension(&self) -> usize {
                1
            }
        }
        let calls = Arc::new(AtomicUsize::new(0));
        let index = MultiTranslationIndex::new(
            vec![
                Box::new(Fixed(vec![hit(1, 0.9)])),
                Box::new(Fixed(vec![hit(11, 0.9)])),
                Box::new(Fixed(vec![hit(21, 0.9)])),
            ],
            HashMap::from([(1, 1), (11, 1), (21, 1)]),
        );
        let mut detector = super::super::detector::SemanticDetector::new(
            Box::new(CountingEmbedder(Arc::clone(&calls))),
            Box::new(index),
        );
        let results = detector.detect("a strong match across all three translations");
        assert_eq!(calls.load(Ordering::SeqCst), 1);
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].verse_id, Some(1));
    }
    #[test]
    fn multi_translation_gate_rejects_weak_matches() {
        for (score, expected_count) in [(0.64, 0), (0.65, 1)] {
            let index = MultiTranslationIndex::new(
                vec![Box::new(Fixed(vec![hit(1, score)]))],
                HashMap::from([(1, 1)]),
            );
            let mut detector = super::super::detector::SemanticDetector::new(
                Box::new(super::super::embedder::StubEmbedder::new(1)),
                Box::new(index),
            );
            detector.set_use_synonyms(false);
            detector.set_confidence_threshold(CONFIDENCE_THRESHOLD);
            assert_eq!(
                detector
                    .detect("a phrase with enough words to test the gate")
                    .len(),
                expected_count
            );
        }
    }
    #[test]
    fn unaligned_hit_cannot_hide_a_stronger_aligned_candidate() {
        let index = MultiTranslationIndex::new(
            vec![
                Box::new(Fixed(vec![hit(1, 0.6), hit(2, 0.5)])),
                Box::new(Fixed(vec![hit(99, 0.9), hit(12, 0.8)])),
            ],
            HashMap::from([(1, 1), (2, 2), (12, 2)]),
        );
        assert_eq!(index.search(&[1.0], 1).unwrap(), vec![hit(2, 0.8)]);
    }
}
