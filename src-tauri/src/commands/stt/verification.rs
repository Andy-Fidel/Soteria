/* -------------------------------------------------------------------------- */
/*  Key verification                                                          */
/* -------------------------------------------------------------------------- */

#[derive(serde::Serialize)]
pub struct VerifyResult {
    pub ok: bool,
    pub http_ok: bool,
    pub ws_ok: bool,
    pub detail: String,
}

const PROBE_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(15);

async fn http_probe(url: &str, auth: &str) -> Result<(), String> {
    let client = reqwest::Client::builder()
        .timeout(PROBE_TIMEOUT)
        .connect_timeout(std::time::Duration::from_secs(10))
        .http1_only()
        .build()
        .map_err(|e| e.to_string())?;
    let resp = client
        .get(url)
        .header("Authorization", auth)
        .send()
        .await
        .map_err(|e| {
            use std::error::Error;
            let mut detail = format!("network: {e}");
            let mut src: Option<&dyn Error> = Error::source(&e);
            while let Some(s) = src {
                detail.push_str(&format!(" → {s}"));
                src = s.source();
            }
            detail
        })?;
    let status = resp.status();
    if status.is_success() {
        Ok(())
    } else if status == reqwest::StatusCode::UNAUTHORIZED
        || status == reqwest::StatusCode::FORBIDDEN
    {
        Err("invalid API key".to_string())
    } else {
        Err(format!("http {}", status.as_u16()))
    }
}

async fn ws_probe(
    url: url::Url,
    auth_header: (&str, &str),
    expect_begin: bool,
    terminate_frame: Option<&str>,
) -> Result<(), String> {
    use futures_util::{SinkExt, StreamExt};
    use tokio_tungstenite::tungstenite::client::IntoClientRequest;
    use tokio_tungstenite::tungstenite::http::{HeaderName, HeaderValue};
    use tokio_tungstenite::tungstenite::Message;

    let mut req = url
        .as_str()
        .into_client_request()
        .map_err(|e| e.to_string())?;
    let name = HeaderName::from_bytes(auth_header.0.as_bytes()).map_err(|e| e.to_string())?;
    let value = HeaderValue::from_str(auth_header.1).map_err(|e| e.to_string())?;
    req.headers_mut().insert(name, value);

    let connect = tokio_tungstenite::connect_async(req);
    let (ws, _) = tokio::time::timeout(PROBE_TIMEOUT, connect)
        .await
        .map_err(|_| "ws connect timeout".to_string())?
        .map_err(|e| format!("ws connect: {e}"))?;
    let (mut write, mut read) = ws.split();

    if expect_begin {
        let first = tokio::time::timeout(PROBE_TIMEOUT, read.next())
            .await
            .map_err(|_| "ws no server frame (timeout)".to_string())?
            .ok_or_else(|| "ws closed before first frame".to_string())?
            .map_err(|e| format!("ws recv: {e}"))?;
        if let Message::Text(txt) = &first {
            if !txt.contains("\"type\"") {
                return Err(format!("ws unexpected first frame: {txt}"));
            }
        }
    }

    if let Some(frame) = terminate_frame {
        let _ = write.send(Message::Text(frame.to_string().into())).await;
    }
    let _ = write.close().await;
    Ok(())
}

/// Verify a Deepgram API key: HTTP auth probe + WebSocket streaming probe.
pub(super) async fn verify_deepgram_key(api_key: String) -> Result<VerifyResult, String> {
    if api_key.trim().is_empty() {
        return Ok(VerifyResult {
            ok: false,
            http_ok: false,
            ws_ok: false,
            detail: "empty key".into(),
        });
    }
    let auth = format!("Token {api_key}");

    let http_err = http_probe("https://api.deepgram.com/v1/projects", &auth)
        .await
        .err();
    let http_ok = http_err.is_none();

    let mut ws_err: Option<String> = None;
    if http_ok {
        let url = url::Url::parse(
            "wss://api.deepgram.com/v1/listen?encoding=linear16&sample_rate=16000&channels=1",
        )
        .map_err(|e| e.to_string())?;
        // Deepgram auth via Sec-WebSocket-Protocol is supported but Authorization header works too.
        ws_err = ws_probe(url, ("Authorization", &auth), false, None)
            .await
            .err();
    }
    let ws_ok = http_ok && ws_err.is_none();

    let detail = match (&http_err, &ws_err) {
        (Some(h), _) => format!("HTTP probe failed: {h}"),
        (None, Some(w)) => format!("WebSocket probe failed: {w}"),
        (None, None) => "Deepgram key verified (HTTP + WebSocket).".into(),
    };

    Ok(VerifyResult {
        ok: http_ok && ws_ok,
        http_ok,
        ws_ok,
        detail,
    })
}

/// Verify an AssemblyAI API key: HTTP auth probe + WebSocket streaming probe.
pub(super) async fn verify_assemblyai_key(api_key: String) -> Result<VerifyResult, String> {
    if api_key.trim().is_empty() {
        return Ok(VerifyResult {
            ok: false,
            http_ok: false,
            ws_ok: false,
            detail: "empty key".into(),
        });
    }

    let http_err = http_probe("https://api.assemblyai.com/v2/transcript?limit=1", &api_key)
        .await
        .err();
    let http_ok = http_err.is_none();

    let mut ws_err: Option<String> = None;
    if http_ok {
        // v3 auth is via `token` query param, not an HTTP header.
        let mut url =
            url::Url::parse("wss://streaming.assemblyai.com/v3/ws").map_err(|e| e.to_string())?;
        {
            let mut q = url.query_pairs_mut();
            q.append_pair("token", &api_key);
            q.append_pair("sample_rate", "16000");
            q.append_pair("encoding", "pcm_s16le");
            q.append_pair("format_turns", "true");
        }
        let terminate = serde_json::json!({"type": "Terminate"}).to_string();
        // Pass a placeholder header (ignored): ws_probe requires a header tuple.
        ws_err = ws_probe(url, ("x-no-op", "1"), true, Some(&terminate))
            .await
            .err();
    }
    let ws_ok = http_ok && ws_err.is_none();

    let detail = match (&http_err, &ws_err) {
        (Some(h), _) => format!("HTTP probe failed: {h}"),
        (None, Some(w)) => format!("WebSocket probe failed: {w}"),
        (None, None) => "AssemblyAI key verified (HTTP + WebSocket).".into(),
    };

    Ok(VerifyResult {
        ok: http_ok && ws_ok,
        http_ok,
        ws_ok,
        detail,
    })
}

/// Verify an Anthropic Claude API key by hitting GET /v1/models.
/// No WebSocket layer — Claude is HTTP only.
pub(super) async fn verify_claude_key(api_key: String) -> Result<VerifyResult, String> {
    if api_key.trim().is_empty() {
        return Ok(VerifyResult {
            ok: false,
            http_ok: false,
            ws_ok: true,
            detail: "empty key".into(),
        });
    }

    let client = reqwest::Client::builder()
        .timeout(PROBE_TIMEOUT)
        .connect_timeout(std::time::Duration::from_secs(10))
        .http1_only()
        .build()
        .map_err(|e| e.to_string())?;
    let resp = client
        .get("https://api.anthropic.com/v1/models")
        .header("x-api-key", &api_key)
        .header("anthropic-version", "2023-06-01")
        .send()
        .await
        .map_err(|e| {
            use std::error::Error;
            let mut detail = format!("network: {e}");
            let mut src: Option<&dyn Error> = Error::source(&e);
            while let Some(s) = src {
                detail.push_str(&format!(" → {s}"));
                src = s.source();
            }
            detail
        });

    let (http_ok, detail) = match resp {
        Ok(r) if r.status().is_success() => (true, "Claude key verified.".into()),
        Ok(r) if r.status() == reqwest::StatusCode::UNAUTHORIZED => {
            (false, "Invalid key (401)".into())
        }
        Ok(r) => (false, format!("Unexpected HTTP {}", r.status())),
        Err(e) => (false, format!("HTTP probe failed: {e}")),
    };

    Ok(VerifyResult {
        ok: http_ok,
        http_ok,
        ws_ok: true,
        detail,
    })
}

/// Verify a DeepSeek API key by hitting GET /v1/models (OpenAI-compatible).
pub(super) async fn verify_deepseek_key(api_key: String) -> Result<VerifyResult, String> {
    if api_key.trim().is_empty() {
        return Ok(VerifyResult {
            ok: false,
            http_ok: false,
            ws_ok: true,
            detail: "empty key".into(),
        });
    }

    let client = reqwest::Client::builder()
        .timeout(PROBE_TIMEOUT)
        .connect_timeout(std::time::Duration::from_secs(10))
        .http1_only()
        .build()
        .map_err(|e| e.to_string())?;
    let resp = client
        .get("https://api.deepseek.com/v1/models")
        .bearer_auth(&api_key)
        .send()
        .await
        .map_err(|e| {
            use std::error::Error;
            let mut detail = format!("network: {e}");
            let mut src: Option<&dyn Error> = Error::source(&e);
            while let Some(s) = src {
                detail.push_str(&format!(" → {s}"));
                src = s.source();
            }
            detail
        });

    let (http_ok, detail) = match resp {
        Ok(r) if r.status().is_success() => (true, "DeepSeek key verified.".into()),
        Ok(r) if r.status() == reqwest::StatusCode::UNAUTHORIZED => {
            (false, "Invalid key (401)".into())
        }
        Ok(r) if r.status() == reqwest::StatusCode::FORBIDDEN => (
            false,
            "Forbidden (402/403) — check billing / balance".into(),
        ),
        Ok(r) => (false, format!("Unexpected HTTP {}", r.status())),
        Err(e) => (false, format!("HTTP probe failed: {e}")),
    };

    Ok(VerifyResult {
        ok: http_ok,
        http_ok,
        ws_ok: true,
        detail,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn empty_keys_are_rejected_without_network_access() {
        let results = [
            verify_deepgram_key(" ".into()).await.unwrap(),
            verify_assemblyai_key(" ".into()).await.unwrap(),
            verify_claude_key(" ".into()).await.unwrap(),
            verify_deepseek_key(" ".into()).await.unwrap(),
        ];
        for result in results {
            assert!(!result.ok);
            assert!(!result.http_ok);
            assert_eq!(result.detail, "empty key");
        }
    }
}
