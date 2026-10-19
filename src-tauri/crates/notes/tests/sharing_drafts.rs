use rhema_notes::{CreateSessionRequest, SessionDb, SharingDraft};

#[test]
fn drafts_survive_reopen_stay_with_their_session_and_do_not_replace_summary() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("drafts.db");
    let db = SessionDb::open(&path).unwrap();
    let request: CreateSessionRequest =
        serde_json::from_value(serde_json::json!({"title":"Sunday","date":"2026-10-19"})).unwrap();
    let id = db.create_session(&request).unwrap().id;
    let other = db.create_session(&request).unwrap().id;
    db.update_session_summary(id, "original summary").unwrap();
    let draft = SharingDraft {
        title: "Faith".into(),
        recap: "First draft".into(),
        sms: "Walk by faith.".into(),
    };
    db.save_sharing_draft(id, &draft).unwrap();
    let edited = SharingDraft {
        recap: "Reviewed draft".into(),
        ..draft
    };
    db.save_sharing_draft(id, &edited).unwrap();
    drop(db);
    let db = SessionDb::open(&path).unwrap();
    assert_eq!(db.get_sharing_draft(id).unwrap(), Some(edited));
    assert_eq!(db.get_sharing_draft(other).unwrap(), None);
    assert_eq!(
        db.get_session(id).unwrap().summary.as_deref(),
        Some("original summary")
    );
    db.delete_session(id).unwrap();
    assert_eq!(db.get_sharing_draft(id).unwrap(), None);
}
