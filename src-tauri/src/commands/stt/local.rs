use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

fn model_filename(platform: &str) -> &'static str {
    if platform == "windows" {
        "ggml-base.en.bin"
    } else {
        "ggml-small.en-q8_0.bin"
    }
}

fn model_relative() -> PathBuf {
    Path::new("models/whisper").join(model_filename(std::env::consts::OS))
}

fn default_provider(platform: &str, whisper_enabled: bool) -> &'static str {
    if whisper_enabled && matches!(platform, "macos" | "windows") {
        "whisper"
    } else {
        "deepgram"
    }
}

fn resolve_model(bundle: &Path, development: Option<&Path>) -> Result<PathBuf, String> {
    let bundled = bundle.join(model_relative());
    if bundled.is_file() {
        return Ok(bundled);
    }
    if let Some(path) = development
        .map(|root| root.join(model_relative()))
        .filter(|p| p.is_file())
    {
        return Ok(path);
    }
    Err("The offline speech model is missing. Reinstall Manna, or choose a cloud provider in Settings → Speech Recognition.".into())
}

pub fn model_path(app: &AppHandle) -> Result<PathBuf, String> {
    let bundle = app.path().resource_dir().map_err(|e| e.to_string())?;
    let development = Path::new(env!("CARGO_MANIFEST_DIR")).join("..");
    resolve_model(
        &bundle,
        cfg!(debug_assertions).then_some(development.as_path()),
    )
}

#[tauri::command]
pub fn get_default_stt_provider() -> &'static str {
    default_provider(std::env::consts::OS, cfg!(feature = "whisper"))
}

/// Load the actual model and inference state, without audio capture or API calls.
#[tauri::command]
pub async fn prepare_local_speech(app: AppHandle) -> Result<String, String> {
    #[cfg(feature = "whisper")]
    {
        let path = model_path(&app)?;
        tauri::async_runtime::spawn_blocking(move || {
            let context = whisper_context_check(&path)?;
            Ok(context)
        })
        .await
        .map_err(|e| e.to_string())?
    }
    #[cfg(not(feature = "whisper"))]
    {
        let _ = app;
        Err("Offline speech is not included in this build. Choose a cloud provider in Settings → Speech Recognition.".into())
    }
}

#[cfg(feature = "whisper")]
pub fn whisper_context_check(path: &Path) -> Result<String, String> {
    rhema_stt::whisper::validate_model(path).map_err(|e| e.to_string())?;
    let model = if cfg!(target_os = "windows") {
        "Base English"
    } else {
        "Small English"
    };
    Ok(format!(
        "{model} is ready — no speech API key or internet needed."
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn windows_uses_base_and_mac_keeps_small() {
        assert_eq!(model_filename("windows"), "ggml-base.en.bin");
        assert_eq!(model_filename("macos"), "ggml-small.en-q8_0.bin");
    }
    #[test]
    fn offline_builds_default_to_whisper_on_both_desktop_platforms() {
        assert_eq!(default_provider("windows", true), "whisper");
        assert_eq!(default_provider("macos", true), "whisper");
        assert_eq!(default_provider("windows", false), "deepgram");
    }
    #[test]
    fn release_never_uses_a_development_model() {
        let temp = tempfile::tempdir().unwrap();
        let dev = temp.path().join("development");
        let model = dev.join(model_relative());
        std::fs::create_dir_all(model.parent().unwrap()).unwrap();
        std::fs::write(&model, b"development").unwrap();
        assert!(resolve_model(&temp.path().join("bundle"), None).is_err());
        assert_eq!(
            resolve_model(&temp.path().join("bundle"), Some(&dev)).unwrap(),
            model
        );
    }
    #[test]
    fn bundle_wins_over_development() {
        let temp = tempfile::tempdir().unwrap();
        let model = temp.path().join(model_relative());
        std::fs::create_dir_all(model.parent().unwrap()).unwrap();
        std::fs::write(&model, b"bundled").unwrap();
        assert_eq!(
            resolve_model(temp.path(), Some(temp.path())).unwrap(),
            model
        );
    }
}
