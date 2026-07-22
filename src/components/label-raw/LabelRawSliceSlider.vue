<script setup lang="ts">
  import { computed } from 'vue';
  import { useDebounceFn } from '@vueuse/core';
  import { useLabelRawStore } from '@/stores/label-raw';

  const store = useLabelRawStore();

  const debouncedLoad = useDebounceFn((val: number) => {
    store.loadSlice(val);
  }, 50);

  const sliderModel = computed({
    get: () => store.currentIndex,
    set: (val: number) => {
      debouncedLoad(val);
    },
  });

  const displayIndex = computed(() => store.currentIndex + 1);

  function handleInput(val: number | undefined) {
    if (val === undefined || val === null) return;
    const idx = Math.max(1, Math.min(val, store.volumeInfo.totalSlices)) - 1;
    store.loadSlice(idx);
  }
</script>

<template>
  <div v-if="store.hasVolume" class="slice-slider">
    <span class="axis-badge">{{ store.volumeConfig.axis }}</span>
    <el-input-number
      :model-value="displayIndex"
      :min="1"
      :max="store.volumeInfo.totalSlices"
      :step="1"
      size="small"
      controls-position="right"
      :disabled="store.isRecognizing"
      @change="handleInput"
    />
    <span class="slice-total">/ {{ store.volumeInfo.totalSlices }}</span>
    <el-slider
      v-model="sliderModel"
      :min="0"
      :max="Math.max(0, store.volumeInfo.totalSlices - 1)"
      :step="1"
      :show-tooltip="false"
      :disabled="store.isRecognizing"
      class="slider"
    />
  </div>
</template>

<style scoped lang="scss">
  .slice-slider {
    display: flex;
    align-items: center;
    gap: var(--spacing-3);
    padding: var(--spacing-2) var(--spacing-4);
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-default);
    flex-shrink: 0;
  }

  .axis-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--text-inverse);
    background: var(--color-primary);
    border-radius: var(--radius-sm);
    text-transform: uppercase;
  }

  .slice-total {
    font-size: var(--text-sm);
    color: var(--text-secondary);
    white-space: nowrap;
    min-width: 40px;
  }

  .slider {
    flex: 1;
  }
</style>
