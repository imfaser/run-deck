use std::collections::HashMap;
use std::sync::{LazyLock, Mutex};

use nimg::raw::export_raw;
use nimg::raw::Mask;
use nimg::raw::{Axis, DType, Endian, VolumeShape};
use nimg::raw::RawVolume;
use nimg::raw::VoxBuf;
use serde::{Deserialize, Serialize};

use crate::kernel::context::AppContext;
use crate::utils::mcp_content::MCP_PREFIX;

use super::{CmdResult, StringifyErr};

// ─── Global volume store ───────────────────────────────────────────

struct VolumeStore {
    volumes: HashMap<String, RawVolume>,
    axis: HashMap<String, Axis>,
    endian: HashMap<String, Endian>,
}

static VOLUME_STORE: LazyLock<Mutex<VolumeStore>> = LazyLock::new(|| {
    Mutex::new(VolumeStore {
        volumes: HashMap::new(),
        axis: HashMap::new(),
        endian: HashMap::new(),
    })
});

fn gen_id() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let t = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    format!("{t:x}")
}

// ─── Input / Output types ──────────────────────────────────────────

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenRequest {
    pub path: String,
    pub x: usize,
    pub y: usize,
    pub z: usize,
    pub dtype: String,
    pub endian: String,
    pub axis: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenResponse {
    pub volume_id: String,
    pub total_slices: usize,
    pub slice_width: usize,
    pub slice_height: usize,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SliceResponse {
    pub data: Vec<u8>,
    pub width: usize,
    pub height: usize,
    pub min: f64,
    pub max: f64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MaskEntry {
    pub index: usize,
    pub mask_png_path: String,
}

// ─── Commands ──────────────────────────────────────────────────────

#[tauri::command]
pub fn raw_open(req: OpenRequest) -> CmdResult<OpenResponse> {
    let shape = VolumeShape::new(req.z, req.y, req.x);
    let dtype = match req.dtype.as_str() {
        "u8" | "uint8" => DType::U8,
        "u16" | "uint16" => DType::U16,
        other => return Err(format!("unsupported dtype: {other}")),
    };
    let endian = match req.endian.as_str() {
        "little" | "le" => Endian::Little,
        "big" | "be" => Endian::Big,
        other => return Err(format!("unsupported endian: {other}")),
    };
    let axis = match req.axis.as_str() {
        "x" | "X" => Axis::X,
        "y" | "Y" => Axis::Y,
        "z" | "Z" => Axis::Z,
        other => return Err(format!("unsupported axis: {other}")),
    };

    let vol = RawVolume::open(&req.path, shape, dtype, endian).stringify_err()?;

    let total_slices = shape.dim(axis);
    let (slice_h, slice_w) = shape.perpendicular(axis);

    let id = gen_id();
    let mut store = VOLUME_STORE.lock().map_err(|e| e.to_string())?;
    store.volumes.insert(id.clone(), vol);
    store.axis.insert(id.clone(), axis);
    store.endian.insert(id.clone(), endian);

    Ok(OpenResponse {
        volume_id: id,
        total_slices,
        slice_width: slice_w,
        slice_height: slice_h,
    })
}

#[tauri::command]
pub fn raw_slice(volume_id: String, index: usize) -> CmdResult<SliceResponse> {
    let (data_bytes, width, height, dtype, endian) = {
        let store = VOLUME_STORE.lock().map_err(|e| e.to_string())?;
        let vol = store
            .volumes
            .get(&volume_id)
            .ok_or("volume not found")?;
        let axis = store.axis.get(&volume_id).copied().unwrap_or(Axis::Z);
        let endian = store.endian.get(&volume_id).copied().unwrap_or(Endian::Little);

        let slice = vol.slice_at(axis, index).stringify_err()?;
        let (h, w) = slice.shape().perpendicular(axis);
        let dtype = slice.dtype();
        (slice.data().to_vec(), w, h, dtype, endian)
    };

    match dtype {
        DType::U8 => {
            let min = data_bytes.iter().copied().min().unwrap_or(0) as f64;
            let max = data_bytes.iter().copied().max().unwrap_or(255) as f64;
            Ok(SliceResponse {
                data: data_bytes,
                width,
                height,
                min,
                max,
            })
        }
        DType::U16 => {
            let values: Vec<u16> = data_bytes
                .chunks_exact(2)
                .map(|c| match endian {
                    Endian::Little => u16::from_le_bytes([c[0], c[1]]),
                    Endian::Big => u16::from_be_bytes([c[0], c[1]]),
                })
                .collect();
            let min = values.iter().copied().min().unwrap_or(0) as f64;
            let max = values.iter().copied().max().unwrap_or(65535) as f64;
            let range = if max > min { max - min } else { 1.0 };
            let normalized: Vec<u8> = values
                .iter()
                .map(|&v| ((v as f64 - min) / range * 255.0).round() as u8)
                .collect();
            Ok(SliceResponse {
                data: normalized,
                width,
                height,
                min,
                max,
            })
        }
    }
}

#[tauri::command]
pub fn raw_export_masks(
    volume_id: String,
    masks: Vec<MaskEntry>,
    output_path: String,
) -> CmdResult<String> {
    let shape = {
        let store = VOLUME_STORE.lock().map_err(|e| e.to_string())?;
        let vol = store
            .volumes
            .get(&volume_id)
            .ok_or("volume not found")?;
        vol.shape()
    };

    let mut buf: VoxBuf<u8> = VoxBuf::new(shape, vec![0u8; shape.total_voxels()]);

    let content_store = AppContext::mcp_content_store();

    for entry in &masks {
        // Support both file paths and mcp://localhost/{hash} URLs
        let img_bytes = if entry.mask_png_path.starts_with(MCP_PREFIX) {
            let hash = &entry.mask_png_path[MCP_PREFIX.len()..];
            match content_store.get(hash) {
                Some((_mime, bytes)) => bytes,
                None => return Err(format!("mask content not found for hash: {hash}")),
            }
        } else {
            std::fs::read(&entry.mask_png_path)
                .map_err(|e| format!("failed to read mask PNG {}: {e}", entry.mask_png_path))?
        };

        let img = image::load_from_memory(&img_bytes)
            .map_err(|e| format!("failed to decode mask PNG: {e}"))?;

        let gray = img.to_luma8();
        let (w, h) = gray.dimensions();
        let pixels: Vec<u8> = gray.into_raw();

        let mask = Mask::new(pixels.into(), h as usize, w as usize).stringify_err()?;

        let store = VOLUME_STORE.lock().map_err(|e| e.to_string())?;
        let axis = store.axis.get(&volume_id).copied().unwrap_or(Axis::Z);
        drop(store);

        let range = entry.index..entry.index + 1;
        buf.inject(&mask, axis, range).stringify_err()?;
    }

    export_raw(&output_path, &buf).stringify_err()?;

    Ok(output_path)
}

#[tauri::command]
pub fn raw_close(volume_id: String) -> CmdResult {
    let mut store = VOLUME_STORE.lock().map_err(|e| e.to_string())?;
    store.volumes.remove(&volume_id);
    store.axis.remove(&volume_id);
    store.endian.remove(&volume_id);
    Ok(())
}
