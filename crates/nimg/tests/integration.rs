use nimg::raw::*;
use std::path::PathBuf;

fn fixture(name: &str) -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("tests")
        .join("fixture")
        .join(name)
}

#[test]
fn open_and_slice_u8() {
    let vol = RawVolume::open(
        fixture("ct_sphere_uint8.raw"),
        VolumeShape::new(500, 500, 500),
        1,
        Endian::Little,
    )
    .unwrap();

    let slice: VoxBuf<u8> = vol.slice_at(Axis::Z, 250).unwrap();
    assert_eq!(slice.shape, VolumeShape::new(1, 500, 500));
    assert_eq!(slice.as_slice().len(), 250_000);

    // Center slice of a sphere should have non-zero voxels
    assert!(slice.as_slice().iter().any(|&v| v > 0));
}

#[test]
fn open_and_slice_u16() {
    let vol = RawVolume::open(
        fixture("ct_sphere_uint16.raw"),
        VolumeShape::new(500, 500, 500),
        2,
        Endian::Little,
    )
    .unwrap();

    let slice: VoxBuf<u16> = vol.slice_at(Axis::Z, 250).unwrap();
    assert_eq!(slice.shape, VolumeShape::new(1, 500, 500));
    assert_eq!(slice.as_slice().len(), 250_000);

    assert!(slice.as_slice().iter().any(|&v| v > 0));
}

#[test]
fn endian_conversion_differs() {
    let vol_le = RawVolume::open(
        fixture("ct_sphere_uint16.raw"),
        VolumeShape::new(500, 500, 500),
        2,
        Endian::Little,
    )
    .unwrap();

    let vol_be = RawVolume::open(
        fixture("ct_sphere_uint16.raw"),
        VolumeShape::new(500, 500, 500),
        2,
        Endian::Big,
    )
    .unwrap();

    let slice_le: VoxBuf<u16> = vol_le.slice_at(Axis::Z, 250).unwrap();
    let slice_be: VoxBuf<u16> = vol_be.slice_at(Axis::Z, 250).unwrap();

    // Same raw bytes, different endian → different values
    assert_ne!(slice_le.as_slice(), slice_be.as_slice());
}

#[test]
fn roi_and_threshold_roundtrip() {
    let vol = RawVolume::open(
        fixture("ct_sphere_uint8.raw"),
        VolumeShape::new(500, 500, 500),
        1,
        Endian::Little,
    )
    .unwrap();

    let buf: VoxBuf<u8> = vol
        .roi(Point3D::new(100, 100, 100), Point3D::new(150, 150, 150))
        .unwrap();
    assert_eq!(buf.shape, VolumeShape::new(50, 50, 50));

    let mask = buf.threshold(1, 255, 1);

    // Should have some non-zero voxels (sphere exists in this region)
    assert!(mask.as_slice().iter().any(|&v| v == 1));
}

#[test]
fn slice_all_axes() {
    let vol = RawVolume::open(
        fixture("ct_sphere_uint8.raw"),
        VolumeShape::new(500, 500, 500),
        1,
        Endian::Little,
    )
    .unwrap();

    let sz: VoxBuf<u8> = vol.slice_at(Axis::Z, 250).unwrap();
    assert_eq!(sz.shape, VolumeShape::new(1, 500, 500));

    let sy: VoxBuf<u8> = vol.slice_at(Axis::Y, 250).unwrap();
    assert_eq!(sy.shape, VolumeShape::new(500, 1, 500));

    let sx: VoxBuf<u8> = vol.slice_at(Axis::X, 250).unwrap();
    assert_eq!(sx.shape, VolumeShape::new(500, 500, 1));
}
