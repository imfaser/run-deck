use std::ops::Range;

use anyhow::bail;
use ndarray::{Zip, s};

use crate::raw::mask::Mask;
use crate::raw::types::{Axis, Voxel};
use crate::raw::voxbuf::VoxBuf;

impl<T: Voxel> VoxBuf<T> {
    /// Produce a binary mask: voxels in `[lower, upper]` → `fill`, others → `0`.
    #[must_use]
    pub fn threshold(&self, lower: T, upper: T, fill: u8) -> VoxBuf<u8>
    where
        T: PartialOrd,
    {
        let inner = self.inner.mapv(|v| if v >= lower && v <= upper { fill } else { 0 });
        VoxBuf::from_array(self.shape, inner)
    }

    /// Element-wise AND of multiple same-shape buffers.
    /// A position is `fill` only if ALL inputs have non-zero values there.
    ///
    /// # Errors
    ///
    /// Returns an error if the input list is empty or shapes mismatch.
    pub fn intersect(others: &[&VoxBuf<T>], fill: u8) -> anyhow::Result<VoxBuf<u8>>
    where
        T: PartialEq + Default,
    {
        if others.is_empty() {
            bail!("intersect requires at least one VoxBuf");
        }

        let shape = others[0].shape;
        for (i, buf) in others.iter().enumerate() {
            if buf.shape != shape {
                bail!(
                    "shape mismatch at index {i}: expected {shape}, got {}",
                    buf.shape
                );
            }
        }

        let default = T::default();
        let mut result = ndarray::Array3::from_elem((shape.z, shape.y, shape.x), fill);

        for other in others {
            Zip::from(&mut result)
                .and(&other.inner)
                .for_each(|r, &v| {
                    if v == default {
                        *r = 0;
                    }
                });
        }

        Ok(VoxBuf::from_array(shape, result))
    }
}

impl VoxBuf<u8> {
    /// Inject a grayscale mask into this buffer at the specified axis and range.
    ///
    /// The mask's `(height, width)` must match the two perpendicular dimensions.
    ///
    /// # Errors
    ///
    /// Returns an error if the range is out of bounds, mask dimensions don't match,
    /// or mask data length is inconsistent.
    pub fn inject(&mut self, mask: &Mask, axis: Axis, range: Range<usize>) -> anyhow::Result<()> {
        let dim = self.shape.dim(axis);
        if range.start >= range.end {
            bail!("inject range is empty: {range:?}");
        }
        if range.end > dim {
            bail!("inject range {range:?} exceeds {axis} axis size {dim}");
        }

        let (expected_h, expected_w) = self.shape.perpendicular(axis);
        if mask.height() != expected_h || mask.width() != expected_w {
            bail!(
                "mask dimensions {}×{} do not match perpendicular axes {expected_h}×{expected_w}",
                mask.height(),
                mask.width(),
            );
        }

        let expected_layers = range.len();
        if mask.layers() != expected_layers {
            bail!(
                "mask layers {} does not match range length {expected_layers}",
                mask.layers(),
            );
        }

        for (i, idx) in range.enumerate() {
            let source = mask.inner().slice(s![i, .., ..]);
            match axis {
                Axis::Z => {
                    let mut target = self.inner.slice_mut(s![idx, .., ..]);
                    target.assign(&source);
                }
                Axis::Y => {
                    let mut target = self.inner.slice_mut(s![.., idx, ..]);
                    target.assign(&source);
                }
                Axis::X => {
                    let mut target = self.inner.slice_mut(s![.., .., idx]);
                    target.assign(&source);
                }
            }
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::raw::types::VolumeShape;

    fn make_buf_u8(data: Vec<u8>, z: usize, y: usize, x: usize) -> VoxBuf<u8> {
        VoxBuf::new(VolumeShape::new(z, y, x), data)
    }

    fn make_buf_u16(data: Vec<u16>, z: usize, y: usize, x: usize) -> VoxBuf<u16> {
        VoxBuf::new(VolumeShape::new(z, y, x), data)
    }

    #[test]
    fn threshold_u8() {
        let buf = make_buf_u8(vec![0, 50, 100, 200, 255], 1, 1, 5);
        let result = buf.threshold(100, 200, 1);
        assert_eq!(result.as_slice(), &[0, 0, 1, 1, 0]);
    }

    #[test]
    fn threshold_u16() {
        let buf = make_buf_u16(vec![0, 300, 500, 1000, 2000], 1, 1, 5);
        let result = buf.threshold(100u16, 1000, 255);
        assert_eq!(result.as_slice(), &[0, 255, 255, 255, 0]);
    }

    #[test]
    fn threshold_custom_fill() {
        let buf = make_buf_u8(vec![0, 50, 150], 1, 1, 3);
        let result = buf.threshold(100, 200, 128);
        assert_eq!(result.as_slice(), &[0, 0, 128]);
    }

    #[test]
    fn intersect_basic() {
        let a = make_buf_u8(vec![1, 0, 1, 1], 1, 1, 4);
        let b = make_buf_u8(vec![1, 1, 1, 0], 1, 1, 4);
        let c = make_buf_u8(vec![1, 1, 0, 1], 1, 1, 4);
        let result = VoxBuf::intersect(&[&a, &b, &c], 1).unwrap();
        assert_eq!(result.as_slice(), &[1, 0, 0, 0]);
    }

    #[test]
    fn intersect_custom_fill() {
        let a = make_buf_u8(vec![1, 0, 1], 1, 1, 3);
        let b = make_buf_u8(vec![1, 1, 0], 1, 1, 3);
        let result = VoxBuf::intersect(&[&a, &b], 255).unwrap();
        assert_eq!(result.as_slice(), &[255, 0, 0]);
    }

    #[test]
    fn intersect_shape_mismatch() {
        let a = make_buf_u8(vec![1, 0, 1, 1], 1, 2, 2);
        let b = make_buf_u8(vec![1, 1, 0], 1, 1, 3);
        assert!(VoxBuf::intersect(&[&a, &b], 1).is_err());
    }

    #[test]
    fn intersect_empty() {
        assert!(VoxBuf::intersect(&[] as &[&VoxBuf<u8>], 1).is_err());
    }

    #[test]
    fn inject_z_axis() {
        let mut buf = make_buf_u8(vec![0u8; 27], 3, 3, 3);
        let mask = Mask::new(vec![1u8; 18], 3, 3).unwrap();
        buf.inject(&mask, Axis::Z, 1..3).unwrap();

        assert_eq!(&buf.as_slice()[0..9], &[0u8; 9]);
        assert_eq!(&buf.as_slice()[9..27], &[1u8; 18]);
    }

    #[test]
    fn inject_y_axis() {
        let mut buf = make_buf_u8(vec![0u8; 27], 3, 3, 3);
        // Y axis: mask height=z=3, width=x=3, 2 layers
        let mask = Mask::new(vec![1u8; 18], 3, 3).unwrap();
        buf.inject(&mask, Axis::Y, 0..2).unwrap();

        // For each z: y=0 and y=1 should be 1, y=2 should be 0
        for z in 0..3 {
            for y in 0..2 {
                for x in 0..3 {
                    assert_eq!(buf.get(z, y, x), 1, "expected 1 at ({z},{y},{x})");
                }
            }
            for x in 0..3 {
                assert_eq!(buf.get(z, 2, x), 0, "expected 0 at ({z},2,{x})");
            }
        }
    }

    #[test]
    fn inject_x_axis() {
        let mut buf = make_buf_u8(vec![0u8; 27], 3, 3, 3);
        // X axis: mask height=z=3, width=y=3, 1 layer
        let mask = Mask::new(vec![1u8; 9], 3, 3).unwrap();
        buf.inject(&mask, Axis::X, 1..2).unwrap();

        for z in 0..3 {
            for y in 0..3 {
                assert_eq!(buf.get(z, y, 0), 0);
                assert_eq!(buf.get(z, y, 1), 1);
                assert_eq!(buf.get(z, y, 2), 0);
            }
        }
    }

    #[test]
    fn inject_dimension_mismatch() {
        let mut buf = make_buf_u8(vec![0u8; 27], 3, 3, 3);
        let mask = Mask::new(vec![1u8; 4], 2, 2).unwrap();
        assert!(buf.inject(&mask, Axis::Z, 0..1).is_err());
    }

    #[test]
    fn inject_out_of_bounds() {
        let mut buf = make_buf_u8(vec![0u8; 27], 3, 3, 3);
        let mask = Mask::new(vec![1u8; 9], 3, 3).unwrap();
        assert!(buf.inject(&mask, Axis::Z, 2..5).is_err());
    }
}
