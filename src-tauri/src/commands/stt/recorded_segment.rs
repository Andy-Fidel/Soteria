//! Persist sample timing alongside each pause/resume recording segment.
use std::path::{Path, PathBuf};

use crate::commands::recording::timeline::SegmentTiming;
use rhema_audio::{AudioFrame, Mp3Writer, Mp3WriterError};

pub(super) struct RecordedSegment {
    writer: Mp3Writer,
    path: PathBuf,
    timing: SegmentTiming,
    checkpoint_samples: u64,
}

impl RecordedSegment {
    pub fn create(path: &Path, sample_rate: u32) -> Result<Self, Mp3WriterError> {
        Ok(Self {
            writer: Mp3Writer::create(path, sample_rate)?,
            path: path.to_path_buf(),
            timing: SegmentTiming::new(sample_rate),
            checkpoint_samples: 0,
        })
    }

    pub fn write_frame(&mut self, frame: &AudioFrame) -> Result<(), Mp3WriterError> {
        self.writer.write_samples(&frame.samples)?;
        self.timing
            .record_frame(frame.timestamp_ms, frame.samples.len());
        // Checkpoint once per second so a crash still leaves useful provenance.
        if self.checkpoint_samples == 0
            || self
                .timing
                .sample_count()
                .saturating_sub(self.checkpoint_samples)
                >= 16_000
        {
            self.save_timing();
            self.checkpoint_samples = self.timing.sample_count();
        }
        Ok(())
    }

    fn save_timing(&self) {
        if let Err(error) = self.timing.save(&self.path) {
            log::warn!(
                "[REC] could not save timing {}: {error}",
                self.path.display()
            );
        }
    }

    pub fn finalize(self) -> Result<(), Mp3WriterError> {
        let Self {
            writer,
            path,
            timing,
            ..
        } = self;
        let result = writer.finalize();
        if let Err(error) = timing.save(&path) {
            log::warn!("[REC] could not save timing {}: {error}", path.display());
        }
        result
    }
}
