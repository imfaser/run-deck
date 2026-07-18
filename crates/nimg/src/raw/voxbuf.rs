use crate::raw::types::{VolumeShape, Voxel};

/// An owned, typed voxel buffer. Generic over the voxel element type.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct VoxBuf<T: Voxel> {
    pub shape: VolumeShape,
    pub data: Vec<T>,
}

impl<T: Voxel> VoxBuf<T> {
    /// Create a new `VoxBuf`. Returns an error if `data.len() != shape.total_voxels()`.
    #[must_use]
    pub fn new(shape: VolumeShape, data: Vec<T>) -> Self {
        debug_assert_eq!(
            data.len(),
            shape.total_voxels(),
            "VoxBuf data length {} does not match shape {} (expected {})",
            data.len(),
            shape,
            shape.total_voxels()
        );
        Self { shape, data }
    }

    /// Compute flat index for (z, y, x) in C-order layout.
    #[must_use]
    pub fn index_of(&self, z: usize, y: usize, x: usize) -> usize {
        z * self.shape.y * self.shape.x + y * self.shape.x + x
    }

    /// Get voxel value at (z, y, x).
    #[must_use]
    pub fn get(&self, z: usize, y: usize, x: usize) -> T {
        self.data[self.index_of(z, y, x)]
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn voxbuf_new_valid() {
        let data = vec![0u8; 27];
        let buf = VoxBuf::new(VolumeShape::new(3, 3, 3), data);
        assert_eq!(buf.shape, VolumeShape::new(3, 3, 3));
    }

    #[test]
    #[should_panic]
    fn voxbuf_new_invalid_length() {
        let data = vec![0u8; 10];
        let _buf = VoxBuf::new(VolumeShape::new(3, 3, 3), data);
    }

    #[test]
    fn index_of_calculation() {
        let data = vec![0u8; 27];
        let buf = VoxBuf::new(VolumeShape::new(3, 3, 3), data);
        assert_eq!(buf.index_of(0, 0, 0), 0);
        assert_eq!(buf.index_of(0, 0, 1), 1);
        assert_eq!(buf.index_of(0, 1, 0), 3);
        assert_eq!(buf.index_of(1, 0, 0), 9);
        assert_eq!(buf.index_of(2, 2, 2), 26);
    }

    #[test]
    fn get_value() {
        let data: Vec<u8> = (0..27).collect();
        let buf = VoxBuf::new(VolumeShape::new(3, 3, 3), data);
        assert_eq!(buf.get(0, 0, 0), 0);
        assert_eq!(buf.get(0, 0, 1), 1);
        assert_eq!(buf.get(1, 1, 1), 13);
        assert_eq!(buf.get(2, 2, 2), 26);
    }
}
