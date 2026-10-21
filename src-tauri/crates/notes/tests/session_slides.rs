use rhema_notes::{CreateSessionRequest, PlanItemType, PlanKind, SessionDb};

fn session(db: &SessionDb) -> i64 {
    let req: CreateSessionRequest = serde_json::from_value(serde_json::json!({
        "title": "Sunday", "date": "2026-10-19"
    }))
    .unwrap();
    db.create_session(&req).unwrap().id
}
fn slide(title: &str) -> String {
    serde_json::json!({"type":"blank", "imageUrl":"/service-slides/starburst-black.png",
        "textOverlay":{"layout":"title","title":title,"body":"Pastor John Kennedy"}})
    .to_string()
}

#[test]
fn saved_versions_survive_plan_deletion_and_reopen_but_follow_session_deletion() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("sessions.db");
    let db = SessionDb::open(&path).unwrap();
    let id = session(&db);
    let other = session(&db);
    let item = db
        .add_plan_item(
            id,
            PlanKind::Session,
            PlanItemType::Blank,
            &slide("First"),
            1.0,
            None,
        )
        .unwrap();
    db.update_plan_item(item.id, &slide("Second"), None)
        .unwrap();
    db.update_plan_item(item.id, &slide("Second"), Some(10))
        .unwrap();
    db.delete_plan_item(item.id).unwrap();
    drop(db);
    let db = SessionDb::open(&path).unwrap();
    let saved = db.get_session_slides(id).unwrap();
    assert_eq!(saved.len(), 2);
    assert!(saved[0].item_data.contains("Second"));
    assert!(saved[1].item_data.contains("First"));
    assert!(db.get_session_slides(other).unwrap().is_empty());
    db.delete_session(id).unwrap();
    assert!(db.get_session_slides(id).unwrap().is_empty());
}

#[test]
fn skips_unfinished_titles_templates_invalid_json_and_non_image_items() {
    let db = SessionDb::open(&tempfile::tempdir().unwrap().path().join("test.db")).unwrap();
    let id = session(&db);
    for data in [slide(""), "{}".into(), "invalid json".into()] {
        db.add_plan_item(id, PlanKind::Session, PlanItemType::Blank, &data, 1.0, None)
            .unwrap();
    }
    let template = db.create_template("Template", None).unwrap();
    db.add_plan_item(
        template.id,
        PlanKind::Template,
        PlanItemType::Blank,
        &slide("Template"),
        1.0,
        None,
    )
    .unwrap();
    assert!(db.get_session_slides(id).unwrap().is_empty());
    db.add_plan_item(
        id,
        PlanKind::Session,
        PlanItemType::Blank,
        r#"{"type":"blank","imageUrl":"data:image/png;base64,abc","imageLabel":"Welcome"}"#,
        2.0,
        None,
    )
    .unwrap();
    assert_eq!(db.get_session_slides(id).unwrap().len(), 1);
}

#[test]
fn migration_backfills_existing_slides_once_and_template_copies_are_retained() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("test.db");
    let mut db = SessionDb::open(&path).unwrap();
    let id = session(&db);
    let template = db.create_template("Template", None).unwrap();
    db.add_plan_item(
        template.id,
        PlanKind::Template,
        PlanItemType::Blank,
        &slide("Copied"),
        1.0,
        None,
    )
    .unwrap();
    db.load_template_into_session(id, template.id).unwrap();
    assert_eq!(db.get_session_slides(id).unwrap().len(), 1);
    drop(db);
    // Simulate a database from before the gallery migration.
    let conn = rusqlite::Connection::open(&path).unwrap();
    conn.execute_batch("DROP TRIGGER trg_session_slide_insert; DROP TRIGGER trg_session_slide_update; DROP TABLE session_slides;").unwrap();
    drop(conn);
    let db = SessionDb::open(&path).unwrap();
    assert_eq!(db.get_session_slides(id).unwrap().len(), 1);
    drop(db);
    let db = SessionDb::open(&path).unwrap();
    assert_eq!(db.get_session_slides(id).unwrap().len(), 1);
}

#[test]
fn reopening_repairs_legacy_new_table_triggers_without_losing_saved_slides() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("sessions.db");
    let db = SessionDb::open(&path).unwrap();
    let id = session(&db);
    let existing = db
        .add_plan_item(
            id,
            PlanKind::Session,
            PlanItemType::Blank,
            &slide("Preserved"),
            1.0,
            None,
        )
        .unwrap();
    drop(db);

    let conn = rusqlite::Connection::open(&path).unwrap();
    for (name, event) in [("insert", "INSERT"), ("update", "UPDATE OF item_data")] {
        conn.execute_batch(&format!(
            "DROP TRIGGER trg_session_slide_{name};
             CREATE TRIGGER trg_session_slide_{name} AFTER {event} ON service_plan_items
             BEGIN INSERT INTO session_slides (session_id, source_item_id, item_data)
               SELECT plan_id, id, item_data FROM (SELECT NEW.*); END;"
        ))
        .unwrap();
    }
    drop(conn);

    let db = SessionDb::open(&path).unwrap();
    db.add_plan_item(
        id,
        PlanKind::Session,
        PlanItemType::Blank,
        &slide("New slide"),
        2.0,
        None,
    )
    .unwrap();
    db.update_plan_item(existing.id, &slide("Updated"), None)
        .unwrap();
    let saved = db.get_session_slides(id).unwrap();
    assert_eq!(saved.len(), 3);
    assert!(saved.iter().any(|row| row.item_data.contains("Preserved")));
    assert!(saved.iter().any(|row| row.item_data.contains("New slide")));
    assert!(saved.iter().any(|row| row.item_data.contains("Updated")));
    drop(db);
    let db = SessionDb::open(&path).unwrap();
    assert_eq!(db.get_session_slides(id).unwrap().len(), 3);
    assert_eq!(db.get_session(id).unwrap().title, "Sunday");
}
