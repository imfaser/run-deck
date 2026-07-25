<script setup lang="ts">
  import { onMounted, onBeforeUnmount } from 'vue';
  import { useRoute } from 'vue-router';
  import { useLabelRawKeyboard } from '@/composables/useLabelRawKeyboard';
  import { useCanvasStore } from '@/stores/canvas';
  import { useLabelDefStore } from '@/stores/label-def';
  import LabelRawToolbar from '@/components/label-raw/LabelRawToolbar.vue';
  import LabelRawModePanel from '@/components/shared/LabelModePanel.vue';
  import LabelRawToolPanel from '@/components/shared/LabelToolPanel.vue';
  import LabelSettingsButton from '@/components/shared/LabelSettingsButton.vue';
  import LabelRawCanvas from '@/components/label-raw/LabelRawCanvas.vue';
  import LabelRawSliceSlider from '@/components/label-raw/LabelRawSliceSlider.vue';
  import LabelRawKeyframePanel from '@/components/label-raw/LabelRawKeyframePanel.vue';
  import LabelRawNameDialogHandler from '@/components/label-raw/LabelRawNameDialogHandler.vue';
  import LabelRawObjectSelectPopup from '@/components/label-raw/LabelRawObjectSelectPopup.vue';

  const route = useRoute();
  const canvasId = route.path === '/label-raw' ? 'label-raw' : 'label';

  const canvas = useCanvasStore(canvasId);
  useLabelRawKeyboard(canvas);

  const labelDefStore = useLabelDefStore();
  onMounted(() => {
    labelDefStore.appMode = '3d';
  });
  onBeforeUnmount(() => {
    labelDefStore.appMode = '2d';
  });
</script>

<template>
  <LabelRawNameDialogHandler :canvas-id="canvasId" />
  <LabelRawObjectSelectPopup :canvas-id="canvasId" />
  <el-container direction="vertical" class="label-raw-page">
    <LabelRawToolbar :canvas-id="canvasId" />
    <LabelRawSliceSlider :canvas-id="canvasId" />

    <el-container class="label-raw-body">
      <el-aside width="80px" class="label-sidebar-left">
        <LabelRawModePanel :canvas-id="canvasId" />
        <LabelRawToolPanel :canvas-id="canvasId" />
        <LabelSettingsButton />
      </el-aside>

      <el-main class="label-canvas-area">
        <LabelRawCanvas :canvas-id="canvasId" />
      </el-main>

      <el-aside width="220px" class="label-sidebar-right">
        <LabelRawKeyframePanel :canvas-id="canvasId" />
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
