<script setup lang="ts">
  import { Pointer, Edit, Delete } from '@element-plus/icons-vue';
  import type { Component } from 'vue';
  import { useLabelStore } from '@/stores/label';
  import type { LabelMode } from '@/stores/label';

  const store = useLabelStore();

  const modes: { key: LabelMode; label: string; icon: Component }[] = [
    { key: 'select', label: '选择', icon: Pointer },
    { key: 'create', label: '创建', icon: Edit },
    { key: 'delete', label: '删除', icon: Delete },
  ];

  function handleModeClick(mode: LabelMode) {
    store.setMode(mode);
  }
</script>

<template>
  <div class="label-mode-panel">
    <div class="panel-title">模式</div>
    <div class="mode-buttons">
      <button
        v-for="m in modes"
        :key="m.key"
        class="mode-btn"
        :class="{ active: store.mode === m.key }"
        :title="m.label"
        @click="handleModeClick(m.key)"
      >
        <el-icon :size="18"><component :is="m.icon" /></el-icon>
        <span class="mode-label">{{ m.label }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
  .label-mode-panel {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-2);
    padding: var(--spacing-2);
  }

  .panel-title {
    font-size: var(--text-xs);
    color: var(--text-secondary);
    text-align: center;
    margin-bottom: var(--spacing-1);
  }

  .mode-buttons {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-1);
  }

  .mode-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: var(--spacing-2) var(--spacing-1);
    border: none;
    border-radius: var(--radius-md);
    background: transparent;
    cursor: pointer;
    transition: background var(--transition-fast);
    color: var(--text-regular);

    &:hover {
      background: var(--surface-hover);
    }

    &.active {
      background: var(--accent-primary);
      color: var(--text-inverse);
    }
  }

  .mode-label {
    font-size: var(--text-xs);
  }
</style>
