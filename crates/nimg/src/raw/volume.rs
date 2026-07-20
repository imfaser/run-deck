use std::fmt;
use std::fs::File;
use std::path::Path;

use anyhow::{Context, bail};
use memmap2::Mmap;
use ndarray::{Array3, s};

use crate::raw::types::{Axis, Endian, Point3D, VolumeShape, Voxel};
use crate::raw::voxbuf::VoxBuf;

/// A memory-mapped, read-only raw volume file.
pub struct RawVolume {
    shape: VolumeShape,
    voxel_size: usize,
    endian: Endian,
    mmap: Mmap,
}

impl RawVolume {
    /// Open a headerless raw volume file via mmap.
    ///
    /// # Errors
    ///
    /// Returns an error if the file cannot be opened, or if the file size
    /// does not match `shape.total_voxels() * voxel_size`.
    pub fn open(
        path: impl AsRef<Path>,
        shape: VolumeShape,
        voxel_size: usize,
        endian: Endian,
    ) -> anyhow::Result<Self> {
        let path = path.as_ref();
        let file =
            File::open(path).with_context(|| format!("failed to open {}", path.display()))?;
        let metadata = file.metadata()?;
        let file_len = usize::try_from(metadata.len())
            .map_err(|_| anyhow::anyhow!("file too large for usize: {}", metadata.len()))?;
        let expected = shape.total_voxels() * voxel_size;

        if file_len != expected {
            bail!(
                "file size mismatch: expected {expected} bytes for voxel_size={voxel_size} {shape} {}, got {file_len}",
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
            voxel_size,
            endian,
            mmap,
        })
    }

    #[must_use]
    pub fn shape(&self) -> VolumeShape {
        self.shape
    }

    #[must_use]
    pub fn voxel_size(&self) -> usize {
        self.voxel_size
    }

    #[must_use]
    pub fn endian(&self) -> Endian {
        self.endian
    }

    /// Convert the entire mmap to a typed `Array3<T>`.
    fn to_typed_array<T: Voxel>(&self) -> anyhow::Result<Array3<T>> {
        if T::byte_size() != self.voxel_size {
            bail!(
                "voxel type size mismatch: expected {}, got {}",
                self.voxel_size,
                T::byte_size()
            );
        }

        let values: Vec<T> = self
            .mmap
            .chunks_exact(self.voxel_size)
            .map(|c| match self.endian {
                Endian::Little => T::from_le_bytes(c),
                Endian::Big => T::from_be_bytes(c),
            })
            .collect();

        Array3::from_shape_vec((self.shape.z, self.shape.y, self.shape.x), values)
            .map_err(|e| anyhow::anyhow!("failed to create array: {e}"))
    }

    /// Extract a single slice along `axis` at `index`, returning a typed `VoxBuf<T>`.
    /// Uses ndarray `s![]` macro for all axes — no manual offset calculation.
    ///
    /// # Errors
    ///
    /// Returns an error if `index` is out of bounds or `T::byte_size()` doesn't match.
    pub fn slice_at<T: Voxel>(&self, axis: Axis, index: usize) -> anyhow::Result<VoxBuf<T>> {
        let dim = self.shape.dim(axis);
        if index >= dim {
            bail!("index {index} out of bounds for {axis} axis (size {dim})");
        }

        let arr = self.to_typed_array::<T>()?;

        let sliced = match axis {
            Axis::Z => arr.slice(s![index, .., ..]),
            Axis::Y => arr.slice(s![.., index, ..]),
            Axis::X => arr.slice(s![.., .., index]),
        };

        let shape = match axis {
            Axis::Z => VolumeShape::new(1, self.shape.y, self.shape.x),
            Axis::Y => VolumeShape::new(self.shape.z, 1, self.shape.x),
            Axis::X => VolumeShape::new(self.shape.z, self.shape.y, 1),
        };

        Ok(VoxBuf::new(shape, sliced.iter().copied().collect()))
    }

    /// Extract a rectangular sub-volume defined by two corner points.
    /// Points are normalized so that `p1 < p2` on all axes.
    /// Uses ndarray `s![]` macro — no manual offset calculation.
    ///
    /// # Errors
    ///
    /// Returns an error if the ROI is empty or exceeds volume bounds.
    pub fn roi<T: Voxel>(&self, p1: Point3D, p2: Point3D) -> anyhow::Result<VoxBuf<T>> {
        let lo = p1.min_point(p2);
        let hi = p1.max_point(p2);

        if lo.z == hi.z || lo.y == hi.y || lo.x == hi.x {
            bail!("empty ROI: points ({p1}) and ({p2}) define a zero-volume region");
        }

        if hi.z > self.shape.z || hi.y > self.shape.y || hi.x > self.shape.x {
            bail!("ROI ({lo})→({hi}) exceeds volume bounds {}", self.shape);
        }

        let arr = self.to_typed_array::<T>()?;
        let sliced = arr.slice(s![lo.z..hi.z, lo.y..hi.y, lo.x..hi.x]);

        let roi_z = hi.z - lo.z;
        let roi_y = hi.y - lo.y;
        let roi_x = hi.x - lo.x;

        Ok(VoxBuf::new(
            VolumeShape::new(roi_z, roi_y, roi_x),
            sliced.iter().copied().collect(),
        ))
    }
}

impl fmt::Debug for RawVolume {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("RawVolume")
            .field("shape", &self.shape)
            .field("voxel_size", &self.voxel_size)
            .field("endian", &self.endian)
            .field("mmap_len", &self.mmap.len())
            .finish()
    }
}

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
            1,
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
            1,
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
            1,
            Endian::Little,
        )
        .unwrap();

        let slice: VoxBuf<u8> = vol.slice_at(Axis::Z, 1).unwrap();
        assert_eq!(slice.shape, VolumeShape::new(1, 3, 3));
        assert_eq!(slice.as_slice(), &[9, 10, 11, 12, 13, 14, 15, 16, 17]);
    }

    #[test]
    fn slice_at_y() {
        let data: Vec<u8> = (0..27u8).collect(); // 3x3x3
        let tmp = create_temp_raw(&data, ".raw");
        let vol = RawVolume::open(
            tmp.path(),
            VolumeShape::new(3, 3, 3),
            1,
            Endian::Little,
        )
        .unwrap();

        let slice: VoxBuf<u8> = vol.slice_at(Axis::Y, 1).unwrap();
        assert_eq!(slice.shape, VolumeShape::new(3, 1, 3));
        // y=1: z=0 → [3,4,5], z=1 → [12,13,14], z=2 → [21,22,23]
        assert_eq!(slice.as_slice(), &[3, 4, 5, 12, 13, 14, 21, 22, 23]);
    }

    #[test]
    fn slice_at_x() {
        let data: Vec<u8> = (0..27u8).collect(); // 3x3x3
        let tmp = create_temp_raw(&data, ".raw");
        let vol = RawVolume::open(
            tmp.path(),
            VolumeShape::new(3, 3, 3),
            1,
            Endian::Little,
        )
        .unwrap();

        let slice: VoxBuf<u8> = vol.slice_at(Axis::X, 2).unwrap();
        assert_eq!(slice.shape, VolumeShape::new(3, 3, 1));
        // x=2: (0,0,2)=2, (0,1,2)=5, (0,2,2)=8, (1,0,2)=11, ...
        assert_eq!(slice.as_slice(), &[2, 5, 8, 11, 14, 17, 20, 23, 26]);
    }

    #[test]
    fn slice_at_out_of_bounds() {
        let data = vec![0u8; 27];
        let tmp = create_temp_raw(&data, ".raw");
        let vol = RawVolume::open(
            tmp.path(),
            VolumeShape::new(3, 3, 3),
            1,
            Endian::Little,
        )
        .unwrap();

        assert!(vol.slice_at::<u8>(Axis::Z, 3).is_err());
    }

    #[test]
    fn slice_at_u16_le() {
        // 2x2x2 volume of u16 little-endian
        let mut data = Vec::new();
        for i in 0u16..8 {
            data.extend_from_slice(&i.to_le_bytes());
        }
        let tmp = create_temp_raw(&data, ".raw");
        let vol = RawVolume::open(
            tmp.path(),
            VolumeShape::new(2, 2, 2),
            2,
            Endian::Little,
        )
        .unwrap();

        let slice: VoxBuf<u16> = vol.slice_at(Axis::Z, 0).unwrap();
        assert_eq!(slice.as_slice(), &[0, 1, 2, 3]);
    }

    #[test]
    fn slice_at_u16_be() {
        let mut data = Vec::new();
        for i in 0u16..8 {
            data.extend_from_slice(&i.to_be_bytes());
        }
        let tmp = create_temp_raw(&data, ".raw");
        let vol = RawVolume::open(
            tmp.path(),
            VolumeShape::new(2, 2, 2),
            2,
            Endian::Big,
        )
        .unwrap();

        let slice: VoxBuf<u16> = vol.slice_at(Axis::Z, 0).unwrap();
        assert_eq!(slice.as_slice(), &[0, 1, 2, 3]);
    }

    #[test]
    fn roi_basic() {
        let data: Vec<u8> = (0..27u8).collect(); // 3x3x3
        let tmp = create_temp_raw(&data, ".raw");
        let vol = RawVolume::open(
            tmp.path(),
            VolumeShape::new(3, 3, 3),
            1,
            Endian::Little,
        )
        .unwrap();

        // z=1..3, y=0..2, x=1..3
        let roi: VoxBuf<u8> = vol
            .roi(Point3D::new(1, 0, 1), Point3D::new(3, 2, 3))
            .unwrap();
        assert_eq!(roi.shape, VolumeShape::new(2, 2, 2));
        assert_eq!(roi.as_slice().len(), 8);
    }

    #[test]
    fn roi_empty() {
        let data = vec![0u8; 27];
        let tmp = create_temp_raw(&data, ".raw");
        let vol = RawVolume::open(
            tmp.path(),
            VolumeShape::new(3, 3, 3),
            1,
            Endian::Little,
        )
        .unwrap();

        assert!(
            vol.roi::<u8>(Point3D::new(1, 1, 1), Point3D::new(1, 2, 2))
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
            1,
            Endian::Little,
        )
        .unwrap();

        assert!(
            vol.roi::<u8>(Point3D::new(0, 0, 0), Point3D::new(4, 4, 4))
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
            1,
            Endian::Little,
        )
        .unwrap();

        // p1 > p2, should be normalized
        let roi: VoxBuf<u8> = vol
            .roi(Point3D::new(3, 2, 3), Point3D::new(1, 0, 1))
            .unwrap();
        assert_eq!(roi.shape, VolumeShape::new(2, 2, 2));
    }

    #[test]
    fn roi_data_correctness() {
        let data: Vec<u8> = (0..27u8).collect(); // 3x3x3
        let tmp = create_temp_raw(&data, ".raw");
        let vol = RawVolume::open(
            tmp.path(),
            VolumeShape::new(3, 3, 3),
            1,
            Endian::Little,
        )
        .unwrap();

        // Full volume ROI
        let roi: VoxBuf<u8> = vol
            .roi(Point3D::new(0, 0, 0), Point3D::new(3, 3, 3))
            .unwrap();
        assert_eq!(roi.as_slice(), &data[..]);
    }

    #[test]
    fn roi_u16() {
        let mut data = Vec::new();
        for i in 0u16..27 {
            data.extend_from_slice(&i.to_le_bytes());
        }
        let tmp = create_temp_raw(&data, ".raw");
        let vol = RawVolume::open(
            tmp.path(),
            VolumeShape::new(3, 3, 3),
            2,
            Endian::Little,
        )
        .unwrap();

        let roi: VoxBuf<u16> = vol
            .roi(Point3D::new(0, 0, 0), Point3D::new(3, 3, 3))
            .unwrap();
        assert_eq!(roi.as_slice().len(), 27);
        assert_eq!(roi.as_slice()[0], 0);
        assert_eq!(roi.as_slice()[26], 26);
    }

    #[test]
    fn voxel_size_mismatch() {
        let data = vec![0u8; 27];
        let tmp = create_temp_raw(&data, ".raw");
        let vol = RawVolume::open(
            tmp.path(),
            VolumeShape::new(3, 3, 3),
            1,
            Endian::Little,
        )
        .unwrap();

        // Try to read as u16 when volume is u8
        assert!(vol.slice_at::<u16>(Axis::Z, 0).is_err());
    }

    #[test]
    fn open_nonexistent_file() {
        let result = RawVolume::open(
            "/nonexistent/path/raw.raw",
            VolumeShape::new(10, 10, 10),
            1,
            Endian::Little,
        );
        assert!(result.is_err());
    }

    #[test]
    fn roi_full_volume_u16_data_integrity() {
        // 3x3x3 u16 volume, verify every voxel after roi
        let mut data = Vec::new();
        for i in 0u16..27 {
            data.extend_from_slice(&i.to_le_bytes());
        }
        let tmp = create_temp_raw(&data, ".raw");
        let vol = RawVolume::open(
            tmp.path(),
            VolumeShape::new(3, 3, 3),
            2,
            Endian::Little,
        )
        .unwrap();

        let roi: VoxBuf<u16> = vol
            .roi(Point3D::new(0, 0, 0), Point3D::new(3, 3, 3))
            .unwrap();

        for (i, &v) in roi.as_slice().iter().enumerate() {
            assert_eq!(v, i as u16, "mismatch at index {i}");
        }
    }
}
