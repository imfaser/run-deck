<script setup lang="ts">
  import { onMounted } from 'vue';
  import { useRouteQuery } from '@vueuse/router';
  import GeneralSettings from '@/components/config/GeneralSettings.vue';
  import McpServerList from '@/components/config/McpServerList.vue';
  import McpServerForm from '@/components/config/McpServerForm.vue';
  import PageLayout from '@/components/layout/PageLayout.vue';
  import { useConfigStore } from '@/stores/config';

  const store = useConfigStore();
  const activeSection = useRouteQuery<string>('section', 'general');

  const sections = [
    { key: 'general', label: '通用', icon: '⚙' },
    { key: 'mcp', label: 'MCP 服务器', icon: '🔌' },
  ];

  onMounted(() => {
    store.refreshServerStatuses();
  });
</script>

<template>
  <PageLayout v-loading="store.loading">
    <template #aside>
      <div class="sidebar-title">设置</div>
      <el-menu
        :default-active="activeSection"
        class="sidebar-nav"
        @select="(key: string) => (activeSection = key)"
      >
        <el-menu-item v-for="section in sections" :key="section.key" :index="section.key">
          {{ section.label }}
        </el-menu-item>
      </el-menu>
    </template>

    <el-alert
      v-if="store.isError"
      :title="String(store.error)"
      type="error"
      show-icon
      class="error-alert"
    />

    <template v-else-if="store.config">
      <GeneralSettings v-if="activeSection === 'general'" />

      <template v-if="activeSection === 'mcp'">
        <McpServerForm v-if="store.editingServer" />
        <McpServerList v-else />
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
