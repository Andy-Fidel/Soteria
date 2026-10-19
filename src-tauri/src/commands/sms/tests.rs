use super::*;

#[test]
fn rejects_invalid_numbers_and_deduplicates_ghana_formats() {
    assert_eq!(
        normalize_numbers(&["0501234567".into(), "+233501234567".into()]).unwrap(),
        vec!["233501234567"]
    );
    assert!(normalize_numbers(&["123".into()]).is_err());
    assert!(normalize_numbers(&[]).is_err());
    assert!(normalize_numbers(
        &(0..11)
            .map(|i| format!("2335012345{i:02}"))
            .collect::<Vec<_>>()
    )
    .is_err());
}

#[test]
fn rejects_missing_message_and_unapproved_sender_shapes() {
    assert!(validate_message("").is_err());
    assert!(validate_message(&"x".repeat(1601)).is_err());
    assert!(validate_sender("EWC ADENTAN").is_ok());
    assert!(validate_sender("bad\r\nheader").is_err());
}

#[test]
fn outbox_survives_reopen_and_preserves_retry_keys() {
    let dir = tempfile::tempdir().unwrap();
    let batch = sample_batch();
    save_batch(dir.path(), &batch).unwrap();
    let recovered = read_batch(dir.path(), batch.session_id, &batch.id).unwrap();
    assert_eq!(recovered.recipients[0].key, batch.recipients[0].key);
    assert_eq!(recovered.message, batch.message);
    assert!(read_batch(dir.path(), batch.session_id, "../config").is_err());
    assert!(read_batch(dir.path(), batch.session_id + 1, &batch.id).is_err());
}

fn sample_batch() -> SmsBatch {
    SmsBatch {
        id: uuid::Uuid::new_v4().to_string(),
        session_id: 42,
        message: "Walk by faith.".into(),
        sender_id: "EWC ADENTAN".into(),
        profile_id: "profile".into(),
        created_at: now(),
        estimated_cost: 0.05,
        currency: "GHS".into(),
        segments: 1,
        recipients: vec![SmsRecipient {
            phone: "233501234567".into(),
            key: uuid::Uuid::new_v4().to_string(),
            status: "PREVIEWED".into(),
            message_id: None,
            error: None,
        }],
    }
}

pub(super) async fn mock_server(
    responses: Vec<(u16, &'static str)>,
) -> (String, tokio::task::JoinHandle<Vec<String>>) {
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let base = format!("http://{}", listener.local_addr().unwrap());
    let task = tokio::spawn(async move {
        let mut requests = Vec::new();
        for (status, body) in responses {
            let (mut stream, _) =
                tokio::time::timeout(std::time::Duration::from_secs(5), listener.accept())
                    .await
                    .unwrap()
                    .unwrap();
            let mut bytes = Vec::new();
            loop {
                let mut buffer = [0_u8; 4096];
                let count = stream.read(&mut buffer).await.unwrap();
                if count == 0 {
                    break;
                }
                bytes.extend_from_slice(&buffer[..count]);
                let text = String::from_utf8_lossy(&bytes);
                if let Some(end) = text.find("\r\n\r\n") {
                    let length: usize = text[..end]
                        .lines()
                        .find_map(|line| {
                            line.to_lowercase()
                                .strip_prefix("content-length:")
                                .and_then(|value| value.trim().parse().ok())
                        })
                        .unwrap_or(0);
                    if bytes.len() >= end + 4 + length {
                        break;
                    }
                }
            }
            requests.push(String::from_utf8(bytes).unwrap());
            stream.write_all(format!("HTTP/1.1 {status} Response\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}", body.len()).as_bytes()).await.unwrap();
        }
        requests
    });
    (base, task)
}

#[tokio::test]
async fn preview_fetches_cost_without_calling_send() {
    let (base, requests) = mock_server(vec![(
        200,
        r#"{"success":true,"data":{"segments":1,"estimatedCost":0.05,"currency":"GHS"}}"#,
    )])
    .await;
    let preview = CommsClient::with_base("test-key-never-a-real-key", base)
        .preview("233501234567", "Walk by faith.", "EWC ADENTAN")
        .await
        .unwrap();
    assert_eq!(preview.segments, 1);
    assert_eq!(preview.estimated_cost, 0.05);
    let requests = requests.await.unwrap();
    assert!(requests[0].starts_with("POST /sms/preview "));
    assert!(!requests[0].to_lowercase().contains("idempotency-key:"));
}

#[tokio::test]
async fn preview_accepts_live_api_parts_and_decimal_text_cost() {
    let (base, requests) = mock_server(vec![(200, r#"{"success":true,"data":{"to":"233501234567","messageLength":14,"encoding":"GSM-7","parts":1,"charactersPerPart":160,"pricePerPart":"0.05","totalCost":"0.0500","currency":"credits"}}"#)]).await;
    let preview = CommsClient::with_base("test-key-never-a-real-key", base)
        .preview("233501234567", "Walk by faith.", "EWC ADENTAN")
        .await
        .unwrap();
    assert_eq!(preview.segments, 1);
    assert_eq!(preview.estimated_cost, 0.05);
    assert_eq!(preview.currency, "credits");
    assert_eq!(requests.await.unwrap().len(), 1);
}

#[tokio::test]
async fn preview_rejects_invalid_decimal_cost_instead_of_showing_zero() {
    let (base, requests) = mock_server(vec![(
        200,
        r#"{"success":true,"data":{"parts":1,"totalCost":"not-a-price","currency":"credits"}}"#,
    )])
    .await;
    assert!(CommsClient::with_base("test-key-never-a-real-key", base)
        .preview("233501234567", "Walk by faith.", "EWC ADENTAN")
        .await
        .is_err());
    assert_eq!(requests.await.unwrap().len(), 1);
}

#[tokio::test]
async fn accepted_send_is_not_repeated_and_delivery_check_only_reads() {
    let (base, requests) = mock_server(vec![
        (
            202,
            r#"{"success":true,"data":{"id":"msg_test","status":"QUEUED"}}"#,
        ),
        (
            200,
            r#"{"success":true,"data":{"id":"msg_test","status":"DELIVERED"}}"#,
        ),
    ])
    .await;
    let dir = tempfile::tempdir().unwrap();
    let client = CommsClient::with_base("test-key-never-a-real-key", base);
    let mut batch = sample_batch();
    dispatch(dir.path(), &mut batch, &client).await.unwrap();
    let mut reopened = read_batch(dir.path(), batch.session_id, &batch.id).unwrap();
    dispatch(dir.path(), &mut reopened, &client).await.unwrap();
    assert_eq!(reopened.recipients[0].status, "QUEUED");
    let status = client
        .status(reopened.recipients[0].message_id.as_deref().unwrap())
        .await
        .unwrap();
    assert_eq!(status.status, "DELIVERED");
    let requests = requests.await.unwrap();
    assert!(requests[0].starts_with("POST /sms "));
    assert!(requests[1].starts_with("GET /sms/msg_test "));
}

#[tokio::test]
async fn uncertain_send_reuses_saved_key_and_exact_payload_after_reopen() {
    let (base, requests) = mock_server(vec![
        (
            500,
            r#"{"error":"do not expose provider details or credentials"}"#,
        ),
        (
            202,
            r#"{"success":true,"data":{"id":"msg_retry","status":"DISPATCHED"}}"#,
        ),
    ])
    .await;
    let dir = tempfile::tempdir().unwrap();
    let client = CommsClient::with_base("test-key-never-a-real-key", base);
    let mut batch = sample_batch();
    dispatch(dir.path(), &mut batch, &client).await.unwrap();
    assert_eq!(batch.recipients[0].status, "UNKNOWN");
    assert!(!batch.recipients[0]
        .error
        .as_deref()
        .unwrap()
        .contains("credentials"));
    let mut recovered = read_batch(dir.path(), batch.session_id, &batch.id).unwrap();
    dispatch(dir.path(), &mut recovered, &client).await.unwrap();
    let requests = requests.await.unwrap();
    let key_header = format!("idempotency-key: {}", batch.recipients[0].key);
    assert!(requests
        .iter()
        .all(|request| request.to_lowercase().contains(&key_header)));
    assert_eq!(
        requests[0].split("\r\n\r\n").nth(1),
        requests[1].split("\r\n\r\n").nth(1)
    );
    assert_eq!(recovered.recipients[0].status, "DISPATCHED");
}

#[tokio::test]
async fn rejected_payment_is_not_retried_as_an_uncertain_send() {
    let (base, requests) = mock_server(vec![(402, r#"{"error":"private-provider-detail"}"#)]).await;
    let dir = tempfile::tempdir().unwrap();
    let client = CommsClient::with_base("test-key-never-a-real-key", base);
    let mut batch = sample_batch();
    dispatch(dir.path(), &mut batch, &client).await.unwrap();
    assert_eq!(batch.recipients[0].status, "REJECTED");
    dispatch(dir.path(), &mut batch, &client).await.unwrap();
    assert_eq!(requests.await.unwrap().len(), 1);
}

#[cfg(unix)]
#[test]
fn credentials_are_private_and_never_returned_in_settings_status() {
    use std::os::unix::fs::PermissionsExt;
    let dir = tempfile::tempdir().unwrap();
    write_private(
        &dir.path().join("config.json"),
        &SmsConfig {
            key: "test-secret-not-real".into(),
            sender_id: "EWC".into(),
            profile_id: "profile".into(),
            contact_list_id: "11111111-2222-4333-8444-555555555555".into(),
        },
    )
    .unwrap();
    assert_eq!(
        std::fs::metadata(dir.path().join("config.json"))
            .unwrap()
            .permissions()
            .mode()
            & 0o777,
        0o600
    );
    assert_eq!(
        std::fs::metadata(dir.path()).unwrap().permissions().mode() & 0o777,
        0o700
    );
    let status = serde_json::to_string(&SmsSettings {
        configured: true,
        sender_id: "EWC".into(),
        contact_list_id: "11111111-2222-4333-8444-555555555555".into(),
    })
    .unwrap();
    assert!(!status.contains("test-secret"));
}

#[tokio::test]
#[ignore = "Requires a saved Comms360 credential; calls preview only, never sends SMS"]
async fn live_cost_preview_with_saved_credential() {
    let root = dirs::data_dir().unwrap().join("com.manna.app").join("sms");
    let config = read_config(&root)
        .unwrap()
        .expect("Save Comms360 settings first");
    let result = CommsClient::new(&config.key)
        .unwrap()
        .preview(
            "233560043149",
            "Connection preview only. No SMS will be sent.",
            &config.sender_id,
        )
        .await
        .unwrap();
    assert_eq!(result.segments, 1);
    assert!(result.estimated_cost.is_finite() && result.estimated_cost >= 0.0);
    assert!(!result.currency.trim().is_empty());
}
