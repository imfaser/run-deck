<script setup lang="ts">
  // ========== 1. 第三方 / 内部模块引入 ==========
  import { ref, computed } from 'vue';
  import { Delete, Setting } from '@element-plus/icons-vue';
  import { match } from 'ts-pattern';
  import type { McpServerConfig, ServerStatus } from '@/services/cmd';

  // ========== 2. Props / Emits 定义 ==========
  const props = defineProps<{
    servers: Record<string, McpServerConfig>;
    statuses: Record<string, ServerStatus>;
  }>();

  const emit = defineEmits<{
    add: [type: 'local' | 'remote'];
    edit: [name: string];
    remove: [name: string];
    toggle: [name: string];
  }>();

  // ========== 3. 响应式状态声明 ==========
  const showTypeDialog = ref(false);
  const selectedType = ref<'local' | 'remote'>('local');
  const typeOptions = [
    { label: 'stdio (本地)', value: 'local' },
    { label: 'http (远程)', value: 'remote' },
  ];

  // ========== 4. 计算属性 ==========
  const serverList = computed(() =>
    Object.entries(props.servers).map(([name, cfg]) => ({
      name,
      config: cfg,
      status: props.statuses[name] ?? ('Stopped' as ServerStatus),
    }))
  );

  // ========== 5. 普通方法与业务逻辑 ==========
  function getStatusType(status: ServerStatus): 'success' | 'warning' | 'info' | 'danger' {
    return match(status)
      .with('Running', () => 'success' as const)
      .with('Starting', () => 'warning' as const)
      .otherwise(() => 'info' as const);
  }

  function getStatusLabel(status: ServerStatus): string {
    return match(status)
      .with('Running', () => '运行中')
      .with('Starting', () => '启动中')
      .with('Stopped', () => '已停止')
      .otherwise(() => '失败');
  }

  function openAddDialog() {
    selectedType.value = 'local';
    showTypeDialog.value = true;
  }

  function confirmAdd() {
    showTypeDialog.value = false;
    emit('add', selectedType.value);
  }
</script>

<template>
  <div class="mcp-server-list">
    <div class="section-header">
      <h2 class="section-title">MCP 服务器</h2>
      <el-button type="primary" @click="openAddDialog">+ 添加</el-button>
    </div>

    <el-empty v-if="serverList.length === 0" description="暂无 MCP 服务器">
      <el-button type="primary" @click="openAddDialog">+ 添加</el-button>
    </el-empty>

    <div v-else class="server-list">
      <div v-for="server in serverList" :key="server.name" class="server-card">
        <div class="server-main" @click="emit('edit', server.name)">
          <div class="server-info">
            <div class="server-name">{{ server.name }}</div>
            <div class="server-meta">
              <el-tag size="small" :type="server.config.type === 'local' ? undefined : 'info'">
                {{ server.config.type === 'local' ? 'STDIO' : 'HTTP' }}
              </el-tag>
              <el-tag :type="getStatusType(server.status)" size="small" effect="dark">
                {{ getStatusLabel(server.status) }}
              </el-tag>
            </div>
          </div>
        </div>
        <div class="server-actions">
          <el-switch
            :model-value="server.config.enabled"
            @update:model-value="() => emit('toggle', server.name)"
            @click.stop
          />
          <el-button :icon="Delete" circle @click.stop="emit('remove', server.name)" />
          <el-button :icon="Setting" circle @click.stop="emit('edit', server.name)" />
        </div>
      </div>
    </div>

    <el-dialog v-model="showTypeDialog" title="选择服务器类型" width="400px">
      <el-segmented v-model="selectedType" :options="typeOptions" block />
      <template #footer>
        <el-button @click="showTypeDialog = false">取消</el-button>
        <el-button type="primary" @click="confirmAdd">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
  @use '@/styles/abstracts/mixins' as *;

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--spacing-rem-lg);
  }

  .section-title {
    @include section-title;
    margin: 0;
  }

  .server-list {
    @include flex-column;
    gap: var(--spacing-rem-md);
  }

  .server-card {
    @include flex-between;
    @include card;
    padding: var(--spacing-rem-base) var(--spacing-rem-lg);
    transition: border-color var(--transition-base);

    &:hover {
      border-color: var(--border-strong);
    }
  }

  .server-main {
    flex: 1;
    cursor: pointer;
    min-width: 0;
  }

  .server-name {
    font-size: var(--text-md);
    font-weight: var(--font-medium);
    color: var(--text-primary);
    margin-bottom: var(--spacing-rem-xs);
  }

  .server-meta {
    display: flex;
    align-items: center;
    gap: var(--spacing-rem-sm);
  }

  .server-actions {
    display: flex;
    align-items: center;
    gap: var(--spacing-rem-md);
    margin-left: var(--spacing-rem-base);
  }
</style>
