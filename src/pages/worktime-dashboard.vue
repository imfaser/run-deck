<script setup lang="ts">
  import { ref } from 'vue';
  import PageLayout from '@/components/layout/PageLayout.vue';
  import DashboardOverview from '@/components/worktime-dashboard/DashboardOverview.vue';
  import WorktimeCalendar from '@/components/worktime-dashboard/WorktimeCalendar.vue';
  import WorktimeSettings from '@/components/worktime-dashboard/WorktimeSettings.vue';

  const activeView = ref('overview');

  const sections = [
    { key: 'overview', label: '📊 总览' },
    { key: 'calendar', label: '📅 工时日历' },
    { key: 'settings', label: '⚙️ 工时设置' },
  ];
</script>

<template>
  <PageLayout>
    <template #aside>
      <div class="sidebar-title">工时仪表盘</div>
      <el-menu :default-active="activeView" class="sidebar-nav" @select="(key: string) => (activeView = key)">
        <el-menu-item v-for="section in sections" :key="section.key" :index="section.key">
          {{ section.label }}
        </el-menu-item>
      </el-menu>
    </template>

    <DashboardOverview v-if="activeView === 'overview'" />
    <WorktimeCalendar v-else-if="activeView === 'calendar'" />
    <WorktimeSettings v-else-if="activeView === 'settings'" />
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
</style>
