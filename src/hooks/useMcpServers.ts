import { useMemo } from 'react';
import useSWR from 'swr';
import {
  mcpServerStatus,
  mcpServerInfo,
  mcpListTools,
  mcpListPrompts,
  mcpListResources,
} from '@/services/cmds';
import { useConfig } from './useConfig';
import type {
  McpServerConfig,
  ServerStatus,
  ServerInfo,
  ToolInfo,
  PromptInfo,
  ResourceInfo,
} from '@/schemas/config';

export interface McpServerConfigEntry {
  name: string;
  config: McpServerConfig;
}

/** Returns all MCP server configs from the config (no status queries). */
export function useMcpServerConfigs(): McpServerConfigEntry[] {
  const { config } = useConfig();
  return useMemo(
    () =>
      Object.entries(config?.mcp ?? {}).map(([name, serverConfig]) => ({
        name,
        config: serverConfig,
      })),
    [config?.mcp]
  );
}

/** Fetches status + info for a single named server. */
export function useMcpServerStatus(name: string, enabled: boolean) {
  const { data: status, isLoading: isStatusLoading } = useSWR<ServerStatus>(
    enabled ? ['mcp-status', name] : null,
    () => mcpServerStatus(name),
    { dedupingInterval: 10_000 }
  );
  const { data: info, isLoading: isInfoLoading } = useSWR<ServerInfo | null>(
    enabled ? ['mcp-info', name] : null,
    () => mcpServerInfo(name),
    { dedupingInterval: 30_000 }
  );
  return {
    status: status ?? null,
    info: info ?? null,
    isStatusLoading,
    isInfoLoading,
  };
}

export function useMcpTools() {
  return useSWR<ToolInfo[]>('mcp-tools', mcpListTools, { dedupingInterval: 30_000 });
}

export function useMcpPrompts() {
  return useSWR<PromptInfo[]>('mcp-prompts', mcpListPrompts, { dedupingInterval: 30_000 });
}

export function useMcpResources() {
  return useSWR<ResourceInfo[]>('mcp-resources', mcpListResources, { dedupingInterval: 30_000 });
}
