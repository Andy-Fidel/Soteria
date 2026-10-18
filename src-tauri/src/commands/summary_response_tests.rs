use super::request_summary;
use serde_json::{json, Value};
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::TcpListener,
};

async fn server(responses: Vec<Value>) -> (String, tokio::task::JoinHandle<Vec<Value>>) {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let endpoint = format!("http://{}/", listener.local_addr().unwrap());
    let task = tokio::spawn(async move {
        let mut requests = Vec::new();
        for response in responses {
            let (mut socket, _) = listener.accept().await.unwrap();
            let mut bytes = Vec::new();
            let mut buffer = [0; 4096];
            let (body_start, length) = loop {
                let n = socket.read(&mut buffer).await.unwrap();
                assert!(n > 0);
                bytes.extend_from_slice(&buffer[..n]);
                if let Some(end) = bytes.windows(4).position(|w| w == b"\r\n\r\n") {
                    let headers = String::from_utf8_lossy(&bytes[..end]);
                    let length = headers
                        .lines()
                        .find_map(|line| {
                            let (name, value) = line.split_once(':')?;
                            name.eq_ignore_ascii_case("content-length")
                                .then(|| value.trim().parse::<usize>().unwrap())
                        })
                        .unwrap();
                    break (end + 4, length);
                }
            };
            while bytes.len() < body_start + length {
                let n = socket.read(&mut buffer).await.unwrap();
                assert!(n > 0);
                bytes.extend_from_slice(&buffer[..n]);
            }
            requests.push(serde_json::from_slice(&bytes[body_start..body_start + length]).unwrap());
            let body = response.to_string();
            let header = format!("HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n", body.len());
            socket.write_all(header.as_bytes()).await.unwrap();
            socket.write_all(body.as_bytes()).await.unwrap();
        }
        requests
    });
    (endpoint, task)
}

fn choice(content: &str, finish_reason: &str) -> Value {
    json!({"choices": [{"message": {"content": content}, "finish_reason": finish_reason}]})
}

#[tokio::test]
async fn token_limited_json_is_regenerated_from_the_same_full_source() {
    let complete = r#"{"notes":"Opening and final teaching retained","worship":"separate"}"#;
    let (endpoint, requests) = server(vec![
        choice(r#"{"notes":"Only the opening"}"#, "length"),
        choice(complete, "stop"),
    ])
    .await;
    let source = "SCHEMA JSON\nOriginal opening — 恩典 🙏\nFINAL TEACHING";
    let result = request_summary(
        &reqwest::Client::new(),
        "test-key",
        source.into(),
        768,
        &endpoint,
    )
    .await;
    assert_eq!(result.unwrap(), complete);
    let requests = tokio::time::timeout(std::time::Duration::from_secs(2), requests)
        .await
        .unwrap()
        .unwrap();
    assert_eq!(requests.len(), 2);
    assert_eq!(requests[0]["max_tokens"], 768);
    assert_eq!(requests[1]["max_tokens"], 1536);
    for request in requests {
        assert_eq!(request["messages"][0]["content"], source);
        assert_eq!(request["response_format"]["type"], "json_object");
    }
}

#[tokio::test]
async fn incomplete_json_is_retried_even_when_provider_reports_stop() {
    let complete = r#"{"notes":"Complete notes including the closing section"}"#;
    let (endpoint, requests) = server(vec![
        choice(r#"{"notes":"cut off"#, "stop"),
        choice(complete, "stop"),
    ])
    .await;
    let result = request_summary(
        &reqwest::Client::new(),
        "test-key",
        "Full source JSON".into(),
        2048,
        &endpoint,
    )
    .await;
    assert_eq!(result.unwrap(), complete);
    assert_eq!(
        tokio::time::timeout(std::time::Duration::from_secs(2), requests)
            .await
            .unwrap()
            .unwrap()
            .len(),
        2
    );
}

#[tokio::test]
async fn repeated_truncation_returns_an_error_instead_of_a_partial_summary() {
    let (endpoint, requests) = server(vec![choice(r#"{"notes":"cut off"#, "length"); 2]).await;
    let result = request_summary(
        &reqwest::Client::new(),
        "test-key",
        "Full source JSON".into(),
        4096,
        &endpoint,
    )
    .await;
    assert!(result.unwrap_err().contains("incomplete"));
    assert_eq!(
        tokio::time::timeout(std::time::Duration::from_secs(2), requests)
            .await
            .unwrap()
            .unwrap()
            .len(),
        2
    );
}
