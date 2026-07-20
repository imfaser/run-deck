<script setup lang="ts">
  // ========== 1. 第三方 / 内部模块引入 ==========
  import { ref, computed, watch } from 'vue';
  import { match, P } from 'ts-pattern';
  import {
    mcpListTools,
    mcpListPrompts,
    mcpListResources,
    type McpServerConfig,
    type ServerStatus,
    type ToolInfo,
    type PromptInfo,
    type ResourceInfo,
  } from '@/services/cmd';
  import PageLayout from '@/components/layout/PageLayout.vue';
  import { useConfigQuery } from '@/composables/useConfigQuery';
  import { useMcpServers } from '@/composables/useMcpServers';

  // ========== 2. 组合式函数（Composables）调用 ==========
  const { data: config, isLoading: loading, error } = useConfigQuery();
  const { serverStatuses, serverInfos } = useMcpServers(() => config.value);

  // ========== 3. 响应式状态声明 ==========
  const selectedServer = ref('');
  const activeTab = ref('tools');
  const tools = ref<ToolInfo[]>([]);
  const prompts = ref<PromptInfo[]>([]);
  const resources = ref<ResourceInfo[]>([]);

  // ========== 4. 计算属性 ==========
  const serverList = computed(() => {
    if (!config.value) return [];
    return Object.entries(config.value.mcp).map(([name, cfg]) => ({
      name,
      config: cfg,
      status: serverStatuses.value[name] ?? 'Stopped',
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
    return serverStatuses.value[selectedServer.value] === 'Running';
  });

  // ========== 5. 侦听器 ==========
  watch(
    config,
    (cfg) => {
      if (cfg) {
        const names = Object.keys(cfg.mcp);
        if (names.length > 0) {
          selectedServer.value = names[0];
          loadServerDetails(names[0]);
        }
      }
    },
    { immediate: true }
  );

  // ========== 6. 普通方法与业务逻辑 ==========
  async function loadServerDetails(name: string) {
    selectedServer.value = name;
    activeTab.value = 'tools';

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
      console.error('[mcp-panel] loadServerDetails failed:', e);
    }
  }

  function getStatusType(status: ServerStatus): 'success' | 'warning' | 'info' | 'danger' {
    return match(status)
      .with('Running', () => 'success' as const)
      .with('Starting', () => 'warning' as const)
      .otherwise(() => 'info' as const);
  }

  function getStatusLabel(status: ServerStatus): string {
    return match(status)
      .with(
        P.when((s) => typeof s === 'object' && 'Failed' in s),
        () => '失败'
      )
      .otherwise(() => status as string);
  }

  function getServerTypeLabel(cfg: McpServerConfig): string {
    return cfg.type === 'local' ? 'STDIO' : 'HTTP';
  }

  function getSchemaProperties(
    schema: Record<string, unknown> | undefined | null
  ): Array<{ name: string; type: string; required: boolean; description: string }> {
    if (!schema) return [];
    const properties = schema.properties as Record<string, Record<string, unknown>> | undefined;
    const required = (schema.required as string[] | undefined) ?? [];

    if (!properties) return [];

    return Object.entries(properties).map(([name, prop]) => ({
      name,
      type: (prop?.type as string) ?? 'unknown',
      required: required.includes(name),
      description: (prop?.description as string) ?? '',
    }));
  }
</script>

<template>
  <PageLayout v-loading="loading" aside-width="240px">
    <template #aside>
      <el-menu
        :default-active="selectedServer"
        class="server-menu"
        @select="(name: string) => loadServerDetails(name)"
      >
        <template v-for="server in serverList" :key="server.name">
          <el-menu-item :index="server.name">
            <div class="server-menu-content">
              <div class="server-menu-header">
                <span class="server-menu-name">{{ server.name }}</span>
                <el-tag v-if="server.info" size="small" type="info">
                  {{ server.info.version }}
                </el-tag>
                <el-tag size="small">{{ getServerTypeLabel(server.config) }}</el-tag>
              </div>
              <el-tag :type="getStatusType(server.status)" size="small" effect="dark">
                {{ getStatusLabel(server.status) }}
              </el-tag>
            </div>
          </el-menu-item>
        </template>
      </el-menu>
    </template>

    <el-alert v-if="error" :title="String(error)" type="error" show-icon class="error-alert" />

    <template v-else>
      <el-empty v-if="!selectedServer" description="请选择一个 MCP 服务器查看详情" />

      <template v-else>
        <div class="server-header">
          <h2>{{ selectedServer }}</h2>
          <el-tag v-if="selectedServerInfo" size="small">
            {{ selectedServerInfo.version }}
          </el-tag>
        </div>

        <el-alert
          v-if="!isServerRunning"
          title="服务器未运行"
          description="请在配置页面启动此服务器"
          type="warning"
          show-icon
        />

        <el-tabs v-else v-model="activeTab">
          <el-tab-pane label="工具" name="tools">
            <el-empty v-if="selectedServerTools.length === 0" description="暂无工具" />
            <div v-else class="tools-list">
              <el-card v-for="toolInfo in selectedServerTools" :key="toolInfo.tool.name">
                <template #header>
                  <div class="tool-card-header">
                    <span class="tool-name">{{ toolInfo.tool.name }}</span>
                  </div>
                </template>
                <p v-if="toolInfo.tool.description" class="tool-desc">
                  {{ toolInfo.tool.description }}
                </p>
                <el-table
                  v-if="getSchemaProperties(toolInfo.tool.inputSchema).length > 0"
                  :data="getSchemaProperties(toolInfo.tool.inputSchema)"
                  stripe
                  size="small"
                  border
                >
                  <el-table-column prop="name" label="参数" width="140">
                    <template #default="{ row }">
                      <span class="param-name">
                        {{ row.name }}
                        <el-tag v-if="row.required" size="small" type="danger">必填</el-tag>
                      </span>
                    </template>
                  </el-table-column>
                  <el-table-column prop="type" label="类型" width="100">
                    <template #default="{ row }">
                      <el-tag size="small" effect="plain">{{ row.type }}</el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column prop="description" label="描述" />
                </el-table>
                <el-text v-else type="info" size="small">无参数</el-text>
              </el-card>
            </div>
          </el-tab-pane>

          <el-tab-pane :label="`提示 (${selectedServerPrompts.length})`" name="prompts">
            <el-empty v-if="selectedServerPrompts.length === 0" description="暂无提示" />
            <div v-else class="prompts-list">
              <el-card v-for="promptInfo in selectedServerPrompts" :key="promptInfo.prompt.name">
                <template #header>
                  <div class="prompt-card-header">
                    <span class="prompt-name">{{ promptInfo.prompt.name }}</span>
                  </div>
                </template>
                <p v-if="promptInfo.prompt.description" class="prompt-desc">
                  {{ promptInfo.prompt.description }}
                </p>
                <div
                  v-if="promptInfo.prompt.arguments && promptInfo.prompt.arguments.length > 0"
                  class="prompt-args"
                >
                  <el-tag v-for="arg in promptInfo.prompt.arguments" :key="arg.name" size="small">
                    {{ arg.name }}
                    <span v-if="arg.required">*</span>
                  </el-tag>
                </div>
              </el-card>
            </div>
          </el-tab-pane>

          <el-tab-pane :label="`资源 (${selectedServerResources.length})`" name="resources">
            <el-empty v-if="selectedServerResources.length === 0" description="暂无资源" />
            <div v-else class="resources-list">
              <el-card
                v-for="resourceInfo in selectedServerResources"
                :key="resourceInfo.resource.uri"
              >
                <template #header>
                  <div class="resource-card-header">
                    <span class="resource-name">{{ resourceInfo.resource.name }}</span>
                    <el-tag v-if="resourceInfo.resource.mime_type" size="small" type="info">
                      {{ resourceInfo.resource.mime_type }}
                    </el-tag>
                  </div>
                </template>
                <el-text type="info" size="small" class="resource-uri">
                  {{ resourceInfo.resource.uri }}
                </el-text>
                <p v-if="resourceInfo.resource.description" class="resource-desc">
                  {{ resourceInfo.resource.description }}
                </p>
              </el-card>
            </div>
          </el-tab-pane>
        </el-tabs>
      </template>
    </template>
  </PageLayout>
</template>

<style scoped lang="scss">
  .error-alert {
    margin-bottom: var(--spacing-rem-base);
  }

  :deep(.el-menu-item) {
    border-bottom: 1px solid var(--border-subtle);
    height: auto;
    padding: var(--spacing-3) var(--spacing-4);

    &.is-active {
      background: var(--accent-muted);
    }
  }

  .server-menu-content {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-rem-xs);
    width: 100%;
  }

  .server-menu-header {
    display: flex;
    align-items: center;
    gap: var(--spacing-rem-sm);
  }

  .server-menu-name {
    font-weight: var(--font-medium);
  }

  .server-header {
    display: flex;
    align-items: center;
    gap: var(--spacing-rem-md);
    margin-bottom: var(--spacing-rem-lg);

    h2 {
      margin: 0;
      font-size: var(--text-xl);
      font-weight: var(--font-bold);
      color: var(--text-primary);
    }
  }

  .tools-list,
  .prompts-list,
  .resources-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-rem-base);
  }

  .tool-card-header,
  .prompt-card-header,
  .resource-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: 0;
  }

  .tool-name,
  .prompt-name,
  .resource-name {
    font-weight: var(--font-bold);
  }

  .tool-desc,
  .prompt-desc,
  .resource-desc {
    font-size: var(--text-base);
    color: var(--text-secondary);
    margin: 0 0 var(--spacing-rem-base);
  }

  .resource-uri {
    font-family: monospace;
  }

  .param-name {
    display: flex;
    align-items: center;
    gap: var(--spacing-rem-xs);
    font-weight: var(--font-medium);
  }

  .prompt-args {
    display: flex;
    gap: var(--spacing-rem-sm);
    flex-wrap: wrap;
  }

  :deep(.el-table) {
    --el-table-border-color: var(--border-default);
  }

  :deep(.el-card) {
    overflow: visible;
  }
</style>
