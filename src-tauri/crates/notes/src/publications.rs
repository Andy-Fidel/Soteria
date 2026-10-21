use crate::{Result, SessionDb};
use rusqlite::OptionalExtension;
use serde::Serialize;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionPublication {
    pub id: String,
    pub url: Option<String>,
    pub published_at: Option<String>,
}
impl SessionDb {
    pub fn get_publication(&self, session_id: i64) -> Result<Option<SessionPublication>> {
        Ok(self.conn().query_row("SELECT publication_id, url, published_at FROM session_publications WHERE session_id=?1",[session_id], |row| Ok(SessionPublication{id:row.get(0)?,url:row.get(1)?,published_at:row.get(2)?})).optional()?)
    }
    pub fn ensure_publication(&self, session_id: i64, id: &str) -> Result<SessionPublication> {
        self.conn().execute("INSERT INTO session_publications (session_id,publication_id) VALUES (?1,?2) ON CONFLICT(session_id) DO NOTHING",rusqlite::params![session_id,id])?;
        self.get_publication(session_id)?
            .ok_or_else(|| crate::SessionError::NotFound("Session publication".into()))
    }
    pub fn mark_published(&self, session_id: i64, url: &str, published_at: &str) -> Result<()> {
        self.conn().execute(
            "UPDATE session_publications SET url=?2,published_at=?3 WHERE session_id=?1",
            rusqlite::params![session_id, url, published_at],
        )?;
        Ok(())
    }
}
