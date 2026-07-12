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
    height: 100vh;
    background: var(--bg-secondary);
    color: var(--text-primary);
    overflow: hidden;
  }

  .app-content {
    padding-top: 40px;
    height: 100vh;
    overflow-y: auto;
  }
</style>
