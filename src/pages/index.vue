<script setup lang="ts">
  import { onMounted } from 'vue';
  import { useRouter } from 'vue-router';
  import { getConfig, logMessage } from '@/services/cmd';

  const router = useRouter();

  onMounted(async () => {
    try {
      const config = await getConfig();
      const target = `/${config.frontend.home}`;
      await logMessage('info', `首页跳转: ${target}`);
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
