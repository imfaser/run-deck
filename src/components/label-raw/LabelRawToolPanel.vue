<script setup lang="ts">
  import { Aim, CircleClose, Crop } from '@element-plus/icons-vue';
  import type { Component } from 'vue';
  import { useLabelRawStore } from '@/stores/label-raw';
  import type { AnnotationType } from '@/stores/label-raw';

  const store = useLabelRawStore();

  const tools: { key: AnnotationType; label: string; icon: Component; color: string }[] = [
    { key: 'p_point', label: '正向点', icon: Aim, color: '#22c55e' },
    { key: 'n_point', label: '负向点', icon: CircleClose, color: '#ef4444' },
    { key: 'box', label: '矩形框', icon: Crop, color: '#eab308' },
  ];

  function handleToolClick(tool: AnnotationType) {
    store.setTool(tool);
  }
</script>

<template>
  <div v-show="store.mode === 'create'" class="label-tool-panel">
    <div class="panel-title">工具</div>
    <div class="tool-buttons">
      <button
        v-for="t in tools"
        :key="t.key"
        class="tool-btn"
        :class="{ active: store.tool === t.key }"
        :title="t.label"
        @click="handleToolClick(t.key)"
      >
        <el-icon :size="18" :color="t.color"><component :is="t.icon" /></el-icon>
        <span class="tool-label">{{ t.label }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
  .label-tool-panel {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-2);
    padding: var(--spacing-2);
    border-top: 1px solid var(--border-default);
  }

  .panel-title {
    font-size: var(--text-xs);
    color: var(--text-secondary);
    text-align: center;
    margin-bottom: var(--spacing-1);
  }

  .tool-buttons {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-1);
  }

  .tool-btn {
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
      background: var(--surface-active);
      outline: 2px solid var(--accent-primary);
    }
  }

  .tool-label {
    font-size: var(--text-xs);
  }
</style>
