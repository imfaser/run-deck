import { invoke } from '@tauri-apps/api/core';
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

// --- Client-side log filter ---

const LOG_LEVEL_PRIORITY: Record<string, number> = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
};

let currentLogLevelFilter = LOG_LEVEL_PRIORITY['info'];

export function setLogLevelFilter(level: string) {
  currentLogLevelFilter = LOG_LEVEL_PRIORITY[level] ?? LOG_LEVEL_PRIORITY['info'];
}

// --- Config ---

export async function getConfig(): Promise<Config> {
  const raw = await invoke<unknown>('get_config');
  return parseConfig(raw);
}

export async function updateConfig(newConfig: Config): Promise<void> {
  await invoke('update_config', { newConfig });
}

// --- Log ---

export async function setLogLevel(level: string): Promise<void> {
  await invoke('set_log_level', { level });
}

export async function logMessage(level: string, message: string): Promise<void> {
  if ((LOG_LEVEL_PRIORITY[level] ?? LOG_LEVEL_PRIORITY['info']) < currentLogLevelFilter) {
    return;
  }
  await invoke('log_message', { level, message });
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
