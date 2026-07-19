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

  const axisLabel = computed(() => {
    if (!store.hasVolume) return '';
    return `${store.axis} ----- ${store.currentIndex + 1}/${store.totalSlices}`;
  });
</script>

<template>
  <div v-if="store.hasVolume" class="slice-slider">
    <span class="axis-label">{{ axisLabel }}</span>
    <el-slider
      v-model="sliderModel"
      :min="0"
      :max="Math.max(0, store.totalSlices - 1)"
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

  .axis-label {
    font-size: var(--text-sm);
    color: var(--text-secondary);
    font-family: monospace;
    white-space: nowrap;
    min-width: 120px;
  }

  .slider {
    flex: 1;
  }
</style>
