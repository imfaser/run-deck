<script setup lang="ts">
  import { computed } from 'vue';
  import { useConfigQuery } from '@/composables/useConfigQuery';
  import { useMcpServers } from '@/composables/useMcpServers';
  import { getStatusType, getStatusLabel, getServerTypeLabel } from '@/composables/useMcpHelpers';

  const props = defineProps<{
    selectedServer: string;
  }>();

  const emit = defineEmits<{
    select: [name: string];
  }>();

  const { data: config } = useConfigQuery();
  const { serverStatuses, serverInfos } = useMcpServers(() => config.value);

  const serverList = computed(() => {
    if (!config.value) return [];
    return Object.entries(config.value.mcp).map(([name, cfg]) => ({
      name,
      config: cfg,
      status: serverStatuses.value[name] ?? 'Stopped',
      info: serverInfos.value[name] ?? null,
    }));
  });
</script>

<template>
  <el-menu
    :default-active="props.selectedServer"
    class="server-menu"
    @select="(name: string) => emit('select', name)"
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

<style scoped lang="scss">
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
</style>
