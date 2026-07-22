<script setup lang="ts">
  import { useLabelRawKeyboard } from '@/composables/useLabelRawKeyboard';
  import { useLabelRawStore } from '@/stores/label-raw';
  import LabelRawToolbar from '@/components/label-raw/LabelRawToolbar.vue';
  import LabelRawModePanel from '@/components/shared/LabelModePanel.vue';
  import LabelRawToolPanel from '@/components/shared/LabelToolPanel.vue';
  import LabelRawCanvas from '@/components/label-raw/LabelRawCanvas.vue';
  import LabelRawSliceSlider from '@/components/label-raw/LabelRawSliceSlider.vue';
  import LabelRawKeyframePanel from '@/components/label-raw/LabelRawKeyframePanel.vue';

  useLabelRawKeyboard();
  const store = useLabelRawStore();
</script>

<template>
  <el-container direction="vertical" class="label-raw-page">
    <LabelRawToolbar />
    <LabelRawSliceSlider />

    <el-container class="label-raw-body">
      <el-aside width="64px" class="label-sidebar-left">
        <LabelRawModePanel :mode="store.mode" store-type="raw" />
        <LabelRawToolPanel :mode="store.mode" :tool="store.tool" store-type="raw" />
      </el-aside>

      <el-main class="label-canvas-area">
        <LabelRawCanvas />
      </el-main>

      <el-aside width="220px" class="label-sidebar-right">
        <LabelRawKeyframePanel />
      </el-aside>
    </el-container>
  </el-container>
</template>

<style scoped lang="scss">
  .label-raw-page {
    height: 100%;
    overflow: hidden;
  }

  .label-raw-body {
    flex: 1;
    overflow: hidden;
  }

  .label-sidebar-left {
    display: flex;
    flex-direction: column;
    background: var(--bg-secondary);
    border-right: 1px solid var(--border-default);
    overflow-y: auto;
  }

  .label-canvas-area {
    padding: 0;
    overflow: hidden;
    position: relative;
  }

  .label-sidebar-right {
    background: var(--bg-secondary);
    border-left: 1px solid var(--border-default);
    overflow: hidden;
  }
</style>
