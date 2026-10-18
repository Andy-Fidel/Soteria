use rhema_notes::{CreateSessionRequest, SessionDb};

fn session(db: &SessionDb, automatic: bool) -> i64 {
    let request: CreateSessionRequest = serde_json::from_value(serde_json::json!({
        "title": "Sunday service", "date": "2026-10-18", "titleIsAutomatic": automatic,
    }))
    .unwrap();
    let s = db.create_session(&request).unwrap();
    db.start_session(s.id).unwrap();
    s.id
}

#[test]
fn announced_title_replaces_only_a_live_automatic_name_once() {
    let dir = tempfile::tempdir().unwrap();
    let db = SessionDb::open(&dir.path().join("test.db")).unwrap();
    let id = session(&db, true);
    assert!(db
        .apply_announced_title(id, "Sunday service", "Faith in the Waiting", "")
        .unwrap());
    assert_eq!(db.get_session(id).unwrap().title, "Faith in the Waiting");
    assert!(!db
        .apply_announced_title(id, "Faith in the Waiting", "Another title", "")
        .unwrap());
}

#[test]
fn manual_names_stay_protected_after_reopen_and_when_a_request_is_pending() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("test.db");
    let db = SessionDb::open(&path).unwrap();
    let manual = session(&db, false);
    assert!(!db
        .apply_announced_title(manual, "Sunday service", "AI title", "")
        .unwrap());
    let id = session(&db, true);
    db.update_session_title(id, "My own name").unwrap();
    drop(db);
    let db = SessionDb::open(&path).unwrap();
    assert!(!db
        .apply_announced_title(id, "Sunday service", "AI title", "")
        .unwrap());
    assert!(!db
        .apply_announced_title(id, "My own name", "AI title", "")
        .unwrap());
    assert_eq!(db.get_session(id).unwrap().title, "My own name");
}

#[test]
fn completed_sessions_and_changed_names_reject_late_results() {
    let dir = tempfile::tempdir().unwrap();
    let db = SessionDb::open(&dir.path().join("test.db")).unwrap();
    let id = session(&db, true);
    assert!(!db
        .apply_announced_title(id, "wrong original name", "AI title", "")
        .unwrap());
    db.end_session(id).unwrap();
    assert!(!db
        .apply_announced_title(id, "Sunday service", "AI title", "")
        .unwrap());
}

#[test]
fn legacy_session_names_are_protected_by_migration() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("legacy.db");
    let db = SessionDb::open(&path).unwrap();
    let id = session(&db, true);
    drop(db);
    let conn = rusqlite::Connection::open(&path).unwrap();
    conn.execute("ALTER TABLE sermon_sessions DROP COLUMN title_source", [])
        .unwrap();
    drop(conn);
    let db = SessionDb::open(&path).unwrap();
    assert_eq!(db.get_session(id).unwrap().title_source, "manual");
    assert!(!db
        .apply_announced_title(id, "Sunday service", "AI title", "")
        .unwrap());
}

#[test]
fn adjoining_words_invalidate_an_inflight_partial_title() {
    let dir = tempfile::tempdir().unwrap();
    let db = SessionDb::open(&dir.path().join("test.db")).unwrap();
    let id = session(&db, true);
    let add = |text: &str, timestamp: i64| {
        db.add_transcript(
            &serde_json::from_value(serde_json::json!({
                "sessionId": id, "text": text, "isFinal": true, "confidence": 1,
                "timestampMs": timestamp, "speakerLabel": null,
            }))
            .unwrap(),
        )
        .unwrap();
    };
    add("My message today is titled Faith", 1);
    let partial = db.recent_title_transcript(id).unwrap();
    add("in the Waiting.", 2);
    assert!(!db
        .apply_announced_title(id, "Sunday service", "Faith", &partial)
        .unwrap());
    let full = db.recent_title_transcript(id).unwrap();
    assert!(db
        .apply_announced_title(id, "Sunday service", "Faith in the Waiting", &full)
        .unwrap());
}
