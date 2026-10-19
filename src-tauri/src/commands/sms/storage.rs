use super::SmsBatch;
use serde::{Deserialize, Serialize};
use std::{
    fs,
    io::Write,
    path::{Path, PathBuf},
};

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct SmsConfig {
    pub key: String,
    pub sender_id: String,
    pub profile_id: String,
    #[serde(default)]
    pub contact_list_id: String,
}
pub(super) fn write_private(path: &Path, value: &impl Serialize) -> Result<(), String> {
    let directory = path.parent().ok_or("Invalid SMS storage path.")?;
    fs::create_dir_all(directory).map_err(|_| "Could not create private SMS storage.")?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(directory, fs::Permissions::from_mode(0o700))
            .map_err(|_| "Could not protect SMS storage.")?;
    }
    let temporary = path.with_extension(format!("{}.tmp", uuid::Uuid::new_v4()));
    let result = (|| {
        let mut options = fs::OpenOptions::new();
        options.write(true).create_new(true);
        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;
            options.mode(0o600);
        }
        let mut file = options
            .open(&temporary)
            .map_err(|_| "Could not save SMS settings or history.")?;
        let bytes =
            serde_json::to_vec(value).map_err(|_| "Could not encode SMS settings or history.")?;
        file.write_all(&bytes)
            .and_then(|()| file.sync_all())
            .map_err(|_| "Could not save SMS settings or history.")?;
        fs::rename(&temporary, path)
            .map_err(|_| "Could not finish saving SMS settings or history.")?;
        Ok(())
    })();
    if result.is_err() {
        let _ = fs::remove_file(temporary);
    }
    result
}
pub(super) fn read_config(directory: &Path) -> Result<Option<SmsConfig>, String> {
    match fs::read(directory.join("config.json")) {
        Ok(bytes) => serde_json::from_slice(&bytes).map(Some).map_err(|_| {
            "Comms360 settings could not be read. Save them again in Settings → API Keys.".into()
        }),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(_) => Err("Could not read Comms360 settings.".into()),
    }
}
fn batch_path(directory: &Path, session_id: i64, id: &str) -> Result<PathBuf, String> {
    if session_id <= 0 || uuid::Uuid::parse_str(id).is_err() {
        return Err("Invalid SMS test reference.".into());
    }
    Ok(directory.join(format!("batch-{session_id}-{id}.json")))
}
pub(super) fn save_batch(directory: &Path, batch: &SmsBatch) -> Result<(), String> {
    write_private(&batch_path(directory, batch.session_id, &batch.id)?, batch)
}
pub(super) fn read_batch(directory: &Path, session_id: i64, id: &str) -> Result<SmsBatch, String> {
    let bytes = fs::read(batch_path(directory, session_id, id)?).map_err(|_| {
        "Could not read this SMS test. No message was sent by this request.".to_string()
    })?;
    let batch: SmsBatch =
        serde_json::from_slice(&bytes).map_err(|_| "The saved SMS test could not be read.")?;
    if batch.session_id != session_id || batch.id != id {
        return Err("SMS test reference does not match this session.".into());
    }
    Ok(batch)
}
pub(super) fn latest_batch(directory: &Path, session_id: i64) -> Result<Option<SmsBatch>, String> {
    if session_id <= 0 {
        return Err("Invalid session.".into());
    }
    let entries = match fs::read_dir(directory) {
        Ok(entries) => entries,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(_) => return Err("Could not read SMS history.".into()),
    };
    let prefix = format!("batch-{session_id}-");
    let mut latest: Option<SmsBatch> = None;
    for entry in entries {
        let entry = entry.map_err(|_| "Could not read SMS history.")?;
        let name = entry.file_name().to_string_lossy().into_owned();
        if let Some(id) = name
            .strip_prefix(&prefix)
            .and_then(|name| name.strip_suffix(".json"))
        {
            let batch = read_batch(directory, session_id, id)?;
            if latest
                .as_ref()
                .map_or(true, |previous| batch.created_at > previous.created_at)
            {
                latest = Some(batch);
            }
        }
    }
    // Only show history, never schedule or resume sending when the app opens.
    Ok(latest)
}
