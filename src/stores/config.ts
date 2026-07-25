import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import { useQueryClient } from '@tanstack/vue-query';
import { match } from 'ts-pattern';
import { ElMessage } from 'element-plus/es/components/message/index.mjs';
import { ElMessageBox } from 'element-plus/es/components/message-box/index.mjs';
import { FrontendConfigSchema, ShellTypeSchema } from '@/schemas/config';
import {
  logMessage,
  setLogLevel,
  setLogLevelFilter,
  mcpServerStatus,
  updateConfig,
  type McpServerConfig,
  type ServerStatus,
} from '@/services/cmd';
import type { Config } from '@/services/cmd';
import { useConfigQuery } from '@/composables/useConfigQuery';
import { useTheme } from '@/composables/useTheme';

export const useConfigStore = defineStore('config', () => {
  const queryClient = useQueryClient();
  const { data: config, isLoading: loading, isError, error } = useConfigQuery();
  const { setTheme } = useTheme();

  const editingServer = ref<{ name: string; config: McpServerConfig; isNew?: boolean } | null>(
    null
  );
  const serverStatuses = ref<Record<string, ServerStatus>>({});

  // Sync frontend log level filter when config loads
  watch(
    config,
    (cfg) => {
      if (cfg?.log_level) {
        setLogLevelFilter(cfg.log_level);
      }
    },
    { immediate: true }
  );

  function updateQuery(patch: Partial<Config>) {
    queryClient.setQueryData<Config>(['config'], (old) => ({ ...old!, ...patch }));
  }

  async function persist() {
    const latest = queryClient.getQueryData<Config>(['config']);
    if (!latest) return;
    try {
      await updateConfig(latest);
    } catch (e) {
      await logMessage('error', `配置更新失败: ${e}`);
    }
  }

  async function refreshServerStatuses() {
    if (!config.value) return;
    for (const name of Object.keys(config.value.mcp)) {
      try {
        serverStatuses.value[name] = await mcpServerStatus(name);
      } catch {
        serverStatuses.value[name] = 'Stopped';
      }
    }
  }

  function handleConfigUpdate(key: string, value: unknown) {
    if (!config.value) return;
    match(key)
      .with('log_level', async () => {
        const level = String(value) as Config['log_level'];
        updateQuery({ log_level: level });
        setLogLevelFilter(level);
        try {
          await setLogLevel(level);
        } catch (e) {
          await logMessage('error', `Failed to update log level: ${e}`);
        }
      })
      .with('frontend.home', () =>
        updateQuery({ frontend: { ...config.value!.frontend, home: String(value) } })
      )
      .with('frontend.mode', () => {
        const mode = FrontendConfigSchema.shape.mode.parse(value);
        updateQuery({ frontend: { ...config.value!.frontend, mode } });
        setTheme(mode);
      })
      .with('shell', () => updateQuery({ shell: ShellTypeSchema.parse(value) }))
      .otherwise(() => {});
    persist();
  }

  function addServer(type: 'local' | 'remote') {
    if (!config.value) return;
    const name = 'MCP 服务器';
    const newConfig = match(type)
      .with('local', (): McpServerConfig => ({ type: 'local', command: [], enabled: true }))
      .with('remote', (): McpServerConfig => ({ type: 'remote', url: '', enabled: true }))
      .exhaustive();
    editingServer.value = { name, config: newConfig, isNew: true };
  }

  function editServer(name: string) {
    if (!config.value) return;
    const cfg = config.value.mcp[name];
    if (cfg) {
      editingServer.value = { name, config: cfg, isNew: false };
    }
  }

  function backToList() {
    editingServer.value = null;
  }

  async function saveServer() {
    if (!editingServer.value || !config.value) return;
    const { name, config: cfg } = editingServer.value;
    if (!name.trim()) {
      ElMessage.warning('服务器名称不能为空');
      return;
    }
    updateQuery({ mcp: { ...config.value.mcp, [name]: cfg } });
    await persist();
    backToList();
  }

  async function removeServer(name: string) {
    if (!config.value) return;
    try {
      await ElMessageBox.confirm(`确定要删除 "${name}" 吗？`, '删除确认', {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning',
      });
      const rest = { ...config.value.mcp };
      delete rest[name];
      updateQuery({ mcp: rest });
      if (editingServer.value?.name === name) editingServer.value = null;
      await persist();
    } catch {
      // cancelled
    }
  }

  async function toggleServer(name: string) {
    if (!config.value) return;
    const cfg = config.value.mcp[name];
    if (cfg) {
      updateQuery({ mcp: { ...config.value.mcp, [name]: { ...cfg, enabled: !cfg.enabled } } });
      await persist();
    }
  }

  function updateServerName(newName: string) {
    if (!editingServer.value) return;
    editingServer.value.name = newName;
  }

  function updateServerConfig(newConfig: McpServerConfig) {
    if (!editingServer.value) return;
    editingServer.value.config = newConfig;
  }

  return {
    config,
    loading,
    isError,
    error,
    editingServer,
    serverStatuses,
    refreshServerStatuses,
    handleConfigUpdate,
    addServer,
    editServer,
    backToList,
    saveServer,
    removeServer,
    toggleServer,
    updateServerName,
    updateServerConfig,
  };
});
