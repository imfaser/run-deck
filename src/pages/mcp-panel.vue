<script setup lang="ts">
  import { ref, onMounted, computed } from 'vue';
  import {
    getConfig,
    mcpServerStatus,
    mcpListTools,
    mcpListPrompts,
    mcpListResources,
    mcpServerInfo,
    type Config,
    type McpServerConfig,
    type ServerStatus,
    type ToolInfo,
    type PromptInfo,
    type ResourceInfo,
    type ServerInfo,
  } from '@/services/cmd';

  const loading = ref(true);
  const error = ref('');
  const config = ref<Config | null>(null);
  const selectedServer = ref<string>('');
  const activeTab = ref('tools');

  const serverStatuses = ref<Record<string, ServerStatus>>({});
  const serverInfos = ref<Record<string, ServerInfo | null>>({});
  const tools = ref<ToolInfo[]>([]);
  const prompts = ref<PromptInfo[]>([]);
  const resources = ref<ResourceInfo[]>([]);

  const serverList = computed(() => {
    if (!config.value) return [];
    return Object.entries(config.value.mcp).map(([name, cfg]) => ({
      name,
      config: cfg,
      status: serverStatuses.value[name] ?? ('Stopped' as ServerStatus),
      info: serverInfos.value[name] ?? null,
    }));
  });

  const selectedServerTools = computed(() =>
    tools.value.filter((t) => t.server_name === selectedServer.value)
  );

  const selectedServerPrompts = computed(() =>
    prompts.value.filter((p) => p.server_name === selectedServer.value)
  );

  const selectedServerResources = computed(() =>
    resources.value.filter((r) => r.server_name === selectedServer.value)
  );

  const selectedServerInfo = computed(() => serverInfos.value[selectedServer.value] ?? null);

  const isServerRunning = computed(() => {
    const status = serverStatuses.value[selectedServer.value];
    return status === 'Running';
  });

  onMounted(async () => {
    try {
      config.value = await getConfig();
      if (config.value) {
        const names = Object.keys(config.value.mcp);
        await Promise.allSettled(names.map((name) => fetchServerData(name)));
        if (names.length > 0) {
          await loadServerDetails(names[0]);
        }
      }
    } catch (e) {
      error.value = String(e);
    } finally {
      loading.value = false;
    }
  });

  async function fetchServerData(name: string) {
    try {
      serverStatuses.value[name] = await mcpServerStatus(name);
    } catch {
      serverStatuses.value[name] = 'Stopped';
    }

    try {
      serverInfos.value[name] = await mcpServerInfo(name);
    } catch {
      serverInfos.value[name] = null;
    }
  }

  async function loadServerDetails(name: string) {
    selectedServer.value = name;
    activeTab.value = 'tools';

    // 先刷新服务器状态
    await fetchServerData(name);

    if (!isServerRunning.value) return;

    try {
      const [toolsResult, promptsResult, resourcesResult] = await Promise.allSettled([
        mcpListTools(),
        mcpListPrompts(),
        mcpListResources(),
      ]);

      if (toolsResult.status === 'fulfilled') {
        tools.value = toolsResult.value;
      }
      if (promptsResult.status === 'fulfilled') {
        prompts.value = promptsResult.value;
      }
      if (resourcesResult.status === 'fulfilled') {
        resources.value = resourcesResult.value;
      }
    } catch (e) {
      error.value = String(e);
    }
  }

  function getStatusColor(status: ServerStatus): string {
    if (status === 'Running') return '#22c55e';
    if (status === 'Starting') return '#f59e0b';
    return '#6b7280';
  }

  function getServerTypeLabel(cfg: McpServerConfig): string {
    return cfg.type === 'local' ? 'STDIO' : 'HTTP';
  }

  function getSchemaProperties(schema: Record<string, unknown> | undefined | null): Array<{
    name: string;
    type: string;
    required: boolean;
    description: string;
  }> {
    if (!schema) return [];
    const properties = (schema as Record<string, Record<string, unknown>>).properties;
    const required = ((schema as Record<string, string[]>).required ?? []) as string[];

    if (!properties) return [];

    return Object.entries(properties).map(([name, prop]) => ({
      name,
      type: (prop.type as string) ?? 'unknown',
      required: required.includes(name),
      description: (prop.description as string) ?? '',
    }));
  }
</script>

<template>
  <div v-loading="loading" class="mcp-panel">
    <div v-if="error" class="error-banner">{{ error }}</div>

    <aside class="panel-sidebar">
      <div class="sidebar-title">MCP 服务器</div>
      <nav class="sidebar-nav">
        <button
          v-for="server in serverList"
          :key="server.name"
          :class="['server-item', { active: selectedServer === server.name }]"
          @click="loadServerDetails(server.name)"
        >
          <div class="server-name">{{ server.name }}</div>
          <div class="server-meta">
            <span v-if="server.info" class="server-version">{{ server.info.version }}</span>
            <span class="server-type">{{ getServerTypeLabel(server.config) }}</span>
            <span class="status-dot" :style="{ backgroundColor: getStatusColor(server.status) }" />
          </div>
        </button>
      </nav>
    </aside>

    <main class="panel-main">
      <div v-if="!selectedServer" class="empty-state">
        <p>请选择一个 MCP 服务器查看详情</p>
      </div>

      <template v-else>
        <div class="server-header">
          <h2 class="server-title">{{ selectedServer }}</h2>
          <span v-if="selectedServerInfo" class="server-version-badge">
            {{ selectedServerInfo.version }}
          </span>
        </div>

        <div v-if="!isServerRunning" class="empty-state">
          <p>服务器未运行</p>
          <p class="hint">请在配置页面启动此服务器</p>
        </div>

        <template v-else>
          <el-tabs v-model="activeTab" class="server-tabs">
            <el-tab-pane label="工具" name="tools">
              <div v-if="selectedServerTools.length === 0" class="empty-state">
                <p>暂无工具</p>
              </div>
              <div v-else class="tools-list">
                <div
                  v-for="toolInfo in selectedServerTools"
                  :key="toolInfo.tool.name"
                  class="tool-card"
                >
                  <div class="tool-header">
                    <span class="tool-name">{{ toolInfo.tool.name }}</span>
                    <span v-if="toolInfo.tool.description" class="tool-desc">
                      {{ toolInfo.tool.description }}
                    </span>
                  </div>
                  <div class="tool-params">
                    <div
                      v-for="param in getSchemaProperties(toolInfo.tool.inputSchema)"
                      :key="param.name"
                      class="param-row"
                    >
                      <span class="param-name">
                        {{ param.name }}
                        <span v-if="param.required" class="required">*</span>
                      </span>
                      <span class="param-type">{{ param.type }}</span>
                      <span v-if="param.description" class="param-desc">
                        {{ param.description }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </el-tab-pane>

            <el-tab-pane :label="`提示 (${selectedServerPrompts.length})`" name="prompts">
              <div v-if="selectedServerPrompts.length === 0" class="empty-state">
                <p>暂无提示</p>
              </div>
              <div v-else class="prompts-list">
                <div
                  v-for="promptInfo in selectedServerPrompts"
                  :key="promptInfo.prompt.name"
                  class="prompt-card"
                >
                  <div class="prompt-name">{{ promptInfo.prompt.name }}</div>
                  <div v-if="promptInfo.prompt.description" class="prompt-desc">
                    {{ promptInfo.prompt.description }}
                  </div>
                  <div
                    v-if="promptInfo.prompt.arguments && promptInfo.prompt.arguments.length > 0"
                    class="prompt-args"
                  >
                    <span
                      v-for="arg in promptInfo.prompt.arguments"
                      :key="arg.name"
                      class="arg-tag"
                    >
                      {{ arg.name }}
                      <span v-if="arg.required">*</span>
                    </span>
                  </div>
                </div>
              </div>
            </el-tab-pane>

            <el-tab-pane :label="`资源 (${selectedServerResources.length})`" name="resources">
              <div v-if="selectedServerResources.length === 0" class="empty-state">
                <p>暂无资源</p>
              </div>
              <div v-else class="resources-list">
                <div
                  v-for="resourceInfo in selectedServerResources"
                  :key="resourceInfo.resource.uri"
                  class="resource-card"
                >
                  <div class="resource-name">{{ resourceInfo.resource.name }}</div>
                  <div class="resource-uri">{{ resourceInfo.resource.uri }}</div>
                  <div v-if="resourceInfo.resource.mime_type" class="resource-mime">
                    {{ resourceInfo.resource.mime_type }}
                  </div>
                  <div v-if="resourceInfo.resource.description" class="resource-desc">
                    {{ resourceInfo.resource.description }}
                  </div>
                </div>
              </div>
            </el-tab-pane>
          </el-tabs>
        </template>
      </template>
    </main>
  </div>
</template>

<style scoped lang="scss">
  .mcp-panel {
    display: flex;
    min-height: calc(100vh - 40px);
    background: var(--bg-secondary);
    color: var(--text-primary);
  }

  .panel-sidebar {
    width: 240px;
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

  .server-item {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.25rem;
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

  .server-name {
    font-weight: 500;
    color: var(--text-primary);
  }

  .server-meta {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.75rem;
  }

  .server-version {
    color: var(--text-tertiary);
  }

  .server-type {
    padding: 0.125rem 0.375rem;
    background: var(--surface-hover);
    border-radius: 4px;
    font-size: 0.625rem;
    color: var(--text-secondary);
  }

  .status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
  }

  .panel-main {
    flex: 1;
    padding: 1.5rem 2rem;
    overflow-y: auto;
  }

  .server-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1.5rem;
  }

  .server-title {
    font-size: 1.25rem;
    font-weight: 600;
    margin: 0;
  }

  .server-version-badge {
    padding: 0.25rem 0.5rem;
    background: var(--accent-muted);
    color: var(--accent-hover);
    border-radius: 4px;
    font-size: 0.75rem;
  }

  .empty-state {
    text-align: center;
    padding: 3rem 1rem;
    color: var(--text-tertiary);

    p {
      margin: 0;
    }

    .hint {
      margin-top: 0.5rem;
      font-size: 0.875rem;
    }
  }

  .tools-list,
  .prompts-list,
  .resources-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .tool-card,
  .prompt-card,
  .resource-card {
    background: var(--bg-tertiary);
    border: 1px solid var(--border-default);
    border-radius: 8px;
    padding: 1rem;
  }

  .tool-header {
    margin-bottom: 0.75rem;
  }

  .tool-name {
    font-weight: 600;
    color: var(--text-primary);
  }

  .tool-desc {
    display: block;
    margin-top: 0.25rem;
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .tool-params {
    border-top: 1px solid var(--border-subtle);
    padding-top: 0.75rem;
  }

  .param-row {
    display: grid;
    grid-template-columns: 120px 80px 1fr;
    gap: 0.75rem;
    padding: 0.375rem 0;
    font-size: 0.875rem;

    &:not(:last-child) {
      border-bottom: 1px solid var(--border-subtle);
    }
  }

  .param-name {
    font-weight: 500;
    color: var(--text-primary);
  }

  .required {
    color: var(--status-error);
    margin-left: 2px;
  }

  .param-type {
    color: var(--accent);
    font-size: 0.75rem;
  }

  .param-desc {
    color: var(--text-secondary);
  }

  .prompt-name,
  .resource-name {
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 0.25rem;
  }

  .prompt-desc,
  .resource-desc {
    font-size: 0.875rem;
    color: var(--text-secondary);
    margin-bottom: 0.5rem;
  }

  .prompt-args {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .arg-tag {
    padding: 0.125rem 0.5rem;
    background: var(--surface-hover);
    border-radius: 4px;
    font-size: 0.75rem;
    color: var(--text-secondary);
  }

  .resource-uri {
    font-family: monospace;
    font-size: 0.75rem;
    color: var(--text-tertiary);
    margin-bottom: 0.25rem;
  }

  .resource-mime {
    font-size: 0.75rem;
    color: var(--accent);
  }

  .debug-schema {
    margin-top: 0.5rem;
    padding: 0.5rem;
    background: var(--bg-secondary);
    border-radius: 4px;
    font-size: 0.75rem;
    color: var(--text-tertiary);
    overflow-x: auto;
  }

  .error-banner {
    padding: 1rem;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 8px;
    color: var(--status-error);
    margin-bottom: 1rem;
  }

  @media (max-width: 768px) {
    .mcp-panel {
      flex-direction: column;
    }

    .panel-sidebar {
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

    .server-item {
      white-space: nowrap;
      padding: 0.5rem 1rem;
    }

    .panel-main {
      padding: 1.5rem 1rem;
    }

    .param-row {
      grid-template-columns: 1fr;
    }
  }
</style>
