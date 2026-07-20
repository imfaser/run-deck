<script setup lang="ts">
  // ========== 1. 第三方 / 内部模块引入 ==========
  import { ref, watch } from 'vue';
  import { useDebounceFn } from '@vueuse/core';
  import { ElMessage, ElMessageBox } from 'element-plus';
  import { match } from 'ts-pattern';
  import { FrontendConfigSchema, ShellTypeSchema } from '@/schemas/config';
  import {
    updateConfig,
    logMessage,
    mcpServerStatus,
    type McpServerConfig,
    type ServerStatus,
  } from '@/services/cmd';
  import GeneralSettings from '@/components/config/GeneralSettings.vue';
  import McpServerList from '@/components/config/McpServerList.vue';
  import McpServerForm from '@/components/config/McpServerForm.vue';
  import PageLayout from '@/components/layout/PageLayout.vue';
  import { useTheme } from '@/composables/useTheme';
  import { useConfigQuery } from '@/composables/useConfigQuery';
  import { useMcpMutation } from '@/composables/useMcpMutation';

  // ========== 2. 组合式函数（Composables）调用 ==========
  const { setTheme } = useTheme();
  const { data: config, isLoading: loading, isError, error } = useConfigQuery();
  const configMutation = useMcpMutation();

  // ========== 3. 响应式状态声明 ==========
  const activeSection = ref('general');
  const serverStatuses = ref<Record<string, ServerStatus>>({});
  const editingServer = ref<{ name: string; config: McpServerConfig; isNew?: boolean } | null>(
    null
  );
  const isDirty = ref(false);

  // ========== 4. 常量 ==========
  const sections = [
    { key: 'general', label: '通用', icon: '⚙' },
    { key: 'mcp', label: 'MCP 服务器', icon: '🔌' },
  ];

  const debouncedUpdateConfig = useDebounceFn(async (cfg: typeof config.value) => {
    if (!cfg) return;
    configMutation.mutate(cfg);
  }, 500);

  // ========== 5. 侦听器 ==========
  watch(config, () => {
    refreshServerStatuses();
  });

  // ========== 6. 普通方法与业务逻辑 ==========
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

  async function handleConfigUpdate(key: string, value: unknown) {
    if (!config.value) return;
    match(key)
      .with('log_level', () => {
        config.value!.log_level = String(value);
      })
      .with('frontend.home', () => {
        config.value!.frontend.home = String(value);
      })
      .with('frontend.mode', () => {
        const mode = FrontendConfigSchema.shape.mode.parse(value);
        config.value!.frontend.mode = mode;
        setTheme(mode);
      })
      .with('shell', () => {
        config.value!.shell = ShellTypeSchema.parse(value);
      })
      .otherwise(() => {});
    debouncedUpdateConfig(config.value);
  }

  function addServer(type: 'local' | 'remote') {
    if (!config.value) return;
    const name = 'MCP 服务器';
    const newConfig = match(type)
      .with('local', (): McpServerConfig => ({ type: 'local', command: [], enabled: true }))
      .with('remote', (): McpServerConfig => ({ type: 'remote', url: '', enabled: true }))
      .exhaustive();
    editingServer.value = { name, config: newConfig, isNew: true };
    isDirty.value = false;
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
    isDirty.value = false;
  }

  async function saveServer() {
    if (!editingServer.value || !config.value) return;
    const { name, config: cfg } = editingServer.value;
    if (!name.trim()) {
      ElMessage.warning('服务器名称不能为空');
      return;
    }
    config.value.mcp[name] = cfg;
    try {
      await updateConfig(config.value);
      ElMessage.success('保存成功');
      backToList();
    } catch (e) {
      await logMessage('error', `配置更新失败: ${e}`);
    }
  }

  async function handleMenuSelect(key: string) {
    if (isDirty.value && editingServer.value) {
      try {
        await ElMessageBox.confirm('有未保存的修改，确定离开吗？', '未保存的修改', {
          confirmButtonText: '确定离开',
          cancelButtonText: '取消',
          type: 'warning',
        });
      } catch {
        return;
      }
      editingServer.value = null;
      isDirty.value = false;
    }
    activeSection.value = key;
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
      if (editingServer.value?.name === name) {
        editingServer.value = null;
      }
      await updateConfig(config.value);
      ElMessage.success('已删除');
    } catch {
      // cancelled
    }
  }

  async function toggleServer(name: string) {
    if (!config.value) return;
    const cfg = config.value.mcp[name];
    if (cfg) {
      cfg.enabled = !cfg.enabled;
      try {
        await updateConfig(config.value);
      } catch (e) {
        await logMessage('error', `配置更新失败: ${e}`);
      }
    }
  }

  function updateServerName(newName: string) {
    if (!editingServer.value) return;
    editingServer.value.name = newName;
    isDirty.value = true;
  }

  function updateServerConfig(newConfig: McpServerConfig) {
    if (!editingServer.value) return;
    editingServer.value.config = newConfig;
    isDirty.value = true;
  }
</script>

<template>
  <PageLayout v-loading="loading">
    <template #aside>
      <div class="sidebar-title">设置</div>
      <el-menu :default-active="activeSection" class="sidebar-nav" @select="handleMenuSelect">
        <el-menu-item v-for="section in sections" :key="section.key" :index="section.key">
          {{ section.label }}
        </el-menu-item>
      </el-menu>
    </template>

    <el-alert v-if="isError" :title="String(error)" type="error" show-icon class="error-alert" />

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
          :existing-names="Object.keys(config.mcp)"
          :is-dirty="isDirty"
          :is-new="editingServer.isNew"
          @back="backToList"
          @save="saveServer"
          @update:name="updateServerName"
          @update:config="updateServerConfig"
          @dirty-change="(v: boolean) => (isDirty = v)"
        />
        <McpServerList
          v-else
          :servers="config.mcp"
          :statuses="serverStatuses"
          @add="(type) => addServer(type)"
          @edit="editServer"
          @remove="removeServer"
          @toggle="toggleServer"
        />
      </template>
    </template>
  </PageLayout>
</template>

<style scoped lang="scss">
  .sidebar-title {
    font-size: var(--text-lg);
    font-weight: var(--font-bold);
    padding: 0 var(--spacing-rem-lg);
    margin-bottom: var(--spacing-rem-base);
    color: var(--text-primary);
  }

  .sidebar-nav {
    border-right: none;
  }

  :deep(.el-menu-item) {
    &.is-active {
      background: var(--accent-muted);
    }
  }

  .error-alert {
    margin-bottom: var(--spacing-rem-base);
  }
</style>
