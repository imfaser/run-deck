<script setup lang="ts">
  import { watch } from 'vue';
  import { useRouter } from 'vue-router';
  import { logMessage } from '@/services/cmd';
  import { useConfigQuery } from '@/composables/useConfigQuery';
  import { useAppStore } from '@/stores/app';

  const router = useRouter();
  const store = useAppStore();
  const { data: config, isSuccess } = useConfigQuery();

  const fixedRoutes = ['/overview', '/config'];

  const routeTitles: Record<string, string> = {
    '/label': '标注',
    '/mcp-panel': 'MCP 面板',
  };

  watch(
    isSuccess,
    async (ready) => {
      if (!ready || !config.value) return;
      const target = `/${config.value.frontend.home}`;
      await logMessage('info', `首页跳转: ${target}`);

      if (!fixedRoutes.includes(target)) {
        store.addTab({
          title: routeTitles[target] ?? config.value.frontend.home,
          closable: true,
          route: target,
        });
      }

      router.push(target);
    },
    { once: true }
  );
</script>

<template>
  <div class="loading">
    <p>加载中...</p>
  </div>
</template>

<style scoped lang="scss">
  @use '@/styles/abstracts/mixins' as *;

  .loading {
    @include flex-center;
    height: 100vh;
    font-family: sans-serif;
    color: var(--text-tertiary);
  }
</style>
