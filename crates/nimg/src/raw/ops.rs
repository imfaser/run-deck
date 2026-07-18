use std::ops::Range;

use anyhow::bail;

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
        let data: Vec<u8> = self
            .data
            .iter()
            .map(|&v| if v >= lower && v <= upper { fill } else { 0 })
            .collect();
        VoxBuf::new(self.shape, data)
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

        let len = others[0].data.len();
        let default = T::default();
        let mut data = Vec::with_capacity(len);

        for i in 0..len {
            let all_nonzero = others.iter().all(|buf| buf.data[i] != default);
            data.push(if all_nonzero { fill } else { 0 });
        }

        Ok(VoxBuf::new(shape, data))
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
        if mask.height != expected_h || mask.width != expected_w {
            bail!(
                "mask dimensions {}×{} do not match perpendicular axes {expected_h}×{expected_w}",
                mask.height,
                mask.width,
            );
        }

        let layer_size = expected_h * expected_w;
        let expected_data_len = range.len() * layer_size;
        if mask.data.len() != expected_data_len {
            bail!(
                "mask data length {} does not match range length {} × area {layer_size} = {expected_data_len}",
                mask.data.len(),
                range.len(),
            );
        }

        for (i, idx) in range.enumerate() {
            let src_offset = i * layer_size;
            let src = &mask.data[src_offset..src_offset + layer_size];

            match axis {
                Axis::Z => {
                    let dst_offset = idx * self.shape.y * self.shape.x;
                    self.data[dst_offset..dst_offset + layer_size].copy_from_slice(src);
                }
                Axis::Y => {
                    for row in 0..self.shape.z {
                        for col in 0..self.shape.x {
                            let mask_val = src[row * self.shape.x + col];
                            let dst_idx =
                                row * self.shape.y * self.shape.x + idx * self.shape.x + col;
                            self.data[dst_idx] = mask_val;
                        }
                    }
                }
                Axis::X => {
                    for z in 0..self.shape.z {
                        for y in 0..self.shape.y {
                            let mask_val = src[z * self.shape.y + y];
                            let dst_idx = z * self.shape.y * self.shape.x + y * self.shape.x + idx;
                            self.data[dst_idx] = mask_val;
                        }
                    }
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
    use bytes::Bytes;

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
        assert_eq!(result.data, vec![0, 0, 1, 1, 0]);
    }

    #[test]
    fn threshold_u16() {
        let buf = make_buf_u16(vec![0, 300, 500, 1000, 2000], 1, 1, 5);
        let result = buf.threshold(100u16, 1000, 255);
        assert_eq!(result.data, vec![0, 255, 255, 255, 0]);
    }

    #[test]
    fn threshold_custom_fill() {
        let buf = make_buf_u8(vec![0, 50, 150], 1, 1, 3);
        let result = buf.threshold(100, 200, 128);
        assert_eq!(result.data, vec![0, 0, 128]);
    }

    #[test]
    fn intersect_basic() {
        let a = make_buf_u8(vec![1, 0, 1, 1], 1, 1, 4);
        let b = make_buf_u8(vec![1, 1, 1, 0], 1, 1, 4);
        let c = make_buf_u8(vec![1, 1, 0, 1], 1, 1, 4);
        let result = VoxBuf::intersect(&[&a, &b, &c], 1).unwrap();
        assert_eq!(result.data, vec![1, 0, 0, 0]);
    }

    #[test]
    fn intersect_custom_fill() {
        let a = make_buf_u8(vec![1, 0, 1], 1, 1, 3);
        let b = make_buf_u8(vec![1, 1, 0], 1, 1, 3);
        let result = VoxBuf::intersect(&[&a, &b], 255).unwrap();
        assert_eq!(result.data, vec![255, 0, 0]);
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
        let mask_data = Bytes::from(vec![1u8; 18]);
        let mask = Mask::new(mask_data, 3, 3).unwrap();
        buf.inject(&mask, Axis::Z, 1..3).unwrap();

        assert_eq!(&buf.data[0..9], &[0u8; 9]);
        assert_eq!(&buf.data[9..27], &[1u8; 18]);
    }

    #[test]
    fn inject_dimension_mismatch() {
        let mut buf = make_buf_u8(vec![0u8; 27], 3, 3, 3);
        let mask_data = Bytes::from(vec![1u8; 4]);
        let mask = Mask::new(mask_data, 2, 2).unwrap();
        assert!(buf.inject(&mask, Axis::Z, 0..1).is_err());
    }

    #[test]
    fn inject_out_of_bounds() {
        let mut buf = make_buf_u8(vec![0u8; 27], 3, 3, 3);
        let mask_data = Bytes::from(vec![1u8; 9]);
        let mask = Mask::new(mask_data, 3, 3).unwrap();
        assert!(buf.inject(&mask, Axis::Z, 2..5).is_err());
    }
}
