<script setup lang="ts">
  import { ref, computed } from 'vue';
  import { open } from '@tauri-apps/plugin-dialog';
  import { convertFileSrc } from '@tauri-apps/api/core';
  import { ElMessage } from 'element-plus/es/components/message/index.mjs';
  import { useCanvasStore } from '@/stores/canvas';
  import { useLabel2dStore } from '@/stores/label-2d';
  import { useLabelDefStore } from '@/stores/label-def';
  import { segmentImage } from '@/services/sam3';
  import { useMaskRenderer } from '@/composables/useMaskRenderer';
  import { useMaskRenderOnChange } from '@/composables/useMaskRenderOnChange';
  import { useLocateAnything } from '@/composables/useLocateAnything';
  import { logMessage } from '@/services/cmd';

  const props = defineProps<{ canvasId: string }>();

  const canvas = useCanvasStore(props.canvasId);
  const label2d = useLabel2dStore(props.canvasId);
  const labelDefStore = useLabelDefStore();
  const { renderMask } = useMaskRenderer();

  useMaskRenderOnChange({
    store: { ...canvas, ...label2d },
    renderFn: async () => {
      if (!label2d.rawMaskPath) return;
      const maskUrl = await renderMask(
        label2d.rawMaskPath,
        label2d.maskSettings.threshold,
        label2d.maskSettings.color
      );
      label2d.maskUrl = maskUrl;
    },
  });

  const isLoadingMask = ref(false);
  const isDetecting = ref(false);

  const cursorDisplay = computed(() => {
    if (!canvas.cursorImagePos) return '坐标: -, -';
    return `坐标: ${canvas.cursorImagePos.x}, ${canvas.cursorImagePos.y}`;
  });

  async function handleOpenImage() {
    const selected = await open({
      multiple: false,
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'bmp', 'webp'] }],
    });
    if (selected) {
      const path = selected as string;
      label2d.imagePath = path;
      label2d.imageUrl = convertFileSrc(path);
      canvas.clearObjects();
      label2d.maskUrl = null;
      label2d.rawMaskPath = null;
    }
  }

  async function handleAIRecognize() {
    if (!label2d.imagePath) return;
    if (canvas.objects.length === 0) return;

    isLoadingMask.value = true;
    try {
      const result = await segmentImage(label2d.imagePath, canvas.objects);

      const imgBlock = result.content.find((b) => b.type === 'image');
      if (imgBlock && 'data' in imgBlock) {
        label2d.rawMaskPath = imgBlock.data;
        const maskUrl = await renderMask(
          label2d.rawMaskPath,
          label2d.maskSettings.threshold,
          label2d.maskSettings.color
        );
        label2d.maskUrl = maskUrl;
      }
    } finally {
      isLoadingMask.value = false;
    }
  }

  async function handleAIDetect() {
    await logMessage('info', '[detect] handleAIDetect called');
    if (!label2d.imagePath) {
      await logMessage('warn', '[detect] no image path, aborting');
      return;
    }

    await logMessage('info', `[detect] imagePath=${label2d.imagePath.substring(0, 50)}...`);
    await logMessage('info', `[detect] labels count=${labelDefStore.labels.length}`);

    const activeLabels = labelDefStore.labels.filter(
      (l) => labelDefStore.getLocateConfig(l.id)?.mode
    );
    await logMessage(
      'info',
      `[detect] active labels with config: ${activeLabels.map((l) => l.name).join(', ')}`
    );

    if (activeLabels.length === 0) {
      ElMessage.warning('请先在标注设置中配置检测模式');
      return;
    }

    isDetecting.value = true;
    try {
      const { runDetectForCurrentImage } = useLocateAnything({
        volumeId: ref(null),
        currentIndex: ref(0),
        imageWidth: ref(canvas.imageWidth),
        imageHeight: ref(canvas.imageHeight),
        getKeyframe: async () => undefined,
        putKeyframe: async () => {},
        imagePath: ref(label2d.imagePath),
        objects: computed(() => canvas.objects),
        labelDefStore,
      });

      for (const label of activeLabels) {
        try {
          await logMessage(
            'info',
            `[detect] starting detection for label "${label.name}" (id=${label.id})`
          );
          const results = await runDetectForCurrentImage(label.id);
          canvas.objects.push(...results);
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
    canvas.fitImageTrigger++;
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
        :disabled="!label2d.imagePath || canvas.objects.length === 0"
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
        :disabled="!label2d.imagePath"
        @click="handleAIDetect"
      >
        <template #icon>
          <span>🔍</span>
        </template>
        AI 检测
      </el-button>
      <el-button :disabled="!label2d.imageUrl" @click="handleFitImage">
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
          v-model="label2d.maskSettings.color"
          :predefine="['#0096ff', '#22c55e', '#ef4444', '#eab308', '#a855f7']"
        />
      </div>
      <div class="confidence-slider">
        <span class="slider-label">置信度阈值:</span>
        <el-slider
          v-model="label2d.maskSettings.threshold"
          :min="0"
          :max="255"
          :step="1"
          :show-tooltip="false"
          style="width: 120px"
        />
        <span class="slider-value">{{ label2d.maskSettings.threshold }}</span>
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
