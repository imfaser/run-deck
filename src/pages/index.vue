<script setup lang="ts">
  import { onMounted } from 'vue';
  import { useRouter } from 'vue-router';
  import { getConfig, logMessage } from '@/services/cmd';
  import { useAppStore } from '@/stores/app';

  const router = useRouter();
  const store = useAppStore();

  const fixedRoutes = ['/overview', '/config'];

  const routeTitles: Record<string, string> = {
    '/label': '标注',
    '/mcp-panel': 'MCP 面板',
  };

  onMounted(async () => {
    try {
      const config = await getConfig();
      const target = `/${config.frontend.home}`;
      await logMessage('info', `首页跳转: ${target}`);

      if (!fixedRoutes.includes(target)) {
        store.addTab({
          title: routeTitles[target] ?? config.frontend.home,
          closable: true,
          route: target,
        });
      }

      router.push(target);
    } catch (e) {
      const err = String(e);
      await logMessage('error', `首页配置读取失败: ${err}`);
      router.push('/overview');
    }
  });
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
