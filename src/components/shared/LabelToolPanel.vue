<script setup lang="ts">
  import { computed } from 'vue';
  import { Aim, CircleClose, Crop } from '@element-plus/icons-vue';
  import type { Component } from 'vue';
  import type { AnnotationType } from '@/schemas/annotation';
  import { useCanvasStore } from '@/stores/canvas';

  const props = defineProps<{
    canvasId: string;
  }>();

  const canvas = useCanvasStore(props.canvasId);
  const currentMode = computed(() => canvas.mode);
  const currentTool = computed(() => canvas.tool);

  const tools: { value: AnnotationType; label: string; icon: Component; color: string }[] = [
    { value: 'p_point', label: '正向点', icon: Aim, color: '#22c55e' },
    { value: 'n_point', label: '负向点', icon: CircleClose, color: '#ef4444' },
    { value: 'box', label: '矩形框', icon: Crop, color: '#eab308' },
  ];

  function handleToolChange(tool: AnnotationType) {
    canvas.setTool(tool);
  }
</script>

<template>
  <div v-show="currentMode === 'create'" class="label-tool-panel">
    <div class="panel-title">工具</div>
    <el-segmented
      :model-value="currentTool"
      :options="tools"
      direction="vertical"
      size="small"
      @update:model-value="(val: AnnotationType) => handleToolChange(val)"
    >
      <template #default="{ item }">
        <div class="segmented-option">
          <el-icon :size="16" :color="item.color"><component :is="item.icon" /></el-icon>
          <span class="option-label">{{ item.label }}</span>
        </div>
      </template>
    </el-segmented>
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
    --el-segmented-item-selected-bg-color: var(--surface-active);
    --el-segmented-item-selected-color: var(--text-primary);
  }
</style>
