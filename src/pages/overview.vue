<script setup lang="ts">
  // ========== 1. 第三方 / 内部模块引入 ==========
  import { useRouter } from 'vue-router';
  import { useConfigQuery } from '@/composables/useConfigQuery';
  import { useAppStore } from '@/stores/app';

  // ========== 2. 组合式函数（Composables）调用 ==========
  const router = useRouter();
  const store = useAppStore();
  const { isLoading: loading } = useConfigQuery();

  // ========== 3. 常量 ==========
  interface AppItem {
    id: string;
    name: string;
    icon: string;
    color: string;
    route: string;
  }

  const apps: AppItem[] = [
    { id: 'config', name: '配置', icon: '⚙', color: '#6366f1', route: '/config' },
    { id: 'mcp-panel', name: 'MCP 面板', icon: '🔌', color: '#10b981', route: '/mcp-panel' },
    { id: 'label', name: '标注', icon: '✏️', color: '#f59e0b', route: '/label' },
    { id: 'label-raw', name: '3D标注', icon: '🧊', color: '#3b82f6', route: '/label-raw' },
    {
      id: 'worktime-dashboard',
      name: '工时仪表盘',
      icon: '📊',
      color: '#8b5cf6',
      route: '/worktime-dashboard',
    },
  ];

  // ========== 4. 普通方法与业务逻辑 ==========
  function handleAppClick(app: AppItem) {
    if (app.id === 'config') {
      store.setActiveTab('config');
      router.push(app.route);
    } else {
      store.addTab({ title: app.name, closable: true, route: app.route });
      router.push(app.route);
    }
  }
</script>

<template>
  <div v-loading="loading" class="overview-page">
    <main class="overview-main">
      <h2 class="section-title">应用</h2>
      <div class="app-grid">
        <div v-for="app in apps" :key="app.id" class="app-item" @click="handleAppClick(app)">
          <div class="app-icon" :style="{ backgroundColor: app.color }">
            <span class="icon-text">{{ app.icon }}</span>
          </div>
          <span class="app-name">{{ app.name }}</span>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped lang="scss">
  @use '@/styles/abstracts/mixins' as *;

  .overview-page {
    @include page-layout;
  }

  .overview-main {
    max-width: 1200px;
    margin: 0 auto;
    padding: var(--spacing-rem-xl);
  }

  .section-title {
    font-size: var(--text-lg);
    font-weight: var(--font-medium);
    margin-bottom: var(--spacing-rem-lg);
    color: var(--text-primary);
  }

  .app-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
    gap: var(--spacing-rem-lg);
    justify-items: start;
  }

  .app-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-rem-sm);
    cursor: pointer;
    transition: transform var(--transition-base);

    &:hover {
      transform: scale(1.05);
    }
  }

  .app-icon {
    width: 56px;
    height: 56px;
    border-radius: var(--radius-xl);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: box-shadow var(--transition-base);

    &:hover {
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    }
  }

  .icon-text {
    font-size: var(--text-2xl);
    color: var(--text-inverse);
    font-weight: var(--font-medium);
  }

  .app-name {
    font-size: var(--text-xs);
    color: var(--text-secondary);
    text-align: center;
    white-space: nowrap;
  }

  @include respond-to('md') {
    .overview-main {
      padding: var(--spacing-rem-base);
    }

    .app-grid {
      grid-template-columns: repeat(4, 1fr);
      gap: var(--spacing-rem-base);
    }

    .app-icon {
      width: 48px;
      height: 48px;
      border-radius: var(--radius-lg);
    }

    .icon-text {
      font-size: var(--text-xl);
    }
  }
</style>
