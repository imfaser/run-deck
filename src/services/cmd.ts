import { invoke } from '@tauri-apps/api/core';

export async function greet(): Promise<void> {
  return invoke<void>('greet');
}

type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'trace';

export async function logMessage(level: LogLevel, message: string): Promise<void> {
  return invoke<void>('log_message', { level, message });
}

// Config types
export interface FrontendConfig {
  home: string;
  mode: 'dark' | 'light';
}

export type ShellType = 'auto' | 'cmd' | 'powershell' | 'bash';

export type McpServerConfig =
  | {
      type: 'local';
      command: string[];
      environment?: Record<string, string>;
      enabled: boolean;
      timeout?: number;
    }
  | {
      type: 'remote';
      url: string;
      headers?: Record<string, string>;
      enabled: boolean;
      timeout?: number;
    };

export interface Config {
  log_level: string;
  shell: ShellType;
  frontend: FrontendConfig;
  mcp: Record<string, McpServerConfig>;
}

// Config commands
export async function getConfig(): Promise<Config> {
  return invoke<Config>('get_config');
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
