import { invoke } from '@tauri-apps/api/core';
import { toCamelCaseKeys } from 'es-toolkit';
import {
  parseConfig,
  ServerStatusSchema,
  ServerInfoSchema,
  ToolInfoSchema,
  PromptInfoSchema,
  ResourceInfoSchema,
  type Config,
  type ServerStatus,
  type ServerInfo,
  type ToolInfo,
  type PromptInfo,
  type ResourceInfo,
} from '@/schemas/config';
import {
  LabelSchema,
  type Label,
  type LabelCreateInput,
  type LabelOrderInput,
  type LabelUpdateInput,
} from '@/schemas/label';
import {
  AnnotationSchema,
  AnnotationCountSchema,
  NearestVisualSchema,
  type Annotation,
  type AnnotationCount,
  type AnnotationInput,
  type NearestVisual,
} from '@/schemas/annotation';
import { ImageSchema, type Image, type ImageUpsertInput } from '@/schemas/image';
import {
  OpenVolumeResponseSchema,
  SliceResponseSchema,
  type OpenVolumeInput,
  type OpenVolumeResponse,
  type SliceResponse,
} from '@/schemas/volume';

// --- Log ---

// 日志级别过滤由 Rust 端 flexi_logger 统一负责，前端不预滤，避免与 Rust 级别不一致时丢失日志

export async function setLogLevel(level: string): Promise<void> {
  await invoke('set_log_level', { level });
}

export async function logMessage(level: string, message: string): Promise<void> {
  await invoke('log_message', { level, message });
}

export async function getLogDir(): Promise<string> {
  return await invoke<string>('get_log_dir');
}

export async function cleanupLogs(): Promise<number> {
  return await invoke<number>('cleanup_logs');
}

export interface LogEntry {
  ts: string;
  level: string;
  message: string;
}

export async function getLatestLogs(n: number): Promise<LogEntry[]> {
  return await invoke<LogEntry[]>('get_latest_logs', { n });
}

export async function setLogEmit(enabled: boolean): Promise<void> {
  await invoke('set_log_emit', { enabled });
}

// --- Config ---

export async function getConfig(): Promise<Config> {
  const raw = await invoke<unknown>('get_config');
  return parseConfig(raw);
}

export async function updateConfig(newConfig: Config): Promise<void> {
  await invoke('update_config', { newConfig });
}

// --- MCP ---

export async function mcpListTools(): Promise<ToolInfo[]> {
  const raw = await invoke<unknown>('mcp_list_tools');
  return ToolInfoSchema.array().parse(raw);
}

export async function mcpServerStatus(serverName: string): Promise<ServerStatus> {
  const raw = await invoke<unknown>('mcp_server_status', { serverName });
  return ServerStatusSchema.parse(raw);
}

export async function mcpServerInfo(serverName: string): Promise<ServerInfo | null> {
  const raw = await invoke<unknown>('mcp_server_info', { serverName });
  if (raw === null || raw === undefined) {
    return null;
  }
  return ServerInfoSchema.parse(raw);
}

export async function mcpListPrompts(): Promise<PromptInfo[]> {
  const raw = await invoke<unknown>('mcp_list_prompts');
  return PromptInfoSchema.array().parse(raw);
}

export async function mcpListResources(): Promise<ResourceInfo[]> {
  const raw = await invoke<unknown>('mcp_list_resources');
  return ResourceInfoSchema.array().parse(raw);
}

// --- Raw3D ---

export async function openRaw(req: OpenVolumeInput): Promise<OpenVolumeResponse> {
  const raw = await invoke<unknown>('open_raw', { req });
  return OpenVolumeResponseSchema.parse(raw);
}

export async function hasRaw(path: string): Promise<OpenVolumeResponse | null> {
  const raw = await invoke<unknown>('has_raw', { path });
  if (raw === null || raw === undefined) {
    return null;
  }
  return OpenVolumeResponseSchema.parse(raw);
}

export async function rawSlice(volumeId: string, index: number): Promise<SliceResponse> {
  const raw = await invoke<unknown>('raw_slice', { volumeId, index });
  return SliceResponseSchema.parse(raw);
}

export async function rawClose(volumeId: string): Promise<void> {
  await invoke('raw_close', { volumeId });
}

export async function parquetExportSlices(volumeId: string, outputPath: string): Promise<string> {
  return invoke<string>('parquet_export_slices', { volumeId, outputPath });
}

// --- Labels ---

export async function dbCreateLabel(input: LabelCreateInput): Promise<Label> {
  const raw = await invoke<unknown>('db_create_label', {
    name: input.name,
    color: input.color,
    order: input.order,
    subLabels: input.sub_labels ?? [],
  });
  return LabelSchema.parse(raw);
}

export async function dbListLabels(): Promise<Label[]> {
  const raw = await invoke<unknown>('db_list_labels');
  return LabelSchema.array().parse(raw);
}

export async function dbUpdateLabel(input: LabelUpdateInput): Promise<Label> {
  const raw = await invoke<unknown>('db_update_label', {
    id: input.id,
    name: input.name,
    color: input.color,
    order: input.order,
    subLabels: input.sub_labels,
  });
  return LabelSchema.parse(raw);
}

export async function dbReorderLabels(inputs: LabelOrderInput[]): Promise<void> {
  await invoke('db_reorder_labels', { inputs });
}

export async function dbDeleteLabel(id: string): Promise<void> {
  await invoke('db_delete_label', { id });
}

// --- Images ---

export async function dbUpsertImage(input: ImageUpsertInput): Promise<Image> {
  // Rust 端 ImageUpsertInput 标注 `rename_all = "camelCase"`，发送边界统一转 camelCase
  const raw = await invoke<unknown>('db_upsert_image', { input: toCamelCaseKeys(input) });
  return ImageSchema.parse(raw);
}

export async function dbGetImageByHash(hash: string): Promise<Image | null> {
  const raw = await invoke<unknown>('db_get_image_by_hash', { hash });
  if (raw === null || raw === undefined) {
    return null;
  }
  return ImageSchema.parse(raw);
}

export async function dbListImagesByVolume(volumeId: string): Promise<Image[]> {
  const raw = await invoke<unknown>('db_list_images_by_volume', { volumeId });
  return ImageSchema.array().parse(raw);
}

export async function dbUpdateMaskHash(hash: string, maskHash: string | null): Promise<Image> {
  const raw = await invoke<unknown>('db_update_mask_hash', { hash, maskHash });
  return ImageSchema.parse(raw);
}

// --- Annotations ---

export async function dbSetAnnotations(
  hash: string,
  annotations: AnnotationInput[]
): Promise<Image> {
  const raw = await invoke<unknown>('db_set_annotations', { hash, annotations });
  return ImageSchema.parse(raw);
}

export async function dbNearestVisualBox(
  imageHash: string,
  labelId: string
): Promise<NearestVisual | null> {
  const raw = await invoke<unknown>('db_nearest_visual_box', { imageHash, labelId });
  if (raw === null || raw === undefined) {
    return null;
  }
  return NearestVisualSchema.parse(raw);
}

export async function dbListAnnotationsByImage(hash: string): Promise<Annotation[]> {
  const raw = await invoke<unknown>('db_list_annotations_by_image', { hash });
  return AnnotationSchema.array().parse(raw);
}

export async function dbListAnnotationCounts(volumeId: string): Promise<AnnotationCount[]> {
  const raw = await invoke<unknown>('db_list_annotation_counts', { volumeId });
  return AnnotationCountSchema.array().parse(raw);
}
