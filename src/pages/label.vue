<script setup lang="ts">
  import { useLabelKeyboard } from '@/composables/useLabelKeyboard';
  import { useLabel2dCanvasStore } from '@/stores/canvas-2d';
  import LabelToolbar from '@/components/label/LabelToolbar.vue';
  import LabelModePanel from '@/components/shared/LabelModePanel.vue';
  import LabelToolPanel from '@/components/shared/LabelToolPanel.vue';
  import LabelSettingsButton from '@/components/shared/LabelSettingsButton.vue';
  import LabelCanvas from '@/components/label/LabelCanvas.vue';
  import LabelInfoPanel from '@/components/label/LabelInfoPanel.vue';
  import LabelNameDialogHandler from '@/components/label/LabelNameDialogHandler.vue';
  import ObjectSelectPopup from '@/components/label/ObjectSelectPopup.vue';

  const canvas = useLabel2dCanvasStore();

  useLabelKeyboard(canvas);
</script>

<template>
  <LabelNameDialogHandler />
  <ObjectSelectPopup />
  <el-container direction="vertical" class="label-page">
    <LabelToolbar />

    <el-container class="label-body">
      <el-aside width="80px" class="label-sidebar-left">
        <LabelModePanel />
        <LabelToolPanel />
        <LabelSettingsButton />
      </el-aside>

      <el-main class="label-canvas-area">
        <LabelCanvas />
      </el-main>

      <el-aside width="220px" class="label-sidebar-right">
        <LabelInfoPanel />
      </el-aside>
    </el-container>
  </el-container>
</template>

<style scoped lang="scss">
  .label-page {
    height: 100%;
    overflow: hidden;
  }

  .label-body {
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
