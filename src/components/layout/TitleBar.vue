<script setup lang="ts">
  import { ref, onMounted } from 'vue';
  import { Window } from '@tauri-apps/api/window';
  import { House, Setting } from '@element-plus/icons-vue';
  import { useRouter, useRoute } from 'vue-router';

  const router = useRouter();
  const route = useRoute();
  const isMaximized = ref(false);
  const appWindow = new Window('main');

  onMounted(async () => {
    isMaximized.value = await appWindow.isMaximized();
    appWindow.onResized(async () => {
      isMaximized.value = await appWindow.isMaximized();
    });
  });

  function goHome() {
    router.push('/overview');
  }

  function goConfig() {
    router.push('/config');
  }

  function isActive(path: string): boolean {
    return route.path === path;
  }
</script>

<template>
  <div class="titlebar" data-tauri-drag-region>
    <div class="titlebar-left">
      <button class="nav-tab" :class="{ active: isActive('/overview') }" @click="goHome">
        <el-icon><House /></el-icon>
        <span>首页</span>
      </button>
      <button class="nav-tab" :class="{ active: isActive('/config') }" @click="goConfig">
        <el-icon><Setting /></el-icon>
        <span>设置</span>
      </button>
    </div>

    <div class="titlebar-right">
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

    &:hover {
      background: var(--surface-hover);
      color: var(--text-primary);
    }

    &.active {
      background: var(--surface-active);
      color: var(--text-primary);
    }
  }

  .titlebar-right {
    display: flex;
    align-items: center;
    height: 100%;
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
