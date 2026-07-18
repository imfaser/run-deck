use std::fs::File;
use std::ops::Range;
use std::path::Path;

use anyhow::{Context, bail};
use memmap2::Mmap;

use crate::raw::types::{Axis, DType, Endian, Point3D, VolumeShape, Voxel, byte_offset};

/// A memory-mapped, read-only raw volume file.
pub struct RawVolume {
    shape: VolumeShape,
    dtype: DType,
    endian: Endian,
    mmap: Mmap,
}

impl RawVolume {
    /// Open a headerless raw volume file via mmap.
    ///
    /// # Errors
    ///
    /// Returns an error if the file cannot be opened, or if the file size
    /// does not match `shape.total_bytes(dtype)`.
    pub fn open(
        path: impl AsRef<Path>,
        shape: VolumeShape,
        dtype: DType,
        endian: Endian,
    ) -> anyhow::Result<Self> {
        let path = path.as_ref();
        let file =
            File::open(path).with_context(|| format!("failed to open {}", path.display()))?;
        let metadata = file.metadata()?;
        let file_len = usize::try_from(metadata.len())
            .map_err(|_| anyhow::anyhow!("file too large for usize: {}", metadata.len()))?;
        let expected = shape.total_bytes(dtype);

        if file_len != expected {
            bail!(
                "file size mismatch: expected {expected} bytes for {dtype} {shape} {}, got {file_len}",
                path.display()
            );
        }

        if file_len == 0 {
            bail!("cannot mmap empty file: {}", path.display());
        }

        // SAFETY: We hold the File open; the mmap is read-only.
        let mmap = unsafe { Mmap::map(&file)? };

        Ok(Self {
            shape,
            dtype,
            endian,
            mmap,
        })
    }

    #[must_use]
    pub fn shape(&self) -> VolumeShape {
        self.shape
    }

    #[must_use]
    pub fn dtype(&self) -> DType {
        self.dtype
    }

    #[must_use]
    pub fn endian(&self) -> Endian {
        self.endian
    }

    /// Extract a single slice along `axis` at `index`.
    ///
    /// # Errors
    ///
    /// Returns an error if `index` is out of bounds for the given axis.
    pub fn slice_at(&self, axis: Axis, index: usize) -> anyhow::Result<RawSlice> {
        let dim = self.shape.dim(axis);
        if index >= dim {
            bail!("index {index} out of bounds for {axis} axis (size {dim})");
        }

        let dtype_size = self.dtype.size();
        let (perp_h, perp_w) = self.shape.perpendicular(axis);
        let slice_voxels = perp_h * perp_w;
        let slice_bytes = slice_voxels * dtype_size;

        let offset = match axis {
            Axis::Z => byte_offset(&self.shape, self.dtype, index, 0, 0),
            Axis::Y => byte_offset(&self.shape, self.dtype, 0, index, 0),
            Axis::X => byte_offset(&self.shape, self.dtype, 0, 0, index),
        };

        let data = self.mmap[offset..offset + slice_bytes].to_vec();

        let shape = match axis {
            Axis::Z => VolumeShape::new(1, self.shape.y, self.shape.x),
            Axis::Y => VolumeShape::new(self.shape.z, 1, self.shape.x),
            Axis::X => VolumeShape::new(self.shape.z, self.shape.y, 1),
        };

        Ok(RawSlice {
            shape,
            dtype: self.dtype,
            endian: self.endian,
            data,
        })
    }

    /// Extract a rectangular sub-volume defined by two corner points.
    /// Points are normalized so that `p1 < p2` on all axes.
    ///
    /// # Errors
    ///
    /// Returns an error if the ROI is empty or exceeds volume bounds.
    pub fn roi(&self, p1: Point3D, p2: Point3D) -> anyhow::Result<RawSlice> {
        let lo = p1.min_point(p2);
        let hi = p1.max_point(p2);

        if lo.z == hi.z || lo.y == hi.y || lo.x == hi.x {
            bail!("empty ROI: points ({p1}) and ({p2}) define a zero-volume region");
        }

        if hi.z > self.shape.z || hi.y > self.shape.y || hi.x > self.shape.x {
            bail!("ROI ({lo})→({hi}) exceeds volume bounds {}", self.shape);
        }

        let roi_z = hi.z - lo.z;
        let roi_y = hi.y - lo.y;
        let roi_x = hi.x - lo.x;
        let dtype_size = self.dtype.size();
        let row_bytes = roi_x * dtype_size;

        let mut data = Vec::with_capacity(roi_z * roi_y * row_bytes);

        for z in lo.z..hi.z {
            for y in lo.y..hi.y {
                let src_offset = byte_offset(&self.shape, self.dtype, z, y, lo.x);
                data.extend_from_slice(&self.mmap[src_offset..src_offset + row_bytes]);
            }
        }

        Ok(RawSlice {
            shape: VolumeShape::new(roi_z, roi_y, roi_x),
            dtype: self.dtype,
            endian: self.endian,
            data,
        })
    }

    /// Create a lazy iterator that yields slices along `axis` for indices in `range`.
    ///
    /// # Errors
    ///
    /// Returns an error if the range exceeds the axis size or is empty.
    pub fn stream(&self, axis: Axis, range: Range<usize>) -> anyhow::Result<RawStream<'_>> {
        let dim = self.shape.dim(axis);
        if range.end > dim {
            bail!("stream range {range:?} exceeds {axis} axis size {dim}");
        }
        if range.is_empty() {
            bail!("stream range {range:?} is empty");
        }

        let start = range.start;
        Ok(RawStream {
            volume: self,
            axis,
            range,
            current: start,
        })
    }
}

impl fmt::Debug for RawVolume {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("RawVolume")
            .field("shape", &self.shape)
            .field("dtype", &self.dtype)
            .field("endian", &self.endian)
            .field("mmap_len", &self.mmap.len())
            .finish()
    }
}

/// An intermediate slice with runtime-typed data. Convert to `VoxBuf<T>` via `as_voxbuf`.
#[derive(Debug, Clone)]
pub struct RawSlice {
    shape: VolumeShape,
    dtype: DType,
    endian: Endian,
    data: Vec<u8>,
}

impl RawSlice {
    #[must_use]
    pub fn shape(&self) -> VolumeShape {
        self.shape
    }

    #[must_use]
    pub fn dtype(&self) -> DType {
        self.dtype
    }

    #[must_use]
    pub fn endian(&self) -> Endian {
        self.endian
    }

    #[must_use]
    pub fn data(&self) -> &[u8] {
        &self.data
    }

    /// Convert raw bytes to a typed `VoxBuf<T>`.
    ///
    /// # Errors
    ///
    /// Returns an error if `T::DTYPE != self.dtype`.
    pub fn as_voxbuf<T: Voxel>(&self) -> anyhow::Result<crate::raw::VoxBuf<T>> {
        if T::DTYPE != self.dtype {
            bail!(
                "dtype mismatch: slice contains {}, but requested {}",
                self.dtype,
                T::DTYPE
            );
        }

        let dtype_size = std::mem::size_of::<T>();
        let values: Vec<T> = self
            .data
            .chunks_exact(dtype_size)
            .map(|chunk| match self.endian {
                Endian::Little => T::from_le_bytes(chunk),
                Endian::Big => T::from_be_bytes(chunk),
            })
            .collect();

        Ok(crate::raw::VoxBuf::new(self.shape, values))
    }
}

/// Lazy iterator yielding `RawSlice` items along an axis.
pub struct RawStream<'a> {
    volume: &'a RawVolume,
    axis: Axis,
    range: Range<usize>,
    current: usize,
}

impl Iterator for RawStream<'_> {
    type Item = anyhow::Result<RawSlice>;

    fn next(&mut self) -> Option<Self::Item> {
        if self.current >= self.range.end {
            return None;
        }
        let result = self.volume.slice_at(self.axis, self.current);
        self.current += 1;
        Some(result)
    }

    fn size_hint(&self) -> (usize, Option<usize>) {
        let remaining = self.range.end - self.current;
        (remaining, Some(remaining))
    }
}

impl ExactSizeIterator for RawStream<'_> {}

use std::fmt;

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use std::path::PathBuf;

    fn create_temp_raw(data: &[u8], name: &str) -> tempfile::NamedTempFile {
        let mut f = tempfile::Builder::new()
            .suffix(name)
            .tempfile_in(
                PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                    .join("tests")
                    .join("fixture"),
            )
            .unwrap();
        f.write_all(data).unwrap();
        f.flush().unwrap();
        f
    }

    #[test]
    fn open_success() {
        let data = vec![0u8; 1000];
        let tmp = create_temp_raw(&data, ".raw");
        let vol = RawVolume::open(
            tmp.path(),
            VolumeShape::new(10, 10, 10),
            DType::U8,
            Endian::Little,
        );
        assert!(vol.is_ok());
    }

    #[test]
    fn open_file_size_mismatch() {
        let data = vec![0u8; 500];
        let tmp = create_temp_raw(&data, ".raw");
        let result = RawVolume::open(
            tmp.path(),
            VolumeShape::new(10, 10, 10),
            DType::U8,
            Endian::Little,
        );
        assert!(result.is_err());
        assert!(
            result
                .unwrap_err()
                .to_string()
                .contains("file size mismatch")
        );
    }

    #[test]
    fn slice_at_z() {
        let data: Vec<u8> = (0..27u8).collect(); // 3x3x3
        let tmp = create_temp_raw(&data, ".raw");
        let vol = RawVolume::open(
            tmp.path(),
            VolumeShape::new(3, 3, 3),
            DType::U8,
            Endian::Little,
        )
        .unwrap();

        let slice = vol.slice_at(Axis::Z, 1).unwrap();
        assert_eq!(slice.shape(), VolumeShape::new(1, 3, 3));
        assert_eq!(slice.data(), &[9, 10, 11, 12, 13, 14, 15, 16, 17]);
    }

    #[test]
    fn slice_at_out_of_bounds() {
        let data = vec![0u8; 27];
        let tmp = create_temp_raw(&data, ".raw");
        let vol = RawVolume::open(
            tmp.path(),
            VolumeShape::new(3, 3, 3),
            DType::U8,
            Endian::Little,
        )
        .unwrap();

        assert!(vol.slice_at(Axis::Z, 3).is_err());
    }

    #[test]
    fn roi_basic() {
        let data: Vec<u8> = (0..27u8).collect(); // 3x3x3
        let tmp = create_temp_raw(&data, ".raw");
        let vol = RawVolume::open(
            tmp.path(),
            VolumeShape::new(3, 3, 3),
            DType::U8,
            Endian::Little,
        )
        .unwrap();

        // z=1..3, y=0..2, x=1..3
        let roi = vol
            .roi(Point3D::new(1, 0, 1), Point3D::new(3, 2, 3))
            .unwrap();
        assert_eq!(roi.shape(), VolumeShape::new(2, 2, 2));
        assert_eq!(roi.data().len(), 8);
    }

    #[test]
    fn roi_empty() {
        let data = vec![0u8; 27];
        let tmp = create_temp_raw(&data, ".raw");
        let vol = RawVolume::open(
            tmp.path(),
            VolumeShape::new(3, 3, 3),
            DType::U8,
            Endian::Little,
        )
        .unwrap();

        assert!(
            vol.roi(Point3D::new(1, 1, 1), Point3D::new(1, 2, 2))
                .is_err()
        );
    }

    #[test]
    fn roi_out_of_bounds() {
        let data = vec![0u8; 27];
        let tmp = create_temp_raw(&data, ".raw");
        let vol = RawVolume::open(
            tmp.path(),
            VolumeShape::new(3, 3, 3),
            DType::U8,
            Endian::Little,
        )
        .unwrap();

        assert!(
            vol.roi(Point3D::new(0, 0, 0), Point3D::new(4, 4, 4))
                .is_err()
        );
    }

    #[test]
    fn roi_point_order_normalized() {
        let data: Vec<u8> = (0..27u8).collect();
        let tmp = create_temp_raw(&data, ".raw");
        let vol = RawVolume::open(
            tmp.path(),
            VolumeShape::new(3, 3, 3),
            DType::U8,
            Endian::Little,
        )
        .unwrap();

        // p1 > p2, should be normalized
        let roi = vol
            .roi(Point3D::new(3, 2, 3), Point3D::new(1, 0, 1))
            .unwrap();
        assert_eq!(roi.shape(), VolumeShape::new(2, 2, 2));
    }

    #[test]
    fn stream_count() {
        let data = vec![0u8; 27]; // 3x3x3
        let tmp = create_temp_raw(&data, ".raw");
        let vol = RawVolume::open(
            tmp.path(),
            VolumeShape::new(3, 3, 3),
            DType::U8,
            Endian::Little,
        )
        .unwrap();

        let stream = vol.stream(Axis::Z, 0..3).unwrap();
        assert_eq!(stream.len(), 3);

        let slices: Vec<_> = stream.collect::<Result<Vec<_>, _>>().unwrap();
        assert_eq!(slices.len(), 3);
        for s in &slices {
            assert_eq!(s.shape(), VolumeShape::new(1, 3, 3));
        }
    }

    #[test]
    fn stream_out_of_bounds() {
        let data = vec![0u8; 27];
        let tmp = create_temp_raw(&data, ".raw");
        let vol = RawVolume::open(
            tmp.path(),
            VolumeShape::new(3, 3, 3),
            DType::U8,
            Endian::Little,
        )
        .unwrap();

        assert!(vol.stream(Axis::Z, 0..4).is_err());
    }

    #[test]
    fn as_voxbuf_dtype_mismatch() {
        let slice = RawSlice {
            shape: VolumeShape::new(1, 2, 2),
            dtype: DType::U16,
            endian: Endian::Little,
            data: vec![0, 0, 0, 0, 0, 0, 0, 0],
        };
        assert!(slice.as_voxbuf::<u8>().is_err());
    }

    #[test]
    fn as_voxbuf_endian_swap() {
        let slice_le = RawSlice {
            shape: VolumeShape::new(1, 1, 2),
            dtype: DType::U16,
            endian: Endian::Little,
            data: vec![0x01, 0x02, 0x03, 0x04],
        };
        let slice_be = RawSlice {
            shape: VolumeShape::new(1, 1, 2),
            dtype: DType::U16,
            endian: Endian::Big,
            data: vec![0x01, 0x02, 0x03, 0x04],
        };

        let buf_le: crate::raw::VoxBuf<u16> = slice_le.as_voxbuf().unwrap();
        let buf_be: crate::raw::VoxBuf<u16> = slice_be.as_voxbuf().unwrap();

        assert_eq!(buf_le.data, vec![0x0201, 0x0403]);
        assert_eq!(buf_be.data, vec![0x0102, 0x0304]);
        assert_ne!(buf_le.data, buf_be.data);
    }
}
