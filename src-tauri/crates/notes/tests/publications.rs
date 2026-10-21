use rhema_notes::{CreateSessionRequest, SessionDb};
#[test]
fn retries_and_reopens_reuse_the_same_page_and_keep_other_sessions_separate() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("test.db");
    let db = SessionDb::open(&path).unwrap();
    let request: CreateSessionRequest =
        serde_json::from_value(serde_json::json!({"title":"Faith","date":"2026-10-19"})).unwrap();
    let id = db.create_session(&request).unwrap().id;
    let other = db.create_session(&request).unwrap().id;
    assert_eq!(
        db.ensure_publication(id, "d89b7ee6b9064643").unwrap().id,
        "d89b7ee6b9064643"
    );
    assert_eq!(
        db.ensure_publication(id, "anotherid").unwrap().id,
        "d89b7ee6b9064643"
    );
    db.mark_published(
        id,
        "https://sermon.ewcadenta.com/s/d89b7ee6b9064643",
        "2026-10-19T12:00:00Z",
    )
    .unwrap();
    drop(db);
    let db = SessionDb::open(&path).unwrap();
    assert_eq!(
        db.get_publication(id).unwrap().unwrap().url.as_deref(),
        Some("https://sermon.ewcadenta.com/s/d89b7ee6b9064643")
    );
    assert!(db.get_publication(other).unwrap().is_none());
    db.delete_session(id).unwrap();
    assert!(db.get_publication(id).unwrap().is_none());
}
