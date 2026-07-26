import { invoke } from '@tauri-apps/api/core';

export interface RawOpenRequest {
  path: string;
  x: number;
  y: number;
  z: number;
  dtype: string;
  endian: string;
  axis: string;
}

export interface RawOpenResponse {
  volumeId: string;
  totalSlices: number;
  sliceWidth: number;
  sliceHeight: number;
}

export interface RawSliceResponse {
  data: number[];
  width: number;
  height: number;
  min: number;
  max: number;
}

export interface BoxCoord {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface PointCoord {
  x: number;
  y: number;
  label: 0 | 1;
}

export interface LabelEntry {
  name: string;
  subNames: string[];
  boxes: BoxCoord[];
  points: PointCoord[];
}

export interface VolumeMeta {
  axis: string;
  dtype: string;
  endian: string;
  xSize: number;
  ySize: number;
  zSize: number;
}

export interface ParquetMaskEntry {
  id: string;
  layer: number;
  labels: LabelEntry[];
  maskPngPath: string;
  meta: VolumeMeta;
}

export async function rawOpen(req: RawOpenRequest): Promise<RawOpenResponse> {
  return invoke<RawOpenResponse>('raw_open', { req });
}

export async function rawSlice(volumeId: string, index: number): Promise<RawSliceResponse> {
  return invoke<RawSliceResponse>('raw_slice', { volumeId, index });
}

export async function rawExportParquet(
  volumeId: string,
  masks: ParquetMaskEntry[],
  outputPath: string
): Promise<string> {
  return invoke<string>('parquet_export_masks', { volumeId, masks, outputPath });
}
