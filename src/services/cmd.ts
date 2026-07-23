import { invoke } from '@tauri-apps/api/core';
import { ConfigSchema } from '@/schemas/config';
import type {
  Config,
  McpServerConfig,
  ShellType,
  FrontendConfig,
  LogLevel,
} from '@/schemas/config';

export async function greet(): Promise<void> {
  return invoke<void>('greet');
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
};

let _currentLogLevel: LogLevel = 'trace';

export function setLogLevelFilter(level: LogLevel) {
  _currentLogLevel = level;
}

export async function logMessage(level: LogLevel, message: string): Promise<void> {
  if (LOG_LEVEL_PRIORITY[level] < LOG_LEVEL_PRIORITY[_currentLogLevel]) return;
  return invoke<void>('log_message', { level, message });
}

export async function setLogLevel(level: LogLevel): Promise<void> {
  return invoke<void>('set_log_level', { level });
}

export type { Config, McpServerConfig, ShellType, FrontendConfig };

// Config commands
export async function getConfig(): Promise<Config> {
  const data = await invoke<unknown>('get_config');
  return ConfigSchema.parse(data);
}

export async function updateConfig(newConfig: Config): Promise<void> {
  return invoke<void>('update_config', { newConfig });
}

// MCP types
export interface ToolInfo {
  server_name: string;
  tool: {
    name: string;
    description?: string;
    inputSchema: Record<string, unknown>;
  };
}

export interface TextContent {
  type: 'text';
  text: string;
}

export interface ImageContent {
  type: 'image';
  /** mcp:// URL after materialization */
  data: string;
  mimeType: string;
}

export interface EmbeddedResource {
  type: 'resource';
  resource: {
    uri: string;
    text?: string;
    blob?: string;
    mimeType?: string;
  };
}

export type ContentBlock = TextContent | ImageContent | EmbeddedResource;

export interface CallToolResult {
  content: ContentBlock[];
  structuredContent?: unknown;
  isError?: boolean;
  _meta?: Record<string, unknown>;
}

export type ServerStatus = 'Starting' | 'Running' | 'Stopped' | { Failed: { error: string } };

// MCP commands
export async function mcpListTools(): Promise<ToolInfo[]> {
  return invoke<ToolInfo[]>('mcp_list_tools');
}

export async function mcpCallTool(
  serverName: string,
  toolName: string,
  arguments_?: Record<string, unknown>
): Promise<CallToolResult> {
  return invoke<CallToolResult>('mcp_call_tool', {
    serverName,
    toolName,
    arguments: arguments_,
  });
}

export async function mcpServerStatus(serverName: string): Promise<ServerStatus> {
  return invoke<ServerStatus>('mcp_server_status', { serverName });
}

// MCP Panel types
export interface ServerInfo {
  name: string;
  version: string;
  has_tools: boolean;
  has_prompts: boolean;
  has_resources: boolean;
}

export interface PromptInfo {
  server_name: string;
  prompt: {
    name: string;
    description?: string;
    arguments?: Array<{
      name: string;
      description?: string;
      required?: boolean;
    }>;
  };
}

export interface ResourceInfo {
  server_name: string;
  resource: {
    uri: string;
    name: string;
    description?: string;
    mime_type?: string;
  };
}

// MCP content store
export async function mcpStoreContent(path: string): Promise<string> {
  return invoke<string>('mcp_store_content', { path });
}

export async function mcpStoreImageBytes(data: number[], mimeType: string): Promise<string> {
  return invoke<string>('mcp_store_image_bytes', { data, mimeType });
}

// MCP Panel commands
export async function mcpServerInfo(serverName: string): Promise<ServerInfo | null> {
  return invoke<ServerInfo | null>('mcp_server_info', { serverName });
}

export async function mcpListPrompts(): Promise<PromptInfo[]> {
  return invoke<PromptInfo[]>('mcp_list_prompts');
}

export async function mcpListResources(): Promise<ResourceInfo[]> {
  return invoke<ResourceInfo[]>('mcp_list_resources');
}
