<script setup lang="ts">
  import { onMounted, onBeforeUnmount } from 'vue';
  import { useRoute } from 'vue-router';
  import { useLabelKeyboard } from '@/composables/useLabelKeyboard';
  import { useCanvasStore } from '@/stores/canvas';
  import { useLabelDefStore } from '@/stores/label-def';
  import LabelToolbar from '@/components/label/LabelToolbar.vue';
  import LabelModePanel from '@/components/shared/LabelModePanel.vue';
  import LabelToolPanel from '@/components/shared/LabelToolPanel.vue';
  import LabelSettingsButton from '@/components/shared/LabelSettingsButton.vue';
  import LabelCanvas from '@/components/label/LabelCanvas.vue';
  import LabelInfoPanel from '@/components/label/LabelInfoPanel.vue';
  import LabelNameDialogHandler from '@/components/label/LabelNameDialogHandler.vue';
  import ObjectSelectPopup from '@/components/label/ObjectSelectPopup.vue';

  const route = useRoute();
  const canvasId = route.path === '/label-raw' ? 'label-raw' : 'label';

  const canvas = useCanvasStore(canvasId);
  const labelDefStore = useLabelDefStore();

  useLabelKeyboard(canvas);

  onMounted(() => {
    labelDefStore.appMode = '2d';
  });
  onBeforeUnmount(() => {
    labelDefStore.appMode = '2d';
  });
</script>

<template>
  <LabelNameDialogHandler :canvas-id="canvasId" />
  <ObjectSelectPopup :canvas-id="canvasId" />
  <el-container direction="vertical" class="label-page">
    <LabelToolbar :canvas-id="canvasId" />

    <el-container class="label-body">
      <el-aside width="80px" class="label-sidebar-left">
        <LabelModePanel :canvas-id="canvasId" />
        <LabelToolPanel :canvas-id="canvasId" />
        <LabelSettingsButton />
      </el-aside>

      <el-main class="label-canvas-area">
        <LabelCanvas :canvas-id="canvasId" />
      </el-main>

      <el-aside width="220px" class="label-sidebar-right">
        <LabelInfoPanel :canvas-id="canvasId" />
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
