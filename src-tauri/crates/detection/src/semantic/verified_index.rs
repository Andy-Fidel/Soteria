//! Validate model provenance and file integrity before accepting optional indexes.
use super::hnsw_index::HnswVectorIndex;
use crate::DetectionError;
use serde::Deserialize;
use sha2::{Digest, Sha256};
use std::{io::Read, path::Path};

#[derive(Clone)]
pub struct EmbeddingIdentity {
    model_sha256: String,
    tokenizer_sha256: String,
}
impl EmbeddingIdentity {
    pub fn from_files(model: &Path, tokenizer: &Path) -> Result<Self, DetectionError> {
        Ok(Self {
            model_sha256: file_digest(model)?,
            tokenizer_sha256: file_digest(tokenizer)?,
        })
    }
}
#[derive(Deserialize)]
struct Manifest {
    version: u32,
    translation: String,
    model_sha256: String,
    tokenizer_sha256: String,
    vectors_sha256: String,
    ids_sha256: String,
    max_tokens: usize,
    prefix: String,
    pooling: String,
    dimension: usize,
    count: usize,
}
fn file_digest(path: &Path) -> Result<String, DetectionError> {
    let mut file = std::fs::File::open(path)
        .map_err(|e| DetectionError::Internal(format!("{}: {e}", path.display())))?;
    let mut digest = Sha256::new();
    let mut buffer = [0u8; 16384];
    loop {
        let len = file
            .read(&mut buffer)
            .map_err(|e| DetectionError::Internal(e.to_string()))?;
        if len == 0 {
            break;
        }
        digest.update(&buffer[..len]);
    }
    Ok(format!("{:x}", digest.finalize()))
}
/// All mismatches reject only this optional index; the caller retains KJV.
pub fn load_verified_index(
    base: &Path,
    translation: &str,
    identity: &EmbeddingIdentity,
    dimension: usize,
) -> Result<HnswVectorIndex, DetectionError> {
    let metadata = std::fs::read(Path::new(&format!("{}.json", base.display())))
        .map_err(|e| DetectionError::Internal(e.to_string()))?;
    let manifest: Manifest =
        serde_json::from_slice(&metadata).map_err(|e| DetectionError::Internal(e.to_string()))?;
    if manifest.version != 1
        || manifest.translation != translation
        || manifest.model_sha256 != identity.model_sha256
        || manifest.tokenizer_sha256 != identity.tokenizer_sha256
        || manifest.max_tokens != 128
        || !manifest.prefix.is_empty()
        || manifest.pooling != "sentence_embedding-or-mean"
        || manifest.dimension != dimension
    {
        return Err(DetectionError::Internal("Translation index model or preprocessing mismatch; rebuild with prepare-translation-indexes.py".into()));
    }
    let vectors = std::path::PathBuf::from(format!("{}.bin", base.display()));
    let ids = base.with_file_name(format!(
        "{}-ids.bin",
        base.file_name().unwrap_or_default().to_string_lossy()
    ));
    if file_digest(&vectors)? != manifest.vectors_sha256
        || file_digest(&ids)? != manifest.ids_sha256
    {
        return Err(DetectionError::Internal(
            "Translation index checksum mismatch".into(),
        ));
    }
    let index = HnswVectorIndex::load(&vectors, &ids, dimension)?;
    if index.verse_ids().len() != manifest.count {
        return Err(DetectionError::Internal(
            "Translation index count mismatch".into(),
        ));
    }
    Ok(index)
}

#[cfg(test)]
mod tests {
    use super::super::index::VectorIndex;
    use super::*;
    fn fixture(dir: &Path) -> (std::path::PathBuf, EmbeddingIdentity, serde_json::Value) {
        let base = dir.join("kjv-qwen3-0.6b-niv");
        std::fs::write(dir.join("model"), b"model").unwrap();
        std::fs::write(dir.join("tokenizer"), b"tokenizer").unwrap();
        let identity =
            EmbeddingIdentity::from_files(&dir.join("model"), &dir.join("tokenizer")).unwrap();
        let vector_path = dir.join("kjv-qwen3-0.6b-niv.bin");
        let id_path = dir.join("kjv-qwen3-0.6b-niv-ids.bin");
        std::fs::write(&vector_path, 1f32.to_le_bytes()).unwrap();
        std::fs::write(&id_path, 10i64.to_le_bytes()).unwrap();
        let metadata = serde_json::json!({"version":1,"translation":"NIV","model_sha256":identity.model_sha256,"tokenizer_sha256":identity.tokenizer_sha256,
            "max_tokens":128,"prefix":"","pooling":"sentence_embedding-or-mean","dimension":1,"count":1,
            "vectors_sha256":file_digest(&vector_path).unwrap(),"ids_sha256":file_digest(&id_path).unwrap()});
        (base, identity, metadata)
    }
    fn publish(base: &Path, metadata: &serde_json::Value) {
        std::fs::write(
            format!("{}.json", base.display()),
            serde_json::to_vec(metadata).unwrap(),
        )
        .unwrap();
    }
    #[test]
    fn accepts_matching_model_and_decimal_filename() {
        let temp = tempfile::tempdir().unwrap();
        let (base, identity, metadata) = fixture(temp.path());
        publish(&base, &metadata);
        let index = load_verified_index(&base, "NIV", &identity, 1).unwrap();
        assert_eq!(index.search(&[1.0], 1).unwrap()[0].verse_id, 10);
    }
    #[test]
    fn rejects_model_tokenizer_translation_dimension_and_preprocessing_mismatches() {
        let temp = tempfile::tempdir().unwrap();
        let (base, identity, metadata) = fixture(temp.path());
        for (field, value) in [
            ("model_sha256", serde_json::json!("wrong")),
            ("tokenizer_sha256", serde_json::json!("wrong")),
            ("translation", serde_json::json!("NLT")),
            ("dimension", serde_json::json!(2)),
            ("max_tokens", serde_json::json!(512)),
            ("prefix", serde_json::json!("passage: ")),
            ("pooling", serde_json::json!("last-token")),
            ("count", serde_json::json!(2)),
        ] {
            let mut changed = metadata.clone();
            changed[field] = value;
            publish(&base, &changed);
            assert!(
                load_verified_index(&base, "NIV", &identity, 1).is_err(),
                "Accepted {field} mismatch"
            );
        }
    }
    #[test]
    fn rejects_missing_corrupt_and_partial_resources() {
        let temp = tempfile::tempdir().unwrap();
        let (base, identity, metadata) = fixture(temp.path());
        assert!(load_verified_index(&base, "NIV", &identity, 1).is_err());
        publish(&base, &metadata);
        std::fs::write(format!("{}.bin", base.display()), [0u8]).unwrap();
        assert!(load_verified_index(&base, "NIV", &identity, 1).is_err());
        std::fs::write(format!("{}.json", base.display()), "{").unwrap();
        assert!(load_verified_index(&base, "NIV", &identity, 1).is_err());
    }
}
