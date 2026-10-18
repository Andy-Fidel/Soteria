use super::*;

fn setup() -> (tempfile::TempDir, SessionDb, SermonSession) {
    let dir = tempfile::tempdir().unwrap();
    let db = SessionDb::open(&dir.path().join("titles.db")).unwrap();
    let session = db
        .create_session(
            &serde_json::from_value(serde_json::json!({
                "title": "Service", "date": "2026-10-18", "titleIsAutomatic": true,
            }))
            .unwrap(),
        )
        .unwrap();
    let session = db.start_session(session.id).unwrap();
    (dir, db, session)
}

fn add_words(db: &SessionDb, id: i64, text: &str) {
    db.add_transcript(
        &serde_json::from_value(serde_json::json!({
            "sessionId": id, "text": text, "isFinal": true,
            "confidence": 1, "timestampMs": 1, "speakerLabel": null,
        }))
        .unwrap(),
    )
    .unwrap();
}

#[test]
fn a_valid_title_from_changed_source_requests_a_fresh_check_without_renaming() {
    let (_dir, db, session) = setup();
    add_words(&db, session.id, "My message today is titled Faith");
    let context = db.recent_title_transcript(session.id).unwrap();
    add_words(&db, session.id, "in the Waiting.");
    assert!(matches!(
        finish_title(&db, &session, &context, Some("Faith")).unwrap(),
        TitleDetection::Stale
    ));
    assert_eq!(db.get_session(session.id).unwrap().title, "Service");
}

#[test]
fn unchanged_source_applies_and_serializes_the_title() {
    let (_dir, db, session) = setup();
    add_words(
        &db,
        session.id,
        "My message today is titled Faith in the Waiting.",
    );
    let context = db.recent_title_transcript(session.id).unwrap();
    let response = finish_title(&db, &session, &context, Some("Faith in the Waiting")).unwrap();
    let json = serde_json::to_value(response).unwrap();
    assert_eq!(json["status"], "applied");
    assert_eq!(json["session"]["title"], "Faith in the Waiting");
    assert_eq!(
        db.get_session(session.id).unwrap().title_source,
        "announced"
    );
}

#[test]
fn manual_names_and_ended_sessions_reject_late_results_without_a_retry() {
    for manual in [true, false] {
        let (_dir, db, session) = setup();
        if manual {
            db.update_session_title(session.id, "My own title").unwrap();
        } else {
            db.end_session(session.id).unwrap();
        }
        assert!(matches!(
            finish_title(&db, &session, "", Some("Faith")).unwrap(),
            TitleDetection::Rejected
        ));
    }
}

#[test]
fn a_rejected_announcement_is_not_retried_just_because_source_grew() {
    let (_dir, db, session) = setup();
    add_words(&db, session.id, "That was last week's sermon.");
    assert!(matches!(
        finish_title(&db, &session, "", None).unwrap(),
        TitleDetection::Rejected
    ));
}
