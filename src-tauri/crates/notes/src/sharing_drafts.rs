use crate::{Result, SessionDb};
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize, Serialize, PartialEq, Eq)]
pub struct SharingDraft {
    pub title: String,
    pub recap: String,
    pub sms: String,
}

impl SessionDb {
    pub fn get_sharing_draft(&self, session_id: i64) -> Result<Option<SharingDraft>> {
        Ok(self
            .conn()
            .query_row(
                "SELECT title, recap, sms FROM session_sharing_drafts WHERE session_id = ?1",
                [session_id],
                |row| {
                    Ok(SharingDraft {
                        title: row.get(0)?,
                        recap: row.get(1)?,
                        sms: row.get(2)?,
                    })
                },
            )
            .optional()?)
    }

    pub fn save_sharing_draft(&self, session_id: i64, draft: &SharingDraft) -> Result<()> {
        self.conn().execute(
            "INSERT INTO session_sharing_drafts (session_id, title, recap, sms) VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT(session_id) DO UPDATE SET title=excluded.title, recap=excluded.recap, sms=excluded.sms",
            params![session_id, draft.title, draft.recap, draft.sms],
        )?;
        Ok(())
    }
}
