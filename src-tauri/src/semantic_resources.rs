//! Optional translation indexes are verified against the selected runtime model.
use rhema_bible::BibleDb;
use rhema_detection::{
    semantic::{
        index::VectorIndex,
        multi_translation::MultiTranslationIndex,
        verified_index::{load_verified_index, EmbeddingIdentity},
    },
    HnswVectorIndex,
};
use std::{
    collections::HashMap,
    path::{Path, PathBuf},
};

pub fn add_translations(
    base: HnswVectorIndex,
    db: Option<&BibleDb>,
    model: &Path,
    tokenizer: &Path,
    stem: &str,
    dimension: usize,
    resolve: impl Fn(&str) -> PathBuf,
) -> Box<dyn VectorIndex> {
    let Some(db) = db else {
        return Box::new(base);
    };
    let Ok(verses) = db.load_verse_locations("en") else {
        return Box::new(base);
    };
    let known_ids: std::collections::HashSet<_> = verses.iter().map(|v| v.id).collect();
    let base_ids: std::collections::HashSet<_> = base.verse_ids().iter().copied().collect();
    let canonical: HashMap<_, _> = verses
        .iter()
        .filter(|v| base_ids.contains(&v.id))
        .map(|v| ((v.book_number, v.chapter, v.verse), v.id))
        .collect();
    let mapping: HashMap<_, _> = verses
        .iter()
        .filter_map(|v| {
            canonical
                .get(&(v.book_number, v.chapter, v.verse))
                .map(|&id| (v.id, id))
        })
        .collect();
    let Ok(identity) = EmbeddingIdentity::from_files(model, tokenizer) else {
        return Box::new(base);
    };
    let mut indexes: Vec<Box<dyn VectorIndex>> = vec![Box::new(base)];
    for translation in ["NIV", "NLT"] {
        let metadata = resolve(&format!(
            "embeddings/translation-indexes/{stem}-{}.json",
            translation.to_lowercase()
        ));
        let path = metadata.with_extension("");
        match load_verified_index(&path,translation,&identity,dimension) {
            Ok(index) => {
                if index.verse_ids().iter().any(|id| !known_ids.contains(id)) {
                    log::warn!("{translation} index does not match the installed Bible database; keeping KJV fallback");
                    continue;
                }
                let unaligned = index.verse_ids().iter().filter(|id| !mapping.contains_key(id)).count();
                if unaligned > 0 { log::info!("{translation}: skipping {unaligned} verse numbers absent from KJV"); }
                log::info!("Loaded {translation} semantic index ({} vectors)",index.len());
                indexes.push(Box::new(index));
            }
            Err(e) => log::warn!("{translation} semantic index unavailable: {e}; run data/prepare-translation-indexes.py"),
        }
    }
    if indexes.len() == 1 {
        return indexes.remove(0);
    }
    Box::new(MultiTranslationIndex::new(indexes, mapping))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn base_index() -> HnswVectorIndex {
        HnswVectorIndex::from_vecs(vec![vec![1.0]], vec![42], 1).unwrap()
    }

    #[test]
    fn missing_database_preserves_base_index() {
        let index = add_translations(
            base_index(),
            None,
            Path::new("missing-model"),
            Path::new("missing-tokenizer"),
            "missing",
            1,
            |path| PathBuf::from(path),
        );
        assert_eq!(index.len(), 1);
        assert_eq!(index.search(&[1.0], 1).unwrap()[0].verse_id, 42);
    }

    #[test]
    fn metadata_query_error_preserves_base_index() {
        let temp = tempfile::tempdir().unwrap();
        std::fs::write(temp.path().join("empty.db"), []).unwrap();
        let db = BibleDb::open(&temp.path().join("empty.db")).unwrap();
        let index = add_translations(
            base_index(),
            Some(&db),
            Path::new("missing-model"),
            Path::new("missing-tokenizer"),
            "missing",
            1,
            |path| PathBuf::from(path),
        );
        assert_eq!(index.len(), 1);
        assert_eq!(index.search(&[1.0], 1).unwrap()[0].verse_id, 42);
    }
}
