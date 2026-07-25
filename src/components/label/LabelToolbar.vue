<script setup lang="ts">
  import { ref, computed } from 'vue';
  import { open } from '@tauri-apps/plugin-dialog';
  import { convertFileSrc } from '@tauri-apps/api/core';
  import { useLabelStore } from '@/stores/label';
  import { useLabelDefStore } from '@/stores/label-def';
  import { segmentImage } from '@/services/sam3';
  import { useMaskRenderer } from '@/composables/useMaskRenderer';
  import { useMaskRenderOnChange } from '@/composables/useMaskRenderOnChange';
  import { useLocateAnything } from '@/composables/useLocateAnything';
  import { logMessage } from '@/services/cmd';

  const store = useLabelStore();
  const labelDefStore = useLabelDefStore();
  const { renderMask } = useMaskRenderer();

  useMaskRenderOnChange({
    store,
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

  const isLoadingMask = ref(false);
  const isDetecting = ref(false);

  const cursorDisplay = computed(() => {
    if (!store.cursorImagePos) return '坐标: -, -';
    return `坐标: ${store.cursorImagePos.x}, ${store.cursorImagePos.y}`;
  });

  async function handleOpenImage() {
    const selected = await open({
      multiple: false,
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'bmp', 'webp'] }],
    });
    if (selected) {
      const imagePath = selected as string;
      store.imagePath = imagePath;
      store.imageUrl = convertFileSrc(imagePath);
      store.clearObjects();
      store.maskUrl = null;
      store.rawMaskPath = null;
    }
  }

  async function handleAIRecognize() {
    if (!store.imagePath) return;
    if (store.objects.length === 0) return;

    isLoadingMask.value = true;
    try {
      const result = await segmentImage(store.imagePath, store.objects);

      const imgBlock = result.content.find((b) => b.type === 'image');
      if (imgBlock && 'data' in imgBlock) {
        store.rawMaskPath = imgBlock.data;
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

  async function handleAIDetect() {
    await logMessage('info', '[detect] handleAIDetect called');
    if (!store.imagePath) {
      await logMessage('warn', '[detect] no image path, aborting');
      return;
    }

    await logMessage('info', `[detect] imagePath=${store.imagePath.substring(0, 50)}...`);
    await logMessage('info', `[detect] labels count=${labelDefStore.labels.length}`);

    const activeLabels = labelDefStore.labels.filter(
      (l) => labelDefStore.getLocateConfig(l.id)?.mode
    );
    await logMessage(
      'info',
      `[detect] active labels with config: ${activeLabels.map((l) => l.name).join(', ')}`
    );

    if (activeLabels.length === 0) {
      const { ElMessage } = await import('element-plus');
      ElMessage.warning('请先在标注设置中配置检测模式');
      return;
    }

    isDetecting.value = true;
    try {
      const { runDetectForCurrentImage } = useLocateAnything({
        volumeId: ref(null),
        currentIndex: ref(0),
        imageWidth: ref(store.imageWidth),
        imageHeight: ref(store.imageHeight),
        getKeyframe: async () => undefined,
        putKeyframe: async () => {},
        imagePath: ref(store.imagePath),
        objects: computed(() => store.objects),
      });

      for (const label of activeLabels) {
        try {
          await logMessage(
            'info',
            `[detect] starting detection for label "${label.name}" (id=${label.id})`
          );
          const results = await runDetectForCurrentImage(label.id);
          store.objects.push(...results);
          await logMessage(
            'info',
            `[detect] label="${label.name}" completed: ${results.length} objects detected`
          );
        } catch (e) {
          await logMessage('error', `[detect] label="${label.name}" failed: ${e}`);
        }
      }
    } finally {
      isDetecting.value = false;
      await logMessage('info', '[detect] handleAIDetect finished');
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
        :disabled="!store.imagePath || store.objects.length === 0"
        @click="handleAIRecognize"
      >
        <template #icon>
          <span>🤖</span>
        </template>
        AI 识别
      </el-button>
      <el-button
        type="success"
        :loading="isDetecting"
        :disabled="!store.imagePath"
        @click="handleAIDetect"
      >
        <template #icon>
          <span>🔍</span>
        </template>
        AI 检测
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
