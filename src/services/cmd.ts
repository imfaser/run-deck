import { invoke } from '@tauri-apps/api/core';

export async function greet(): Promise<void> {
  return invoke<void>('greet');
}

type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'trace';

export async function logMessage(level: LogLevel, message: string): Promise<void> {
  return invoke<void>('log_message', { level, message });
}

// MCP types
export interface ToolInfo {
  server_name: string;
  tool: {
    name: string;
    description?: string;
    input_schema: Record<string, unknown>;
  };
}

export interface CallToolResult {
  content: Array<{ type: string; text?: string }>;
  is_error?: boolean;
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
