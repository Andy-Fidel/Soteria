//! Opt-in semantic checks use generated inputs and the real summary provider.
use super::summarize_sermon;

const LYRIC: &str = "Silver rivers of gladness, we sing to You tonight. Lift our grateful chorus, fill this house with light. ";
const TEACHING: &str = "Today we study Ephesians 4:32. Forgiveness is a decision to release retaliation, not a claim that harm was acceptable. Think of a neighbour who wronged you. Choosing revenge keeps the wound open. Begin by praying for that neighbour, then seek a truthful conversation. An apology can help reconciliation, but your decision to stop seeking revenge can begin before an apology arrives. Choose forgiveness even when an apology has not yet arrived.";

async fn summarize_with_size_recovery(api_key: &str, transcript: &str) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(super::REQUEST_TIMEOUT)
        .build()
        .unwrap();
    let mut section_injected = false;
    let mut merge_injected = false;
    let result = super::summary_sections::summarize_complete(
        transcript,
        "Operator-confirmed scripture presented: Ephesians 4:32",
        super::PROMPT_HEAD,
        |content, max_tokens| {
            // Force the reported failure at two boundaries; the actual provider
            // must recover from the original input and produce the final recap.
            let oversized = if !section_injected
                && content.contains("Transcript section ")
                && content.contains("Forgiveness is a decision to release retaliation")
            {
                section_injected = true;
                true
            } else if !merge_injected && content.contains("Merge these consecutive section notes:")
            {
                merge_injected = true;
                true
            } else {
                false
            };
            let client = &client;
            async move {
                if oversized {
                    Ok(
                        serde_json::json!({ "notes": "Oversized provider notes ".repeat(400) })
                            .to_string(),
                    )
                } else {
                    super::request_summary(
                        client,
                        api_key,
                        content,
                        max_tokens,
                        super::DEEPSEEK_ENDPOINT,
                    )
                    .await
                }
            }
        },
    )
    .await;
    assert!(
        section_injected && merge_injected,
        "Both size-recovery paths must be exercised"
    );
    result
}

#[tokio::test]
#[ignore = "uses DeepSeek with generated fixtures; requires DEEPSEEK_API_KEY"]
async fn live_worship_and_sermon_summaries() {
    let key = std::env::var("DEEPSEEK_API_KEY").expect("DEEPSEEK_API_KEY required");
    let fixtures = [
        ("worship_only", LYRIC.repeat(8), "worship"),
        ("mixed", format!("{} {TEACHING} {}", LYRIC.repeat(4), LYRIC.repeat(3)), "mixed"),
        ("repeated_teaching", format!("Trust God. Trust God. Trust God. Let me explain why repetition matters in teaching. {TEACHING}"), "sermon"),
        ("song_illustration", format!("A song uses the image 'silver rivers of gladness'. I am quoting an image, not leading a song. But forgiveness is not merely a feeling. {TEACHING}"), "sermon"),
        ("announcements_and_prayer", "The car park closes at noon. Please move your cars before then. Let us pray: God, thank You for this gathering. Keep everyone safe on the journey home. Amen.".into(), "other"),
        ("long_mixed", format!("{} {TEACHING} {}", LYRIC.repeat(240), LYRIC.repeat(240)), "mixed"),
    ];
    for (name, transcript, expected) in fixtures {
        let raw = if name == "long_mixed" {
            summarize_with_size_recovery(&key, &transcript).await
        } else {
            summarize_sermon(
                key.clone(),
                transcript.clone(),
                Some(vec!["Ephesians 4:32".into()]),
            )
            .await
        }
        .expect("Summary request failed");
        let json: serde_json::Value = serde_json::from_str(&raw).expect("Summary must be JSON");
        if expected == "worship" || expected == "other" {
            assert!(
                json["sermon_flow"]["main_points"]
                    .as_array()
                    .map_or(true, Vec::is_empty),
                "{name}: invented sermon points"
            );
            assert!(
                json["takeaways"].as_array().map_or(true, Vec::is_empty),
                "{name}: invented takeaways"
            );
            assert!(
                json["quotes"].as_array().map_or(true, Vec::is_empty),
                "{name}: attributed worship to preacher"
            );
            assert!(
                json["key_verses"].as_array().map_or(true, Vec::is_empty),
                "{name}: presented scripture became a sermon key verse without teaching"
            );
            assert!(
                json["devotional"]
                    .as_object()
                    .map_or(true, |fields| fields.values().all(|value| {
                        value.as_str().is_some_and(|text| text.trim().is_empty())
                            || value.as_array().is_some_and(Vec::is_empty)
                    })),
                "{name}: invented a sermon devotional"
            );
        } else {
            assert!(
                !json["sermon_flow"]["main_points"]
                    .as_array()
                    .map_or(true, Vec::is_empty),
                "{name}: discarded real teaching"
            );
            let points = json["sermon_flow"]["main_points"]
                .to_string()
                .to_lowercase();
            assert!(
                points.contains("forgiv"),
                "{name}: actual forgiveness teaching was lost"
            );
            if name != "song_illustration" {
                assert!(
                    !points.contains("silver rivers"),
                    "{name}: lyric became a sermon point"
                );
            }
            assert!(
                !json["quotes"]
                    .to_string()
                    .to_lowercase()
                    .contains("silver rivers"),
                "{name}: lyric attributed to preacher"
            );
        }
        assert_eq!(
            json["session_content"], expected,
            "{name}: wrong content classification"
        );
        println!(
            "{name}: passed ({expected}, {} UTF-8 bytes)",
            transcript.len()
        );
    }
}
