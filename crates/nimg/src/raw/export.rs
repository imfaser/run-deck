use std::path::Path;

use bytemuck::cast_slice;

use crate::raw::types::Voxel;
use crate::raw::voxbuf::VoxBuf;

/// Write a `VoxBuf<T>` to disk as a raw binary file (no header, native endian).
///
/// # Errors
///
/// Returns an error if the file cannot be written.
pub fn export_raw<T: Voxel + bytemuck::Pod>(
    path: impl AsRef<Path>,
    buf: &VoxBuf<T>,
) -> anyhow::Result<()> {
    let bytes: &[u8] = cast_slice(&buf.data);
    std::fs::write(path.as_ref(), bytes)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::raw::types::*;
    use crate::raw::volume::RawVolume;
    use std::path::PathBuf;

    #[test]
    fn export_roundtrip_u8() {
        let data: Vec<u8> = (0..27).collect();
        let buf = VoxBuf::new(VolumeShape::new(3, 3, 3), data.clone());

        let dir = tempfile::tempdir_in(
            PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join("tests")
                .join("fixture"),
        )
        .unwrap();
        let path = dir.path().join("export_u8.raw");
        export_raw(&path, &buf).unwrap();

        let vol =
            RawVolume::open(&path, VolumeShape::new(3, 3, 3), DType::U8, Endian::Little).unwrap();
        let roi = vol
            .roi(Point3D::new(0, 0, 0), Point3D::new(3, 3, 3))
            .unwrap();
        let roundtrip: VoxBuf<u8> = roi.as_voxbuf().unwrap();
        assert_eq!(roundtrip.data, data);
    }

    #[test]
    fn export_roundtrip_u16() {
        let data: Vec<u16> = (0..27).collect();
        let buf = VoxBuf::new(VolumeShape::new(3, 3, 3), data.clone());

        let dir = tempfile::tempdir_in(
            PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join("tests")
                .join("fixture"),
        )
        .unwrap();
        let path = dir.path().join("export_u16.raw");
        export_raw(&path, &buf).unwrap();

        let vol =
            RawVolume::open(&path, VolumeShape::new(3, 3, 3), DType::U16, Endian::Little).unwrap();
        let roi = vol
            .roi(Point3D::new(0, 0, 0), Point3D::new(3, 3, 3))
            .unwrap();
        let roundtrip: VoxBuf<u16> = roi.as_voxbuf().unwrap();
        assert_eq!(roundtrip.data, data);
    }
}
