use std::sync::Mutex;

use nimg::raw::{Axis, RawVolume};

pub struct VolumeEntry {
    pub volume_id: String,
    pub path: String,
    pub volume: RawVolume,
    pub axis: Axis,
    pub voxel_size: usize,
    pub total_slices: usize,
    pub slice_width: usize,
    pub slice_height: usize,
}

pub struct VolumeStore {
    inner: Mutex<Option<VolumeEntry>>,
}

impl VolumeStore {
    pub fn new() -> Self {
        Self {
            inner: Mutex::new(None),
        }
    }

    /// Replace the current volume entry, returning the old one if present.
    /// The old entry's mmap handle is dropped, releasing resources.
    pub fn replace(&self, entry: VolumeEntry) -> Option<VolumeEntry> {
        let mut guard = self.inner.lock().expect("volume store lock poisoned");
        guard.replace(entry)
    }

    /// Close the current volume and return its entry.
    pub fn close(&self) -> Option<VolumeEntry> {
        let mut guard = self.inner.lock().expect("volume store lock poisoned");
        guard.take()
    }

    /// Borrow the inner mutex guard for direct access.
    pub fn lock(&self) -> std::sync::MutexGuard<'_, Option<VolumeEntry>> {
        self.inner.lock().expect("volume store lock poisoned")
    }
}
