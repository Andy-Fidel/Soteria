use reqwest::{Client, Method};
use serde::Deserialize;
use serde_json::{json, Value};
use std::time::Duration;
mod list;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct Preview {
    #[serde(alias = "parts")]
    pub segments: u32,
    #[serde(alias = "totalCost", deserialize_with = "decimal_cost")]
    pub estimated_cost: f64,
    pub currency: String,
}
fn decimal_cost<'de, D: serde::Deserializer<'de>>(deserializer: D) -> Result<f64, D::Error> {
    #[derive(Deserialize)]
    #[serde(untagged)]
    enum Cost {
        Number(f64),
        Text(String),
    }
    match Cost::deserialize(deserializer)? {
        Cost::Number(value) => Ok(value),
        Cost::Text(value) => value.trim().parse().map_err(serde::de::Error::custom),
    }
}
#[derive(Deserialize)]
pub(super) struct Sent {
    pub id: String,
    pub status: String,
}
#[derive(Debug)]
pub(super) struct ProviderError {
    pub message: String,
    pub uncertain: bool,
}
impl ProviderError {
    fn unknown(message: impl Into<String>) -> Self {
        Self {
            message: message.into(),
            uncertain: true,
        }
    }
}
pub(super) struct CommsClient {
    client: Client,
    key: String,
    base: String,
}
impl CommsClient {
    pub fn new(key: &str) -> Result<Self, String> {
        Ok(Self {
            client: Client::builder()
                .timeout(Duration::from_secs(25))
                .redirect(reqwest::redirect::Policy::none())
                .build()
                .map_err(|_| "Could not prepare SMS connection.")?,
            key: key.into(),
            base: "https://backend.comms360.africa/api/v1".into(),
        })
    }
    async fn request(
        &self,
        method: Method,
        path: &str,
        body: Option<Value>,
        key: Option<&str>,
    ) -> Result<Value, ProviderError> {
        let value = self.request_envelope(method, path, body, key).await?;
        if !value["data"].is_object() {
            return Err(ProviderError::unknown(
                "Comms360 returned an unexpected response.",
            ));
        }
        Ok(value["data"].clone())
    }
    async fn request_envelope(
        &self,
        method: Method,
        path: &str,
        body: Option<Value>,
        key: Option<&str>,
    ) -> Result<Value, ProviderError> {
        let mut request = self
            .client
            .request(method, format!("{}{path}", self.base))
            .header("Authorization", format!("ApiKey {}", self.key));
        if let Some(body) = body {
            request = request.json(&body);
        }
        if let Some(key) = key {
            request = request.header("Idempotency-Key", key);
        }
        let response = request.send().await.map_err(|_| ProviderError::unknown("Comms360 could not be reached. If a send was in progress, retry only its saved test reference."))?;
        if !response.status().is_success() {
            let status = response.status().as_u16();
            let message = match status {
                401 | 403 => "Comms360 rejected the API key or permission. Check Settings → API Keys.",
                402 => "The Comms360 wallet has insufficient balance.",
                409 => "Comms360 is still processing this request. Wait, then check or retry this saved test.",
                400 | 422 => "Comms360 rejected the number, message, or sender ID. Check that the sender ID is approved.",
                429 => "Comms360 is busy. Wait before retrying this saved test.",
                _ => "Comms360 returned an error. Check the saved test before retrying.",
            }.into();
            return Err(ProviderError {
                message,
                uncertain: !matches!(status, 400 | 401 | 402 | 403 | 404 | 422),
            });
        }
        let value: Value = response.json().await.map_err(|_| {
            ProviderError::unknown(
                "Comms360 returned an unreadable response. Check the saved test before retrying.",
            )
        })?;
        if value["success"] != true || !(value["data"].is_object() || value["data"].is_array()) {
            return Err(ProviderError::unknown(
                "Comms360 did not confirm this request. Check the saved test before retrying.",
            ));
        }
        Ok(value)
    }
    pub async fn preview(
        &self,
        phone: &str,
        message: &str,
        sender: &str,
    ) -> Result<Preview, String> {
        let data = self
            .request(
                Method::POST,
                "/sms/preview",
                Some(json!({"to":phone,"message":message,"senderId":sender})),
                None,
            )
            .await
            .map_err(|error| error.message)?;
        let preview: Preview = serde_json::from_value(data)
            .map_err(|_| "Comms360 returned an incomplete cost preview.")?;
        if !preview.estimated_cost.is_finite()
            || preview.estimated_cost < 0.0
            || preview.currency.trim().is_empty()
            || preview.currency.len() > 32
            || preview.currency.chars().any(char::is_control)
        {
            return Err("Comms360 returned an invalid cost preview.".into());
        }
        Ok(preview)
    }
    pub async fn send(
        &self,
        phone: &str,
        message: &str,
        sender: &str,
        key: &str,
    ) -> Result<Sent, ProviderError> {
        let data = self.request(Method::POST, "/sms", Some(json!({"to":phone,"message":message,"senderId":sender,"label":"NOTIFICATION","disableUrl":true})), Some(key)).await?;
        parse_sent(data).map_err(ProviderError::unknown)
    }
    pub async fn status(&self, id: &str) -> Result<Sent, String> {
        if id.is_empty()
            || id.len() > 200
            || !id
                .bytes()
                .all(|c| c.is_ascii_alphanumeric() || c == b'_' || c == b'-')
        {
            return Err("Invalid Comms360 message reference.".into());
        }
        let sent = parse_sent(
            self.request(Method::GET, &format!("/sms/{id}"), None, None)
                .await
                .map_err(|error| error.message)?,
        )?;
        if sent.id != id {
            return Err("Comms360 returned a different message reference.".into());
        }
        Ok(sent)
    }
    #[cfg(test)]
    pub fn with_base(key: &str, base: String) -> Self {
        let mut client = Self::new(key).unwrap();
        client.base = base;
        client
    }
}
fn parse_sent(data: Value) -> Result<Sent, String> {
    let sent: Sent = serde_json::from_value(data).map_err(|_| {
        "Comms360 returned an incomplete send status. Check the saved test before retrying."
    })?;
    if sent.id.is_empty()
        || !matches!(
            sent.status.as_str(),
            "QUEUED" | "DISPATCHED" | "DELIVERED" | "FAILED"
        )
    {
        return Err(
            "Comms360 returned an unknown send status. Check the saved test before retrying."
                .into(),
        );
    }
    Ok(sent)
}
