import { computed } from 'vue';
import { useQueries } from '@tanstack/vue-query';
import {
  mcpServerStatus,
  mcpServerInfo,
  type Config,
  type ServerStatus,
  type ServerInfo,
} from '@/services/cmd';

export function useMcpServers(config: () => Config | undefined) {
  const serverNames = computed(() => {
    const cfg = config();
    return cfg ? Object.keys(cfg.mcp) : [];
  });

  const statusQueries = useQueries({
    queries: computed(() =>
      serverNames.value.map((name) => ({
        queryKey: ['mcp-status', name] as const,
        queryFn: () => mcpServerStatus(name),
        staleTime: 10_000,
      }))
    ),
  });

  const infoQueries = useQueries({
    queries: computed(() =>
      serverNames.value.map((name) => ({
        queryKey: ['mcp-info', name] as const,
        queryFn: () => mcpServerInfo(name),
        staleTime: 30_000,
      }))
    ),
  });

  const serverStatuses = computed(() => {
    const map: Record<string, ServerStatus> = {};
    serverNames.value.forEach((name, i) => {
      const q = statusQueries.value[i];
      map[name] = q?.data ?? 'Stopped';
    });
    return map;
  });

  const serverInfos = computed(() => {
    const map: Record<string, ServerInfo | null> = {};
    serverNames.value.forEach((name, i) => {
      const q = infoQueries.value[i];
      map[name] = q?.data ?? null;
    });
    return map;
  });

  return {
    serverNames,
    statusQueries,
    infoQueries,
    serverStatuses,
    serverInfos,
  };
}
