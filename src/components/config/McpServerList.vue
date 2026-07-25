<script setup lang="ts">
  import { ref, computed } from 'vue';
  import { Delete, Setting } from '@element-plus/icons-vue';
  import type { ServerStatus } from '@/services/cmd';
  import { useConfigStore } from '@/stores/config';
  import { getStatusType, getStatusLabel } from '@/composables/useMcpHelpers';

  const store = useConfigStore();

  const showTypeDialog = ref(false);
  const selectedType = ref<'local' | 'remote'>('local');
  const typeOptions = [
    { label: 'stdio (本地)', value: 'local' },
    { label: 'http (远程)', value: 'remote' },
  ];

  const serverList = computed(() => {
    if (!store.config) return [];
    return Object.entries(store.config.mcp).map(([name, cfg]) => ({
      name,
      config: cfg,
      status: store.serverStatuses[name] ?? ('Stopped' as ServerStatus),
    }));
  });

  function openAddDialog() {
    selectedType.value = 'local';
    showTypeDialog.value = true;
  }

  function confirmAdd() {
    showTypeDialog.value = false;
    store.addServer(selectedType.value);
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
        <div class="server-main" @click="store.editServer(server.name)">
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
        <div class="server-actions" @click.stop>
          <el-switch
            :model-value="server.config.enabled"
            @update:model-value="() => store.toggleServer(server.name)"
          />
          <el-button :icon="Delete" circle @click="store.removeServer(server.name)" />
          <el-button :icon="Setting" circle @click="store.editServer(server.name)" />
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
