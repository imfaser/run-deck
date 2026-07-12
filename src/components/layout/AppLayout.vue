<script setup lang="ts">
  import TitleBar from './TitleBar.vue';
</script>

<template>
  <div class="app-layout">
    <TitleBar />
    <main class="app-content">
      <RouterView />
    </main>
  </div>
</template>

<style scoped lang="scss">
  .app-layout {
    min-height: 100vh;
    background: var(--bg-secondary);
    color: var(--text-primary);
  }

  .app-content {
    padding-top: 40px;
    min-height: 100vh;
  }
</style>
