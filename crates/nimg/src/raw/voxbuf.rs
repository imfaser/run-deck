use ndarray::Array3;

use crate::raw::types::{VolumeShape, Voxel};

/// An owned, typed voxel buffer backed by an `Array3<T>`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct VoxBuf<T: Voxel> {
    pub shape: VolumeShape,
    pub inner: Array3<T>,
}

impl<T: Voxel> VoxBuf<T> {
    /// Create a new `VoxBuf` from a shape and flat data vector.
    ///
    /// # Panics
    ///
    /// Panics if `data.len() != shape.total_voxels()`.
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
        let inner = Array3::from_shape_vec((shape.z, shape.y, shape.x), data)
            .expect("VoxBuf: data length mismatch shape");
        Self { shape, inner }
    }

    /// Create a `VoxBuf` from an existing `Array3`.
    #[must_use]
    pub fn from_array(shape: VolumeShape, inner: Array3<T>) -> Self {
        Self { shape, inner }
    }

    /// Get voxel value at (z, y, x).
    #[must_use]
    pub fn get(&self, z: usize, y: usize, x: usize) -> T {
        self.inner[[z, y, x]]
    }

    /// Return a flat view of the underlying data (C-order).
    ///
    /// # Panics
    ///
    /// Panics if the array is not contiguous (should not happen for arrays
    /// created via `new` or `from_array` with C-order layout).
    #[must_use]
    pub fn as_slice(&self) -> &[T] {
        self.inner.as_slice().expect("VoxBuf data must be contiguous")
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
    fn get_value() {
        let data: Vec<u8> = (0..27).collect();
        let buf = VoxBuf::new(VolumeShape::new(3, 3, 3), data);
        assert_eq!(buf.get(0, 0, 0), 0);
        assert_eq!(buf.get(0, 0, 1), 1);
        assert_eq!(buf.get(0, 1, 0), 3);
        assert_eq!(buf.get(1, 0, 0), 9);
        assert_eq!(buf.get(1, 1, 1), 13);
        assert_eq!(buf.get(2, 2, 2), 26);
    }

    #[test]
    fn as_slice_c_order() {
        let data: Vec<u8> = (0..27).collect();
        let buf = VoxBuf::new(VolumeShape::new(3, 3, 3), data.clone());
        assert_eq!(buf.as_slice(), &data[..]);
    }
}
