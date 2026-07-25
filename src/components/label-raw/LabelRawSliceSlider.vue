<script setup lang="ts">
  import { computed } from 'vue';
  import { useDebounceFn } from '@vueuse/core';
  import { useCanvasStore } from '@/stores/canvas';
  import { useLabel3dStore } from '@/stores/label-3d';
  import { useMaskStore } from '@/stores/mask';
  import { useRecognizeStore } from '@/stores/recognize';

  const props = defineProps<{ canvasId: string }>();

  const canvas = useCanvasStore(props.canvasId);
  const label3d = useLabel3dStore(props.canvasId, canvas);
  const mask = useMaskStore(props.canvasId, label3d);
  const recognize = useRecognizeStore(props.canvasId, canvas, label3d, mask);

  const debouncedLoad = useDebounceFn((val: number) => {
    label3d.loadSlice(val);
  }, 50);

  const sliderModel = computed({
    get: () => label3d.currentIndex,
    set: (val: number) => {
      debouncedLoad(val);
    },
  });

  function handleInput(val: number | undefined) {
    if (val === undefined || val === null) return;
    const idx = Math.max(0, Math.min(val, label3d.volumeInfo.totalSlices - 1));
    label3d.loadSlice(idx);
  }
</script>

<template>
  <div v-if="label3d.hasVolume" class="slice-slider">
    <span class="axis-badge">{{ label3d.volumeConfig.axis }}</span>
    <el-input-number
      :model-value="label3d.currentIndex"
      :min="0"
      :max="label3d.volumeInfo.totalSlices - 1"
      :step="1"
      size="small"
      controls-position="right"
      :disabled="recognize.isRecognizing"
      @change="handleInput"
    />
    <span class="slice-total">/ {{ label3d.volumeInfo.totalSlices - 1 }}</span>
    <el-slider
      v-model="sliderModel"
      :min="0"
      :max="Math.max(0, label3d.volumeInfo.totalSlices - 1)"
      :step="1"
      :show-tooltip="false"
      :disabled="recognize.isRecognizing"
      class="slider"
    />
  </div>
</template>

<style scoped lang="scss">
  .slice-slider {
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
    padding: var(--spacing-2) var(--spacing-4);
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-default);
  }

  .axis-badge {
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--accent-primary);
    background: var(--accent-muted);
    padding: 2px 6px;
    border-radius: var(--radius-sm);
    text-transform: uppercase;
  }

  .slice-total {
    font-size: var(--text-xs);
    color: var(--text-secondary);
    white-space: nowrap;
  }

  .slider {
    flex: 1;
  }
</style>
