use std::fmt;
use std::ops::Range;

/// Volume dimensions in (z, y, x) order. Z is slowest, x is fastest (C-order).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct VolumeShape {
    pub z: usize,
    pub y: usize,
    pub x: usize,
}

impl VolumeShape {
    #[must_use]
    pub fn new(z: usize, y: usize, x: usize) -> Self {
        Self { z, y, x }
    }

    #[must_use]
    pub fn dim(&self, axis: Axis) -> usize {
        match axis {
            Axis::Z => self.z,
            Axis::Y => self.y,
            Axis::X => self.x,
        }
    }

    #[must_use]
    pub fn total_voxels(&self) -> usize {
        self.z * self.y * self.x
    }

    #[must_use]
    pub fn total_bytes(&self, dtype: DType) -> usize {
        self.total_voxels() * dtype.size()
    }

    /// Dimensions perpendicular to the given axis, returned as `(height, width)`.
    /// For `Axis::Z` → `(y, x)`, `Axis::Y` → `(z, x)`, `Axis::X` → `(z, y)`.
    #[must_use]
    pub fn perpendicular(&self, axis: Axis) -> (usize, usize) {
        match axis {
            Axis::Z => (self.y, self.x),
            Axis::Y => (self.z, self.x),
            Axis::X => (self.z, self.y),
        }
    }
}

impl fmt::Display for Point3D {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "({}, {}, {})", self.z, self.y, self.x)
    }
}

impl fmt::Display for VolumeShape {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "({}, {}, {})", self.z, self.y, self.x)
    }
}

/// A 3D point used for ROI corner specification.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct Point3D {
    pub z: usize,
    pub y: usize,
    pub x: usize,
}

impl Point3D {
    #[must_use]
    pub fn new(z: usize, y: usize, x: usize) -> Self {
        Self { z, y, x }
    }

    /// Returns a point with each coordinate being the minimum of the two inputs.
    #[must_use]
    pub fn min_point(self, other: Self) -> Self {
        Self {
            z: self.z.min(other.z),
            y: self.y.min(other.y),
            x: self.x.min(other.x),
        }
    }

    /// Returns a point with each coordinate being the maximum of the two inputs.
    #[must_use]
    pub fn max_point(self, other: Self) -> Self {
        Self {
            z: self.z.max(other.z),
            y: self.y.max(other.y),
            x: self.x.max(other.x),
        }
    }
}

/// Voxel data type.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum DType {
    U8,
    U16,
}

impl DType {
    #[must_use]
    pub fn size(&self) -> usize {
        match self {
            DType::U8 => 1,
            DType::U16 => 2,
        }
    }
}

impl fmt::Display for DType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            DType::U8 => write!(f, "u8"),
            DType::U16 => write!(f, "u16"),
        }
    }
}

/// Byte order for multi-byte voxel types.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Endian {
    Little,
    Big,
}

impl fmt::Display for Endian {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Endian::Little => write!(f, "little-endian"),
            Endian::Big => write!(f, "big-endian"),
        }
    }
}

/// Volume axis.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Axis {
    X,
    Y,
    Z,
}

impl fmt::Display for Axis {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Axis::X => write!(f, "X"),
            Axis::Y => write!(f, "Y"),
            Axis::Z => write!(f, "Z"),
        }
    }
}

/// Trait for voxel element types. Implemented for `u8` and `u16`.
pub trait Voxel: Copy + Sized {
    const DTYPE: DType;

    fn from_le_bytes(bytes: &[u8]) -> Self;
    fn from_be_bytes(bytes: &[u8]) -> Self;
    fn to_ne_bytes(self) -> Vec<u8>;
}

impl Voxel for u8 {
    const DTYPE: DType = DType::U8;

    fn from_le_bytes(bytes: &[u8]) -> Self {
        bytes[0]
    }

    fn from_be_bytes(bytes: &[u8]) -> Self {
        bytes[0]
    }

    fn to_ne_bytes(self) -> Vec<u8> {
        vec![self]
    }
}

impl Voxel for u16 {
    const DTYPE: DType = DType::U16;

    fn from_le_bytes(bytes: &[u8]) -> Self {
        u16::from_le_bytes([bytes[0], bytes[1]])
    }

    fn from_be_bytes(bytes: &[u8]) -> Self {
        u16::from_be_bytes([bytes[0], bytes[1]])
    }

    fn to_ne_bytes(self) -> Vec<u8> {
        self.to_ne_bytes().to_vec()
    }
}

/// Byte offset into a C-order (z, y, x) volume.
#[must_use]
pub fn byte_offset(shape: &VolumeShape, dtype: DType, z: usize, y: usize, x: usize) -> usize {
    (z * shape.y * shape.x + y * shape.x + x) * dtype.size()
}

/// Validate that a range is non-empty and within bounds.
///
/// # Errors
///
/// Returns an error if the range is empty or exceeds the dimension size.
#[allow(dead_code)]
pub fn validate_range(range: &Range<usize>, len: usize, label: &str) -> anyhow::Result<()> {
    if range.start >= range.end {
        anyhow::bail!("{label} range is empty: {range:?}");
    }
    if range.end > len {
        anyhow::bail!("{label} range {range:?} exceeds dimension size {len}");
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn volume_shape_dim() {
        let s = VolumeShape::new(10, 20, 30);
        assert_eq!(s.dim(Axis::Z), 10);
        assert_eq!(s.dim(Axis::Y), 20);
        assert_eq!(s.dim(Axis::X), 30);
    }

    #[test]
    fn volume_shape_total() {
        let s = VolumeShape::new(500, 500, 500);
        assert_eq!(s.total_voxels(), 125_000_000);
        assert_eq!(s.total_bytes(DType::U8), 125_000_000);
        assert_eq!(s.total_bytes(DType::U16), 250_000_000);
    }

    #[test]
    fn volume_shape_perpendicular() {
        let s = VolumeShape::new(10, 20, 30);
        assert_eq!(s.perpendicular(Axis::Z), (20, 30));
        assert_eq!(s.perpendicular(Axis::Y), (10, 30));
        assert_eq!(s.perpendicular(Axis::X), (10, 20));
    }

    #[test]
    fn point3d_min_max() {
        let a = Point3D::new(1, 5, 3);
        let b = Point3D::new(4, 2, 6);
        assert_eq!(a.min_point(b), Point3D::new(1, 2, 3));
        assert_eq!(a.max_point(b), Point3D::new(4, 5, 6));
    }

    #[test]
    fn byte_offset_calculation() {
        let shape = VolumeShape::new(500, 500, 500);
        assert_eq!(byte_offset(&shape, DType::U8, 0, 0, 0), 0);
        assert_eq!(byte_offset(&shape, DType::U8, 0, 0, 1), 1);
        assert_eq!(byte_offset(&shape, DType::U8, 0, 1, 0), 500);
        assert_eq!(byte_offset(&shape, DType::U8, 1, 0, 0), 250_000);
        assert_eq!(byte_offset(&shape, DType::U16, 0, 0, 0), 0);
        assert_eq!(byte_offset(&shape, DType::U16, 0, 0, 1), 2);
        assert_eq!(byte_offset(&shape, DType::U16, 1, 0, 0), 500_000);
    }

    #[test]
    fn voxel_u8_roundtrip() {
        assert_eq!(<u8 as Voxel>::from_le_bytes(&[42]), 42);
        assert_eq!(<u8 as Voxel>::from_be_bytes(&[42]), 42);
        assert_eq!(<u8 as Voxel>::to_ne_bytes(42), vec![42]);
    }

    #[test]
    fn voxel_u16_endian() {
        let le_bytes = [0x01u8, 0x02];
        let be_bytes = [0x02u8, 0x01];
        assert_eq!(<u16 as Voxel>::from_le_bytes(&le_bytes), 0x0201);
        assert_eq!(<u16 as Voxel>::from_be_bytes(&be_bytes), 0x0201);
    }

    #[test]
    fn validate_range_ok() {
        assert!(validate_range(&(0..10), 10, "test").is_ok());
        assert!(validate_range(&(5..10), 10, "test").is_ok());
    }

    #[test]
    fn validate_range_empty() {
        assert!(validate_range(&(5..5), 10, "test").is_err());
    }

    #[test]
    fn validate_range_out_of_bounds() {
        assert!(validate_range(&(0..11), 10, "test").is_err());
    }
}
