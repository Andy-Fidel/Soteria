use super::{CommsClient, ProviderError};
use reqwest::Method;
use serde::Deserialize;
use serde_json::json;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ListPreview {
    pub total_recipients: u32,
    #[serde(alias = "totalSegments")]
    pub total_parts: u32,
    #[serde(
        alias = "totalCost",
        alias = "estimatedCost",
        deserialize_with = "super::decimal_cost"
    )]
    pub total_estimated_cost: f64,
    pub currency: String,
}
#[derive(Deserialize)]
pub(crate) struct ListAccepted {
    #[serde(alias = "campaignId")]
    pub id: String,
    pub status: String,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ListProgress {
    pub id: String,
    pub status: String,
    pub total_recipients: u32,
    pub total_sent: u32,
    pub total_failed: u32,
}
fn valid_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 200
        && id
            .bytes()
            .all(|c| c.is_ascii_alphanumeric() || c == b'_' || c == b'-')
}
impl CommsClient {
    pub async fn preview_list(
        &self,
        list: &str,
        message: &str,
        sender: &str,
    ) -> Result<ListPreview, String> {
        let data = self.request(Method::POST, "/campaigns/sms/preview", Some(json!({"name":"Soteria service recap","contactListId":list,"message":message,"senderId":sender})), None).await.map_err(|error| error.message)?;
        let preview: ListPreview = serde_json::from_value(data)
            .map_err(|_| "Comms360 returned an incomplete list preview.")?;
        if preview.total_recipients == 0 || preview.total_recipients > 10000 {
            return Err("The contact list must contain between 1 and 10,000 recipients.".into());
        }
        if preview.total_parts != preview.total_recipients {
            return Err("Shorten the message so each recipient receives one SMS part.".into());
        }
        if !preview.total_estimated_cost.is_finite()
            || preview.total_estimated_cost < 0.0
            || preview.currency.trim().is_empty()
            || preview.currency.len() > 32
            || preview.currency.chars().any(char::is_control)
        {
            return Err("Comms360 returned an invalid list cost preview.".into());
        }
        Ok(preview)
    }
    pub async fn send_list(
        &self,
        list: &str,
        message: &str,
        sender: &str,
        key: &str,
    ) -> Result<ListAccepted, ProviderError> {
        let data = self.request(Method::POST, "/campaigns/sms", Some(json!({"name":"Soteria service recap","contactListId":list,"message":message,"senderId":sender})), Some(key)).await?;
        let accepted: ListAccepted = serde_json::from_value(data).map_err(|_| {
            ProviderError::unknown(
                "Comms360 did not return a send reference. Retry only this saved submission.",
            )
        })?;
        if !valid_id(&accepted.id) {
            return Err(ProviderError::unknown(
                "Comms360 returned an invalid send reference. Retry only this saved submission.",
            ));
        }
        Ok(accepted)
    }
    pub async fn list_progress(&self, id: &str) -> Result<ListProgress, String> {
        if !valid_id(id) {
            return Err("Invalid SMS send reference.".into());
        }
        let data = self
            .request(Method::GET, &format!("/campaigns/sms/{id}"), None, None)
            .await
            .map_err(|error| error.message)?;
        let progress: ListProgress = serde_json::from_value(data)
            .map_err(|_| "Comms360 returned an incomplete progress update.")?;
        if progress.id != id {
            return Err("Comms360 returned a different send reference.".into());
        }
        Ok(progress)
    }
    pub async fn list_delivered(&self, id: &str) -> Result<u32, String> {
        if !valid_id(id) {
            return Err("Invalid SMS send reference.".into());
        }
        let response = self
            .request_envelope(
                Method::GET,
                &format!("/campaigns/sms/{id}/contacts?limit=1&status=DELIVERED"),
                None,
                None,
            )
            .await
            .map_err(|error| error.message)?;
        response["pagination"]["total"]
            .as_u64()
            .and_then(|value| u32::try_from(value).ok())
            .ok_or_else(|| "Comms360 did not provide a delivery receipt count.".into())
    }
}
