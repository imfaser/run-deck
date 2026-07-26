<script setup lang="ts">
  import { computed } from 'vue';
  import { useRoute } from 'vue-router';
  import { Pointer, Edit, Delete } from '@element-plus/icons-vue';
  import type { Component } from 'vue';
  import type { LabelMode } from '@/schemas/annotation';
  import { useLabel2dCanvasStore } from '@/stores/canvas-2d';
  import { useLabel3dCanvasStore } from '@/stores/canvas-3d';

  const route = useRoute();
  const canvas = route.path === '/label-raw' ? useLabel3dCanvasStore() : useLabel2dCanvasStore();
  const currentMode = computed(() => canvas.mode);

  const modes: { value: LabelMode; label: string; icon: Component }[] = [
    { value: 'select', label: '选择', icon: Pointer },
    { value: 'create', label: '创建', icon: Edit },
    { value: 'delete', label: '删除', icon: Delete },
  ];

  function handleModeChange(mode: LabelMode) {
    canvas.setMode(mode);
  }
</script>

<template>
  <div class="label-mode-panel">
    <div class="panel-title">模式</div>
    <el-segmented
      :model-value="currentMode"
      :options="modes"
      direction="vertical"
      size="small"
      @update:model-value="(val: LabelMode) => handleModeChange(val)"
    >
      <template #default="{ item }">
        <div class="segmented-option">
          <el-icon :size="16"><component :is="item.icon" /></el-icon>
          <span class="option-label">{{ item.label }}</span>
        </div>
      </template>
    </el-segmented>
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

  .segmented-option {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 2px 0;
  }

  .option-label {
    font-size: var(--text-xs);
  }

  :deep(.el-segmented) {
    --el-segmented-item-selected-bg-color: var(--accent-primary);
    --el-segmented-item-selected-color: var(--text-inverse);
  }
</style>
