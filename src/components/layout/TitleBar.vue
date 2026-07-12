<script setup lang="ts">
  import { ref, onMounted, computed } from 'vue';
  import { Window } from '@tauri-apps/api/window';
  import { House, Setting, Close, Sunny, Moon } from '@element-plus/icons-vue';
  import { useRouter, useRoute } from 'vue-router';
  import { useAppStore } from '@/stores/app';
  import { useTheme } from '@/composables/useTheme';

  const router = useRouter();
  const route = useRoute();
  const store = useAppStore();
  const { theme, toggleTheme } = useTheme();
  const isMaximized = ref(false);
  const appWindow = new Window('main');

  const fixedTabs = [
    { id: 'overview', title: '导航', icon: House, route: '/overview', closable: false },
    { id: 'config', title: '配置', icon: Setting, route: '/config', closable: false },
  ];

  const allTabs = computed(() => [...fixedTabs, ...store.tabs.map((t) => ({ ...t, icon: null }))]);

  onMounted(async () => {
    isMaximized.value = await appWindow.isMaximized();
    appWindow.onResized(async () => {
      isMaximized.value = await appWindow.isMaximized();
    });
  });

  function handleTabClick(tabId: string, tabRoute: string) {
    store.setActiveTab(tabId);
    router.push(tabRoute);
  }

  function handleCloseTab(tabId: string) {
    const tab = store.tabs.find((t) => t.id === tabId);
    if (!tab) return;

    store.removeTab(tabId);

    const targetId = store.activeTab;
    const targetTab = allTabs.value.find((t) => t.id === targetId);
    if (targetTab) {
      router.push(targetTab.route);
    } else {
      router.push('/overview');
    }
  }

  function isActive(id: string): boolean {
    return (
      store.activeTab === id || route.path === (allTabs.value.find((t) => t.id === id)?.route ?? '')
    );
  }
</script>

<template>
  <div class="titlebar" data-tauri-drag-region>
    <div class="titlebar-left">
      <button
        v-for="tab in fixedTabs"
        :key="tab.id"
        class="nav-tab"
        :class="{ active: isActive(tab.id) }"
        @click="handleTabClick(tab.id, tab.route)"
      >
        <el-icon><component :is="tab.icon" /></el-icon>
        <span>{{ tab.title }}</span>
      </button>
      <template v-if="store.tabs.length > 0">
        <div class="tab-divider" />
        <button
          v-for="tab in store.tabs"
          :key="tab.id"
          class="nav-tab dynamic"
          :class="{ active: isActive(tab.id) }"
          @click="handleTabClick(tab.id, tab.route)"
        >
          <span>{{ tab.title }}</span>
          <span class="tab-close" @click.stop="handleCloseTab(tab.id)">
            <el-icon :size="12"><Close /></el-icon>
          </span>
        </button>
      </template>
    </div>

    <div class="titlebar-right">
      <button class="titlebar-button" @click="toggleTheme">
        <el-icon :size="14">
          <Moon v-if="theme === 'dark'" />
          <Sunny v-else />
        </el-icon>
      </button>
      <div class="window-divider" />
      <button class="titlebar-button" @click="appWindow.minimize()">
        <svg width="12" height="12" viewBox="0 0 12 12">
          <rect x="2" y="5.5" width="8" height="1" fill="currentColor" />
        </svg>
      </button>
      <button class="titlebar-button" @click="appWindow.toggleMaximize()">
        <svg v-if="!isMaximized" width="12" height="12" viewBox="0 0 12 12">
          <rect
            x="2"
            y="2"
            width="8"
            height="8"
            rx="1"
            fill="none"
            stroke="currentColor"
            stroke-width="1"
          />
        </svg>
        <svg v-else width="12" height="12" viewBox="0 0 12 12">
          <rect
            x="3.5"
            y="1"
            width="7"
            height="7"
            rx="1"
            fill="none"
            stroke="currentColor"
            stroke-width="1"
          />
          <rect
            x="1.5"
            y="4"
            width="7"
            height="7"
            rx="1"
            fill="none"
            stroke="currentColor"
            stroke-width="1"
          />
        </svg>
      </button>
      <button class="titlebar-button close" @click="appWindow.close()">
        <svg width="12" height="12" viewBox="0 0 12 12">
          <path
            d="M3 3l6 6M9 3l-6 6"
            stroke="currentColor"
            stroke-width="1.2"
            stroke-linecap="round"
          />
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
  .titlebar {
    height: 40px;
    background: var(--bg-primary);
    display: flex;
    align-items: center;
    justify-content: space-between;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 999;
    user-select: none;
    -webkit-user-select: none;
    border-bottom: 1px solid var(--border-subtle);
  }

  .titlebar-left {
    display: flex;
    align-items: center;
    height: 100%;
    padding-left: 12px;
    gap: 4px;
    overflow-x: auto;
    max-width: calc(100vw - 150px);

    &::-webkit-scrollbar {
      display: none;
    }
  }

  .tab-divider {
    width: 1px;
    height: 20px;
    background: var(--border-default);
    margin: 0 4px;
    flex-shrink: 0;
  }

  .nav-tab {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    border: none;
    background: none;
    color: var(--text-secondary);
    font-size: 13px;
    cursor: pointer;
    border-radius: 6px;
    transition: all 0.2s;
    white-space: nowrap;
    flex-shrink: 0;

    &:hover {
      background: var(--surface-hover);
      color: var(--text-primary);
    }

    &.active {
      background: var(--surface-active);
      color: var(--text-primary);
    }

    &.dynamic {
      padding-right: 8px;
    }
  }

  .tab-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    border-radius: 4px;
    margin-left: 4px;
    transition: all 0.15s;

    &:hover {
      background: var(--surface-hover);
    }
  }

  .titlebar-right {
    display: flex;
    align-items: center;
    height: 100%;
    flex-shrink: 0;
  }

  .window-divider {
    width: 1px;
    height: 20px;
    background: var(--border-default);
    margin: 0 4px;
  }

  .titlebar-button {
    display: inline-flex;
    justify-content: center;
    align-items: center;
    width: 36px;
    height: 100%;
    border: none;
    background: none;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.15s;

    &:hover {
      background: var(--surface-hover);
      color: var(--text-primary);
    }

    &.close:hover {
      background: var(--status-error);
      color: #fff;
    }
  }
</style>
