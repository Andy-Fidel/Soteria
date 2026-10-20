use std::path::Path;
use std::sync::Mutex;

use rusqlite::{Connection, OpenFlags};

use crate::error::BibleError;

pub struct BibleDb {
    pub(crate) conn: Mutex<Connection>,
}

impl std::fmt::Debug for BibleDb {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("BibleDb").finish_non_exhaustive()
    }
}

impl BibleDb {
    pub fn open(path: &Path) -> Result<Self, BibleError> {
        // Shipped Bible resources must remain unchanged inside a signed app bundle.
        let conn = Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_ONLY)?;
        Ok(Self {
            conn: Mutex::new(conn),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn opening_a_bundled_database_does_not_allow_writes_or_create_journals() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("bible.db");
        let source = Connection::open(&path).unwrap();
        source
            .execute_batch("CREATE TABLE example (id INTEGER); INSERT INTO example VALUES (1);")
            .unwrap();
        drop(source);

        let database = BibleDb::open(&path).unwrap();
        let connection = database.conn.lock().unwrap();
        assert_eq!(
            connection
                .query_row("SELECT id FROM example", [], |row| row.get::<_, i32>(0))
                .unwrap(),
            1
        );
        assert!(connection
            .execute("INSERT INTO example VALUES (2)", [])
            .is_err());
        assert!(!directory.path().join("bible.db-wal").exists());
        assert!(!directory.path().join("bible.db-shm").exists());
    }

    #[test]
    fn missing_bundled_database_is_not_silently_created() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("missing.db");
        assert!(BibleDb::open(&path).is_err());
        assert!(!path.exists());
    }
}
