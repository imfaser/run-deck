<script setup lang="ts">
  import { ref, onMounted } from 'vue';
  import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
  import AppLayout from './components/layout/AppLayout.vue';
  import { useTheme } from '@/composables/useTheme';

  useTheme();

  const windowLabel = ref('main');

  onMounted(() => {
    try {
      windowLabel.value = getCurrentWebviewWindow()?.label ?? 'main';
    } catch {
      // not in Tauri
    }
  });
</script>

<template>
  <AppLayout v-if="windowLabel === 'main'" />
  <div v-else class="secondary-layout">
    <RouterView />
  </div>
</template>

<style scoped lang="scss">
  .secondary-layout {
    height: 100vh;
    background: var(--bg-secondary);
    color: var(--text-primary);
    overflow-y: auto;
  }
</style>
