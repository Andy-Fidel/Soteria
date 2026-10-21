pub mod list;
mod provider;
mod storage;
use provider::CommsClient;
use rhema_notes::SessionDb;
use serde::{Deserialize, Serialize};
use std::{path::Path, sync::Mutex};
use storage::*;
use tauri::{Manager, State};

#[derive(Default)]
pub struct SmsRuntime(pub tokio::sync::Mutex<()>);

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SmsRecipient {
    pub phone: String,
    pub key: String,
    pub status: String,
    pub message_id: Option<String>,
    pub error: Option<String>,
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SmsBatch {
    pub id: String,
    pub session_id: i64,
    pub message: String,
    pub sender_id: String,
    pub profile_id: String,
    pub created_at: u64,
    pub estimated_cost: f64,
    pub currency: String,
    pub segments: u32,
    pub recipients: Vec<SmsRecipient>,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SmsSettings {
    configured: bool,
    sender_id: String,
    contact_list_id: String,
}

fn root(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|path| path.join("sms"))
        .map_err(|_| "Could not open SMS settings.".into())
}
fn now() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_or(0, |value| value.as_millis() as u64)
}
fn validate_sender(sender: &str) -> Result<(), String> {
    if sender.trim().is_empty()
        || sender.len() > 20
        || !sender
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == ' ' || c == '-')
    {
        return Err("Enter your approved Comms360 sender ID (up to 20 letters, numbers, spaces or hyphens).".into());
    }
    Ok(())
}
fn validate_message(message: &str) -> Result<(), String> {
    if message.trim().is_empty() || message.chars().count() > 1600 {
        return Err("Enter an SMS of 1–1,600 characters.".into());
    }
    Ok(())
}
fn normalize_numbers(numbers: &[String]) -> Result<Vec<String>, String> {
    if numbers.is_empty() || numbers.len() > 10 {
        return Err("Enter between 1 and 10 test numbers.".into());
    }
    let mut result = Vec::new();
    for number in numbers {
        let compact: String = number
            .chars()
            .filter(|c| !c.is_whitespace() && *c != '-' && *c != '(' && *c != ')')
            .collect();
        let compact = compact.strip_prefix('+').unwrap_or(&compact);
        let normalized = if compact.len() == 10 && compact.starts_with('0') {
            format!("233{}", &compact[1..])
        } else {
            compact.to_owned()
        };
        if normalized.len() != 12
            || !normalized.starts_with("233")
            || !normalized.bytes().all(|c| c.is_ascii_digit())
            || normalized.as_bytes()[3] == b'0'
        {
            return Err("One or more test numbers are invalid. Use a Ghana number such as 0501234567 or +233501234567.".into());
        }
        if !result.contains(&normalized) {
            result.push(normalized);
        }
    }
    Ok(result)
}

#[tauri::command]
pub async fn get_comms360_settings(
    app: tauri::AppHandle,
    runtime: State<'_, SmsRuntime>,
) -> Result<SmsSettings, String> {
    let _guard = runtime.0.lock().await;
    Ok(match read_config(&root(&app)?)? {
        Some(config) => SmsSettings {
            configured: true,
            sender_id: config.sender_id,
            contact_list_id: config.contact_list_id,
        },
        None => SmsSettings {
            configured: false,
            sender_id: String::new(),
            contact_list_id: String::new(),
        },
    })
}
#[tauri::command]
pub async fn save_comms360_settings(
    app: tauri::AppHandle,
    runtime: State<'_, SmsRuntime>,
    api_key: String,
    sender_id: String,
    contact_list_id: Option<String>,
) -> Result<SmsSettings, String> {
    let _guard = runtime.0.lock().await;
    validate_sender(&sender_id)?;
    let directory = root(&app)?;
    let previous = read_config(&directory)?;
    let contact_list_id =
        list::normalize_list_id(contact_list_id.as_deref().unwrap_or_else(|| {
            previous
                .as_ref()
                .map_or("", |config| config.contact_list_id.as_str())
        }))?;
    let key = if api_key.trim().is_empty() {
        previous
            .as_ref()
            .map(|value| value.key.clone())
            .ok_or("Enter a Comms360 API key.")?
    } else {
        api_key.trim().to_owned()
    };
    if key.len() < 16 || key.len() > 1024 || !key.bytes().all(|c| c.is_ascii_graphic()) {
        return Err("Enter a valid Comms360 API key.".into());
    }
    let profile_id = previous.filter(|value| value.key == key).map_or_else(
        || uuid::Uuid::new_v4().to_string(),
        |value| value.profile_id,
    );
    let sender_id = sender_id.trim().to_uppercase();
    write_private(
        &directory.join("config.json"),
        &SmsConfig {
            key,
            sender_id: sender_id.clone(),
            profile_id,
            contact_list_id: contact_list_id.clone(),
        },
    )?;
    Ok(SmsSettings {
        configured: true,
        sender_id,
        contact_list_id,
    })
}

#[tauri::command]
pub async fn get_test_sms_batch(
    app: tauri::AppHandle,
    runtime: State<'_, SmsRuntime>,
    session_id: i64,
) -> Result<Option<SmsBatch>, String> {
    let _guard = runtime.0.lock().await;
    latest_batch(&root(&app)?, session_id)
}

#[tauri::command]
pub async fn preview_test_sms(
    app: tauri::AppHandle,
    runtime: State<'_, SmsRuntime>,
    db: State<'_, Mutex<SessionDb>>,
    session_id: i64,
    message: String,
    numbers: Vec<String>,
) -> Result<SmsBatch, String> {
    let _guard = runtime.0.lock().await;
    {
        db.lock()
            .map_err(|_| "Session database is busy.")?
            .get_session(session_id)
            .map_err(|_| "This session could not be found.")?;
    }
    validate_message(&message)?;
    let numbers = normalize_numbers(&numbers)?;
    let directory = root(&app)?;
    let config = read_config(&directory)?.ok_or("Add Comms360 in Settings → API Keys first.")?;
    let client = CommsClient::new(&config.key)?;
    let mut batch = SmsBatch {
        id: uuid::Uuid::new_v4().to_string(),
        session_id,
        message,
        sender_id: config.sender_id,
        profile_id: config.profile_id,
        created_at: now(),
        estimated_cost: 0.0,
        currency: String::new(),
        segments: 0,
        recipients: Vec::new(),
    };
    for phone in numbers {
        let preview = client
            .preview(&phone, &batch.message, &batch.sender_id)
            .await?;
        if preview.segments != 1 {
            return Err("Shorten the message to one SMS part before sending a test.".into());
        }
        if !batch.currency.is_empty() && batch.currency != preview.currency {
            return Err("Comms360 returned inconsistent cost currencies.".into());
        }
        batch.currency = preview.currency;
        batch.estimated_cost += preview.estimated_cost;
        batch.segments += preview.segments;
        batch.recipients.push(SmsRecipient {
            phone,
            key: uuid::Uuid::new_v4().to_string(),
            status: "PREVIEWED".into(),
            message_id: None,
            error: None,
        });
    }
    save_batch(&directory, &batch)?;
    Ok(batch)
}

async fn dispatch(
    directory: &Path,
    batch: &mut SmsBatch,
    client: &CommsClient,
) -> Result<(), String> {
    for index in 0..batch.recipients.len() {
        if !matches!(
            batch.recipients[index].status.as_str(),
            "PREVIEWED" | "UNKNOWN"
        ) {
            continue;
        }
        // Persist the exact payload and retry key before any paid request.
        batch.recipients[index].status = "UNKNOWN".into();
        save_batch(directory, batch)?;
        let recipient = &batch.recipients[index];
        let result = client
            .send(
                &recipient.phone,
                &batch.message,
                &batch.sender_id,
                &recipient.key,
            )
            .await;
        let recipient = &mut batch.recipients[index];
        match result {
            Ok(sent) => {
                recipient.message_id = Some(sent.id);
                recipient.status = sent.status;
                recipient.error = None;
            }
            Err(error) => {
                recipient.status = if error.uncertain {
                    "UNKNOWN"
                } else {
                    "REJECTED"
                }
                .into();
                recipient.error = Some(error.message);
            }
        }
        save_batch(directory, batch)?;
        // Stop after an uncertain request. A manual retry reuses its original key.
        if batch.recipients[index].error.is_some() {
            break;
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn send_test_sms(
    app: tauri::AppHandle,
    runtime: State<'_, SmsRuntime>,
    session_id: i64,
    batch_id: String,
) -> Result<SmsBatch, String> {
    let _guard = runtime.0.lock().await;
    let directory = root(&app)?;
    let mut batch = read_batch(&directory, session_id, &batch_id)?;
    let config = read_config(&directory)?.ok_or("Add Comms360 in Settings → API Keys first.")?;
    if config.profile_id != batch.profile_id {
        return Err("The Comms360 key changed. Prepare a new preview before sending.".into());
    }
    if now().saturating_sub(batch.created_at) > 15 * 60 * 1000 {
        return Err("This preview is over 15 minutes old. Check any uncertain sends in Comms360 before preparing another test.".into());
    }
    dispatch(&directory, &mut batch, &CommsClient::new(&config.key)?).await?;
    Ok(batch)
}

#[tauri::command]
pub async fn refresh_test_sms(
    app: tauri::AppHandle,
    runtime: State<'_, SmsRuntime>,
    session_id: i64,
    batch_id: String,
) -> Result<SmsBatch, String> {
    let _guard = runtime.0.lock().await;
    let directory = root(&app)?;
    let mut batch = read_batch(&directory, session_id, &batch_id)?;
    let config = read_config(&directory)?.ok_or("Add Comms360 in Settings → API Keys first.")?;
    if config.profile_id != batch.profile_id {
        return Err("Use the original Comms360 account to check this test.".into());
    }
    let client = CommsClient::new(&config.key)?;
    for recipient in &mut batch.recipients {
        if let Some(id) = &recipient.message_id {
            match client.status(id).await {
                Ok(sent) => {
                    recipient.status = sent.status;
                    recipient.error = None;
                }
                Err(error) => recipient.error = Some(error),
            }
        }
    }
    save_batch(&directory, &batch)?;
    Ok(batch)
}

#[cfg(test)]
mod tests;
