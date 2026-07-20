<script setup lang="ts">
  // ========== 1. 第三方 / 内部模块引入 ==========
  import { ref } from 'vue';
  import { useLabelKeyboard } from '@/composables/useLabelKeyboard';
  import LabelToolbar from '@/components/label/LabelToolbar.vue';
  import LabelModePanel from '@/components/shared/LabelModePanel.vue';
  import LabelToolPanel from '@/components/shared/LabelToolPanel.vue';
  import LabelCanvas from '@/components/label/LabelCanvas.vue';
  import LabelInfoPanel from '@/components/label/LabelInfoPanel.vue';
  import { useLabelStore } from '@/stores/label';

  // ========== 2. 组合式函数（Composables）调用 ==========
  useLabelKeyboard();
  const store = useLabelStore();

  // ========== 3. 响应式状态声明 ==========
  const canvasRef = ref<InstanceType<typeof LabelCanvas> | null>(null);

  // ========== 4. 普通方法与业务逻辑 ==========
  function handleFitImage() {
    canvasRef.value?.fitToImage();
  }
</script>

<template>
  <el-container direction="vertical" class="label-page">
    <LabelToolbar @fit-image="handleFitImage" />

    <el-container class="label-body">
      <el-aside width="64px" class="label-sidebar-left">
        <LabelModePanel :mode="store.mode" @set-mode="(m) => store.setMode(m)" />
        <LabelToolPanel :mode="store.mode" :tool="store.tool" @set-tool="(t) => store.setTool(t)" />
      </el-aside>

      <el-main class="label-canvas-area">
        <LabelCanvas ref="canvasRef" />
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
