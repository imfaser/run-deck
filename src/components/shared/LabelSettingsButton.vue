<script setup lang="ts">
  import { Setting } from '@element-plus/icons-vue';
  import { invoke } from '@tauri-apps/api/core';

  async function openSettings() {
    await invoke('open_label_settings_window');
  }
</script>

<template>
  <div class="label-settings-panel">
    <div class="panel-title">标注设置</div>
    <div class="settings-btn-wrapper">
      <el-button size="small" @click="openSettings">
        <el-icon><Setting /></el-icon>
      </el-button>
    </div>
  </div>
</template>

<style scoped lang="scss">
  .label-settings-panel {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-2);
    padding: var(--spacing-2);
    border-top: 1px solid var(--border-default);
    margin-top: auto;
  }

  .panel-title {
    font-size: var(--text-xs);
    color: var(--text-secondary);
    text-align: center;
    margin-bottom: var(--spacing-1);
  }

  .settings-btn-wrapper {
    display: flex;
    justify-content: center;
  }
</style>
