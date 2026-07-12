<script setup lang="ts">
  import { computed } from 'vue';
  import type { McpServerConfig, ServerStatus } from '@/services/cmd';

  const props = defineProps<{
    servers: Record<string, McpServerConfig>;
    statuses: Record<string, ServerStatus>;
  }>();

  const emit = defineEmits<{
    add: [];
    edit: [name: string];
    remove: [name: string];
    toggle: [name: string];
  }>();

  const serverList = computed(() =>
    Object.entries(props.servers).map(([name, cfg]) => ({
      name,
      config: cfg,
      status: props.statuses[name] ?? ('Stopped' as ServerStatus),
    }))
  );

  function getStatusColor(status: ServerStatus): string {
    if (status === 'Running') return '#22c55e';
    if (status === 'Starting') return '#f59e0b';
    return '#6b7280';
  }

  function getStatusLabel(status: ServerStatus): string {
    if (typeof status === 'object' && 'Failed' in status) return '失败';
    return status;
  }
</script>

<template>
  <div class="mcp-server-list">
    <div class="section-header">
      <h2 class="section-title">MCP 服务器</h2>
      <el-button type="primary" @click="emit('add')">+ 添加</el-button>
    </div>

    <div v-if="serverList.length === 0" class="empty-state">
      <p>暂无 MCP 服务器</p>
      <p class="hint">点击「添加」按钮创建新的 MCP 服务器</p>
    </div>

    <div v-else class="server-list">
      <div v-for="server in serverList" :key="server.name" class="server-card">
        <div class="server-main" @click="emit('edit', server.name)">
          <div class="server-info">
            <div class="server-name">{{ server.name }}</div>
            <div class="server-meta">
              <el-tag size="small" :type="server.config.type === 'local' ? undefined : 'info'">
                {{ server.config.type === 'local' ? 'STDIO' : 'HTTP' }}
              </el-tag>
              <span
                class="status-dot"
                :style="{ backgroundColor: getStatusColor(server.status) }"
              />
              <span class="status-text">{{ getStatusLabel(server.status) }}</span>
            </div>
          </div>
        </div>
        <div class="server-actions">
          <el-switch
            :model-value="server.config.enabled"
            @update:model-value="emit('toggle', server.name)"
            @click.stop
          />
          <button class="action-btn delete" @click.stop="emit('remove', server.name)">🗑</button>
          <button class="action-btn settings" @click.stop="emit('edit', server.name)">⚙</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1.5rem;
  }

  .section-title {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
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

  .server-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .server-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-default);
    border-radius: 12px;
    padding: 1rem 1.25rem;
    transition: border-color 0.2s;

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
    font-size: 0.9375rem;
    font-weight: 500;
    color: var(--text-primary);
    margin-bottom: 0.375rem;
  }

  .server-meta {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .status-text {
    font-size: 0.75rem;
    color: var(--text-tertiary);
  }

  .server-actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-left: 1rem;
  }

  .action-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1rem;
    padding: 0.25rem;
    opacity: 0.6;
    transition: opacity 0.2s;

    &:hover {
      opacity: 1;
    }

    &.delete:hover {
      color: #ef4444;
    }
  }
</style>
