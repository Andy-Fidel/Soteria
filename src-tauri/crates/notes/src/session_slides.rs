use rusqlite::params;
use serde::Serialize;

use crate::{Result, SessionDb};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionSlide {
    pub id: i64,
    pub session_id: i64,
    pub source_item_id: i64,
    pub item_data: String,
    pub saved_at: String,
}

impl SessionDb {
    pub(crate) fn migrate_session_slides(&self) -> Result<()> {
        let transaction = self.conn().unchecked_transaction()?;
        transaction.execute_batch(
            "CREATE TABLE IF NOT EXISTS session_slides (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id INTEGER NOT NULL REFERENCES sermon_sessions(id) ON DELETE CASCADE,
                source_item_id INTEGER NOT NULL,
                item_data TEXT NOT NULL,
                saved_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE INDEX IF NOT EXISTS idx_session_slides_session ON session_slides(session_id, source_item_id);",
        )?;
        // Capture inside the plan write transaction, including template copies.
        // No foreign key to plan items: removing a cue must not erase the slide.
        let capture = |source: &str| {
            format!(
            "INSERT INTO session_slides (session_id, source_item_id, item_data)
             SELECT p.plan_id, p.id, p.item_data FROM {source} p
             WHERE p.plan_kind = 'session' AND p.item_type = 'blank'
               AND EXISTS (SELECT 1 FROM sermon_sessions WHERE id = p.plan_id)
               AND CASE WHEN json_valid(p.item_data) THEN
                 json_type(p.item_data, '$.imageUrl') = 'text'
                 AND length(trim(COALESCE(json_extract(p.item_data, '$.imageUrl'), ''))) > 0
                 AND (COALESCE(json_type(p.item_data, '$.textOverlay'), 'null') = 'null'
                   OR length(trim(COALESCE(json_extract(p.item_data, '$.textOverlay.title'), ''))) > 0)
                 ELSE 0 END
               AND NOT EXISTS (SELECT 1 FROM session_slides s
                 WHERE s.session_id = p.plan_id AND s.source_item_id = p.id AND s.item_data = p.item_data);"
        )
        };
        for (name, event) in [("insert", "INSERT"), ("update", "UPDATE OF item_data")] {
            // Replace legacy definitions as well as installing them on new databases.
            transaction.execute_batch(&format!(
                "DROP TRIGGER IF EXISTS trg_session_slide_{name};
                 CREATE TRIGGER trg_session_slide_{name}
                 AFTER {event} ON service_plan_items BEGIN {} END;",
                capture("(SELECT * FROM service_plan_items WHERE id = NEW.id)")
            ))?;
        }
        transaction.execute_batch(&capture("service_plan_items"))?;
        transaction.commit()?;
        Ok(())
    }

    pub fn get_session_slides(&self, session_id: i64) -> Result<Vec<SessionSlide>> {
        let mut stmt = self.conn().prepare(
            "SELECT id, session_id, source_item_id, item_data, saved_at
             FROM session_slides WHERE session_id = ?1 ORDER BY id DESC",
        )?;
        let rows = stmt.query_map(params![session_id], |row| {
            Ok(SessionSlide {
                id: row.get(0)?,
                session_id: row.get(1)?,
                source_item_id: row.get(2)?,
                item_data: row.get(3)?,
                saved_at: row.get(4)?,
            })
        })?;
        Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
    }
}
