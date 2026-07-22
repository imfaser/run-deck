<script setup lang="ts">
  // ========== 1. 第三方 / 内部模块引入 ==========
  import { ref, computed } from 'vue';
  import { open } from '@tauri-apps/plugin-dialog';
  import { convertFileSrc } from '@tauri-apps/api/core';
  import { useLabelStore } from '@/stores/label';
  import { segmentImage } from '@/services/sam3';
  import { useMaskRenderer } from '@/composables/useMaskRenderer';
  import { useMaskRenderOnChange } from '@/composables/useMaskRenderOnChange';

  // ========== 2. 组合式函数（Composables）调用 ==========
  const store = useLabelStore();
  const { renderMask } = useMaskRenderer();

  useMaskRenderOnChange({
    store,
    hasMask: () => !!store.rawMaskPath,
    renderFn: async () => {
      if (!store.rawMaskPath) return;
      const maskUrl = await renderMask(
        store.rawMaskPath,
        store.maskSettings.threshold,
        store.maskSettings.color
      );
      store.maskUrl = maskUrl;
    },
  });

  // ========== 4. 响应式状态声明 ==========
  const isLoadingMask = ref(false);

  // ========== 5. 计算属性 ==========
  const cursorDisplay = computed(() => {
    if (!store.cursorImagePos) return '坐标: -, -';
    return `坐标: ${store.cursorImagePos.x}, ${store.cursorImagePos.y}`;
  });

  // ========== 7. 普通方法与业务逻辑 ==========
  async function handleOpenImage() {
    const selected = await open({
      multiple: false,
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'bmp', 'webp'] }],
    });
    if (selected) {
      store.imagePath = selected as string;
      store.imageUrl = convertFileSrc(selected as string);
      store.clearAnnotations();
      store.maskUrl = null;
      store.rawMaskPath = null;
    }
  }

  async function handleAIRecognize() {
    if (!store.imagePath) return;
    if (store.annotations.length === 0) return;

    isLoadingMask.value = true;
    try {
      const pPoints = store.positivePoints.map((p) => [p.x, p.y] as [number, number]);
      const nPoints = store.negativePoints.map((p) => [p.x, p.y] as [number, number]);
      const boxList = store.boxes.map(
        (b) => [b.x1, b.y1, b.x2, b.y2] as [number, number, number, number]
      );

      const result = await segmentImage(store.imagePath, {
        p_point: pPoints.length > 0 ? pPoints : undefined,
        n_point: nPoints.length > 0 ? nPoints : undefined,
        boxes: boxList.length > 0 ? boxList : undefined,
      });

      const imgBlock = result.content.find((b) => b.type === 'image');
      if (imgBlock && 'data' in imgBlock) {
        store.rawMaskPath = convertFileSrc(imgBlock.data, 'mcp');
        const maskUrl = await renderMask(
          store.rawMaskPath,
          store.maskSettings.threshold,
          store.maskSettings.color
        );
        store.maskUrl = maskUrl;
      }
    } finally {
      isLoadingMask.value = false;
    }
  }

  function handleFitImage() {
    store.fitImageTrigger++;
  }
</script>

<template>
  <div class="label-toolbar">
    <div class="toolbar-left">
      <el-button @click="handleOpenImage">
        <template #icon>
          <span>📂</span>
        </template>
        打开图片
      </el-button>
      <el-button
        type="primary"
        :loading="isLoadingMask"
        :disabled="!store.imagePath || store.annotations.length === 0"
        @click="handleAIRecognize"
      >
        <template #icon>
          <span>🤖</span>
        </template>
        AI 识别
      </el-button>
      <el-button :disabled="!store.imageUrl" @click="handleFitImage">
        <template #icon>
          <span>⊞</span>
        </template>
        适应图像
      </el-button>
    </div>

    <div class="toolbar-right">
      <div class="mask-color-picker">
        <span class="slider-label">Mask 颜色:</span>
        <el-color-picker
          v-model="store.maskSettings.color"
          :predefine="['#0096ff', '#22c55e', '#ef4444', '#eab308', '#a855f7']"
        />
      </div>
      <div class="confidence-slider">
        <span class="slider-label">置信度阈值:</span>
        <el-slider
          v-model="store.maskSettings.threshold"
          :min="0"
          :max="255"
          :step="1"
          :show-tooltip="false"
          style="width: 120px"
        />
        <span class="slider-value">{{ store.maskSettings.threshold }}</span>
      </div>
      <span class="cursor-pos">{{ cursorDisplay }}</span>
    </div>
  </div>
</template>

<style scoped lang="scss">
  @use '@/styles/abstracts/mixins' as *;

  .label-toolbar {
    @include annotation-toolbar;
  }
</style>
