<script setup lang="ts">
  import { ref, onMounted } from 'vue';
  import { ElMessage, ElMessageBox } from 'element-plus';
  import {
    getConfig,
    updateConfig,
    saveConfig,
    configHasChanges,
    logMessage,
    mcpServerStatus,
    type Config,
    type McpServerConfig,
    type ServerStatus,
    type ShellType,
  } from '@/services/cmd';
  import GeneralSettings from '@/components/config/GeneralSettings.vue';
  import McpServerList from '@/components/config/McpServerList.vue';
  import McpServerForm from '@/components/config/McpServerForm.vue';
  import { useTheme } from '@/composables/useTheme';

  const { setTheme } = useTheme();

  const config = ref<Config | null>(null);
  const loading = ref(true);
  const saving = ref(false);
  const hasChanges = ref(false);
  const error = ref('');
  const activeSection = ref('general');
  const serverStatuses = ref<Record<string, ServerStatus>>({});
  const editingServer = ref<{ name: string; config: McpServerConfig } | null>(null);

  const sections = [
    { key: 'general', label: '通用', icon: '⚙' },
    { key: 'mcp', label: 'MCP 服务器', icon: '🔌' },
  ];

  onMounted(async () => {
    try {
      config.value = await getConfig();
      hasChanges.value = await configHasChanges();
      // Apply theme from config
      if (config.value.frontend.mode) {
        setTheme(config.value.frontend.mode);
      }
    } catch (e) {
      error.value = String(e);
    } finally {
      loading.value = false;
    }
    refreshServerStatuses();
  });

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

  async function handleSave() {
    if (!config.value) return;
    saving.value = true;
    try {
      await updateConfig(config.value);
      await saveConfig();
      hasChanges.value = await configHasChanges();
      await logMessage('info', '配置已保存');
      ElMessage.success('配置已保存');
    } catch (e) {
      const err = String(e);
      await logMessage('error', `配置保存失败: ${err}`);
      ElMessage.error(`保存失败: ${err}`);
    } finally {
      saving.value = false;
    }
  }

  function handleConfigUpdate(key: string, value: unknown) {
    if (!config.value) return;
    if (key === 'log_level') {
      config.value.log_level = value as string;
    } else if (key === 'frontend.home') {
      config.value.frontend.home = value as string;
    } else if (key === 'frontend.mode') {
      config.value.frontend.mode = value as 'dark' | 'light';
      setTheme(value as 'dark' | 'light');
    } else if (key === 'shell') {
      config.value.shell = value as ShellType;
    }
    hasChanges.value = true;
  }

  function addServer() {
    if (!config.value) return;
    const name = 'MCP 服务器';
    const newConfig: McpServerConfig = {
      type: 'local',
      command: [],
      enabled: true,
    };
    config.value.mcp[name] = newConfig;
    editingServer.value = { name, config: newConfig };
    hasChanges.value = true;
  }

  function editServer(name: string) {
    if (!config.value) return;
    const cfg = config.value.mcp[name];
    if (cfg) {
      editingServer.value = { name, config: cfg };
    }
  }

  function backToList() {
    editingServer.value = null;
  }

  async function removeServer(name: string) {
    if (!config.value) return;
    try {
      await ElMessageBox.confirm(`确定要删除 "${name}" 吗？`, '删除确认', {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning',
      });
      delete config.value.mcp[name];
      hasChanges.value = true;
      if (editingServer.value?.name === name) {
        editingServer.value = null;
      }
      ElMessage.success('已删除');
    } catch {
      // cancelled
    }
  }

  function toggleServer(name: string) {
    if (!config.value) return;
    const cfg = config.value.mcp[name];
    if (cfg) {
      cfg.enabled = !cfg.enabled;
      hasChanges.value = true;
    }
  }

  function updateServerName(newName: string) {
    if (!editingServer.value || !config.value) return;
    const oldName = editingServer.value.name;
    if (!newName.trim() || oldName === newName) return;
    const cfg = config.value.mcp[oldName];
    if (cfg) {
      delete config.value.mcp[oldName];
      config.value.mcp[newName] = cfg;
      editingServer.value.name = newName;
      hasChanges.value = true;
    }
  }

  function updateServerConfig(newConfig: McpServerConfig) {
    if (!editingServer.value || !config.value) return;
    editingServer.value.config = newConfig;
    config.value.mcp[editingServer.value.name] = newConfig;
    hasChanges.value = true;
  }
</script>

<template>
  <div v-loading="loading" class="config-page">
    <aside class="config-sidebar">
      <div class="sidebar-title">设置</div>
      <nav class="sidebar-nav">
        <button
          v-for="section in sections"
          :key="section.key"
          :class="['nav-item', { active: activeSection === section.key }]"
          @click="activeSection = section.key"
        >
          <span class="nav-label">{{ section.label }}</span>
        </button>
      </nav>
    </aside>

    <main class="config-main">
      <div v-if="error" class="error-banner">{{ error }}</div>

      <template v-else-if="config">
        <GeneralSettings
          v-if="activeSection === 'general'"
          :config="config"
          @update="handleConfigUpdate"
        />

        <template v-if="activeSection === 'mcp'">
          <McpServerForm
            v-if="editingServer"
            :name="editingServer.name"
            :config="editingServer.config"
            @back="backToList"
            @update:name="updateServerName"
            @update:config="updateServerConfig"
          />
          <McpServerList
            v-else
            :servers="config.mcp"
            :statuses="serverStatuses"
            @add="addServer"
            @edit="editServer"
            @remove="removeServer"
            @toggle="toggleServer"
          />
        </template>

        <div v-if="!editingServer" class="config-footer">
          <el-button type="primary" :loading="saving" @click="handleSave">保存配置</el-button>
        </div>
      </template>
    </main>
  </div>
</template>

<style scoped lang="scss">
  .config-page {
    display: flex;
    min-height: calc(100vh - 40px);
    background: var(--bg-secondary);
    color: var(--text-primary);
  }

  .config-sidebar {
    width: 200px;
    background: var(--bg-tertiary);
    border-right: 1px solid var(--border-default);
    padding: 1.5rem 0;
    flex-shrink: 0;
  }

  .sidebar-title {
    font-size: 1.125rem;
    font-weight: 600;
    padding: 0 1.25rem;
    margin-bottom: 1rem;
    color: var(--text-primary);
  }

  .sidebar-nav {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .nav-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1.25rem;
    border: none;
    background: none;
    color: var(--text-secondary);
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s;
    text-align: left;
    width: 100%;

    &:hover {
      background: var(--surface-hover);
      color: var(--text-primary);
    }

    &.active {
      background: var(--accent-muted);
      color: var(--accent-hover);
    }
  }

  .config-main {
    flex: 1;
    padding: 2rem;
    overflow-y: auto;
  }

  .error-banner {
    padding: 1rem;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 8px;
    color: var(--status-error);
  }

  .config-footer {
    margin-top: 2rem;
    padding-top: 1.5rem;
    border-top: 1px solid var(--border-default);
  }

  @media (max-width: 768px) {
    .config-page {
      flex-direction: column;
    }

    .config-sidebar {
      width: 100%;
      border-right: none;
      border-bottom: 1px solid var(--border-default);
      padding: 1rem 0;
    }

    .sidebar-nav {
      flex-direction: row;
      overflow-x: auto;
      padding: 0 1rem;
    }

    .nav-item {
      white-space: nowrap;
      padding: 0.5rem 1rem;
    }

    .config-main {
      padding: 1.5rem 1rem;
    }
  }
</style>
