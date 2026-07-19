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

export interface MaskEntry {
  index: number;
  maskPngPath: string;
}

export async function rawOpen(req: RawOpenRequest): Promise<RawOpenResponse> {
  return invoke<RawOpenResponse>('raw_open', { req });
}

export async function rawSlice(volumeId: string, index: number): Promise<RawSliceResponse> {
  return invoke<RawSliceResponse>('raw_slice', { volumeId, index });
}

export async function rawExportMasks(
  volumeId: string,
  masks: MaskEntry[],
  outputPath: string
): Promise<string> {
  return invoke<string>('raw_export_masks', { volumeId, masks, outputPath });
}
