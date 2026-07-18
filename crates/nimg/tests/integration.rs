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
        DType::U8,
        Endian::Little,
    )
    .unwrap();

    let slice = vol.slice_at(Axis::Z, 250).unwrap();
    assert_eq!(slice.shape(), VolumeShape::new(1, 500, 500));
    assert_eq!(slice.data().len(), 250_000);

    let buf: VoxBuf<u8> = slice.as_voxbuf().unwrap();
    // Center slice of a sphere should have non-zero voxels
    assert!(buf.data.iter().any(|&v| v > 0));
}

#[test]
fn open_and_slice_u16() {
    let vol = RawVolume::open(
        fixture("ct_sphere_uint16.raw"),
        VolumeShape::new(500, 500, 500),
        DType::U16,
        Endian::Little,
    )
    .unwrap();

    let slice = vol.slice_at(Axis::Z, 250).unwrap();
    assert_eq!(slice.shape(), VolumeShape::new(1, 500, 500));
    assert_eq!(slice.data().len(), 500_000);

    let buf: VoxBuf<u16> = slice.as_voxbuf().unwrap();
    assert!(buf.data.iter().any(|&v| v > 0));
}

#[test]
fn endian_conversion_differs() {
    let vol_le = RawVolume::open(
        fixture("ct_sphere_uint16.raw"),
        VolumeShape::new(500, 500, 500),
        DType::U16,
        Endian::Little,
    )
    .unwrap();

    let vol_be = RawVolume::open(
        fixture("ct_sphere_uint16.raw"),
        VolumeShape::new(500, 500, 500),
        DType::U16,
        Endian::Big,
    )
    .unwrap();

    let slice_le = vol_le.slice_at(Axis::Z, 250).unwrap();
    let slice_be = vol_be.slice_at(Axis::Z, 250).unwrap();

    let buf_le: VoxBuf<u16> = slice_le.as_voxbuf().unwrap();
    let buf_be: VoxBuf<u16> = slice_be.as_voxbuf().unwrap();

    // Same raw bytes, different endian → different values
    assert_ne!(buf_le.data, buf_be.data);
}

#[test]
fn roi_and_threshold_roundtrip() {
    let vol = RawVolume::open(
        fixture("ct_sphere_uint8.raw"),
        VolumeShape::new(500, 500, 500),
        DType::U8,
        Endian::Little,
    )
    .unwrap();

    let roi = vol
        .roi(Point3D::new(100, 100, 100), Point3D::new(150, 150, 150))
        .unwrap();
    assert_eq!(roi.shape(), VolumeShape::new(50, 50, 50));

    let buf: VoxBuf<u8> = roi.as_voxbuf().unwrap();
    let mask = buf.threshold(1, 255, 1);

    // Should have some non-zero voxels (sphere exists in this region)
    assert!(mask.data.iter().any(|&v| v == 1));
}

#[test]
fn stream_yields_correct_count() {
    let vol = RawVolume::open(
        fixture("ct_sphere_uint8.raw"),
        VolumeShape::new(500, 500, 500),
        DType::U8,
        Endian::Little,
    )
    .unwrap();

    let stream = vol.stream(Axis::Z, 0..10).unwrap();
    assert_eq!(stream.len(), 10);

    let slices: Vec<_> = stream.collect::<Result<Vec<_>, _>>().unwrap();
    assert_eq!(slices.len(), 10);
    for s in &slices {
        assert_eq!(s.shape(), VolumeShape::new(1, 500, 500));
    }
}

#[test]
fn stream_is_lazy() {
    let vol = RawVolume::open(
        fixture("ct_sphere_uint8.raw"),
        VolumeShape::new(500, 500, 500),
        DType::U8,
        Endian::Little,
    )
    .unwrap();

    // Take only 3 from a range of 500 — should not read all 500 slices
    let mut stream = vol.stream(Axis::Z, 0..500).unwrap();
    let _s1 = stream.next().unwrap().unwrap();
    let _s2 = stream.next().unwrap().unwrap();
    let _s3 = stream.next().unwrap().unwrap();
    // Remaining 497 are never touched
    assert_eq!(stream.len(), 497);
}
