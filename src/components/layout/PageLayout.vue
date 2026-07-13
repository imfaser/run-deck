<script setup lang="ts">
  defineProps<{
    asideWidth?: string;
  }>();
</script>

<template>
  <el-container class="page-layout" direction="horizontal">
    <el-aside :width="asideWidth ?? 'var(--sidebar-width)'" class="page-aside">
      <slot name="aside" />
    </el-aside>
    <el-main class="page-main">
      <slot />
    </el-main>
  </el-container>
</template>

<style scoped lang="scss">
  .page-layout {
    height: calc(100vh - var(--titlebar-height));
    background: var(--bg-secondary);
    color: var(--text-primary);
  }

  .page-aside {
    background: var(--bg-tertiary);
    border-right: 1px solid var(--border-default);
    flex-shrink: 0;
    overflow-y: auto;
    padding: var(--spacing-rem-lg) 0;
  }

  .page-main {
    padding: var(--spacing-rem-xl);
    overflow-y: auto;
  }
</style>
