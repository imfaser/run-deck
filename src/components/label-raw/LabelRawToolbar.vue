<script setup lang="ts">
  import { ref, computed } from 'vue';
  import { open } from '@tauri-apps/plugin-dialog';
  import { useLabelRawStore, type VolumeConfig } from '@/stores/label-raw';
  import { useMaskRenderer } from '@/composables/useMaskRenderer';
  import { useMaskRenderOnChange } from '@/composables/useMaskRenderOnChange';

  const store = useLabelRawStore();
  const { renderMask } = useMaskRenderer();

  useMaskRenderOnChange({
    store,
    hasMask: () => !!store.currentKeyframe?.rawMaskHash,
    renderFn: async () => {
      const kf = store.currentKeyframe;
      if (!kf?.rawMaskHash) return;
      const maskUrl = await renderMask(
        kf.rawMaskHash,
        store.maskSettings.threshold,
        store.maskSettings.color
      );
      kf.maskUrl = maskUrl;
    },
  });

  const isLoadingMask = ref(false);
  const showConfigDialog = ref(false);

  // Config dialog state
  const configForm = ref<VolumeConfig>({
    x: 100,
    y: 100,
    z: 100,
    dtype: 'u16',
    endian: 'little',
    axis: 'z',
  });

  const cursorDisplay = computed(() => {
    if (!store.cursorImagePos) return '坐标: -, -';
    return `坐标: ${store.cursorImagePos.x}, ${store.cursorImagePos.y}`;
  });

  async function handleOpenRaw() {
    const selected = await open({
      multiple: false,
      filters: [{ name: 'Raw', extensions: ['raw'] }],
    });
    if (!selected) return;

    store.filePath = selected as string;
    showConfigDialog.value = true;
  }

  async function handleConfirmConfig() {
    store.volumeConfig = { ...configForm.value };
    showConfigDialog.value = false;
    await store.openVolume();
  }

  async function handleAIRecognize() {
    if (!store.hasVolume) return;
    isLoadingMask.value = true;
    try {
      await store.recognizeCurrentSlice();
    } finally {
      isLoadingMask.value = false;
    }
  }

  async function handleBatchRecognize() {
    isLoadingMask.value = true;
    try {
      await store.batchRecognize(store.batchRange.start, store.batchRange.end);
    } finally {
      isLoadingMask.value = false;
    }
  }

  const recognizeProgressDisplay = computed(() => {
    if (!store.isRecognizing) return '';
    return `${store.recognitionProgress.current + 1}/${store.recognitionProgress.total}`;
  });

  function handleFitImage() {
    store.fitImageTrigger++;
  }
</script>

<template>
  <div class="label-raw-toolbar">
    <div class="toolbar-left">
      <el-button @click="handleOpenRaw">
        <template #icon>
          <span>📂</span>
        </template>
        打开 Raw
      </el-button>
      <el-button
        type="primary"
        :loading="isLoadingMask"
        :disabled="!store.canRecognize"
        @click="handleAIRecognize"
      >
        <template #icon>
          <span>🤖</span>
        </template>
        AI 识别
      </el-button>
      <el-button v-if="store.isRecognizing" type="danger" @click="store.stopRecognition()">
        <template #icon>
          <span>⏹</span>
        </template>
        停止 {{ recognizeProgressDisplay }}
      </el-button>
      <el-button v-else :disabled="!store.hasVolume" @click="handleBatchRecognize">
        <template #icon>
          <span>🔄</span>
        </template>
        批量识别
      </el-button>
      <el-button :disabled="!store.sliceImageUrl" @click="handleFitImage">
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
      <el-button :disabled="!store.hasVolume" @click="store.exportMaskVolume()">
        <template #icon>
          <span>💾</span>
        </template>
        导出
      </el-button>
      <span class="cursor-pos">{{ cursorDisplay }}</span>
    </div>

    <!-- Volume config dialog -->
    <el-dialog
      v-model="showConfigDialog"
      title="Volume 配置"
      width="400px"
      :close-on-click-modal="false"
    >
      <el-form label-width="80px">
        <el-form-item label="X">
          <el-input-number v-model="configForm.x" :min="1" :max="10000" />
        </el-form-item>
        <el-form-item label="Y">
          <el-input-number v-model="configForm.y" :min="1" :max="10000" />
        </el-form-item>
        <el-form-item label="Z">
          <el-input-number v-model="configForm.z" :min="1" :max="10000" />
        </el-form-item>
        <el-form-item label="Dtype">
          <el-select v-model="configForm.dtype">
            <el-option label="uint8" value="u8" />
            <el-option label="uint16" value="u16" />
          </el-select>
        </el-form-item>
        <el-form-item label="Endian">
          <el-select v-model="configForm.endian">
            <el-option label="Little" value="little" />
            <el-option label="Big" value="big" />
          </el-select>
        </el-form-item>
        <el-form-item label="Axis">
          <el-select v-model="configForm.axis">
            <el-option label="Z (Axial)" value="z" />
            <el-option label="Y (Coronal)" value="y" />
            <el-option label="X (Sagittal)" value="x" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showConfigDialog = false">取消</el-button>
        <el-button type="primary" @click="handleConfirmConfig">确认</el-button>
      </template>
    </el-dialog>

    <!-- Recognize all progress dialog -->
    <el-dialog
      v-model="store.isRecognizing"
      title="批量识别"
      width="360px"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      :show-close="false"
      center
    >
      <div style="text-align: center; padding: 16px 0">
        <el-progress
          :percentage="
            store.volumeInfo.totalSlices > 0
              ? Math.round(
                  (store.recognitionProgress.current / store.recognitionProgress.total) * 100
                )
              : 0
          "
          :status="
            store.recognitionProgress.current >= store.recognitionProgress.total
              ? 'success'
              : undefined
          "
        />
        <p style="margin-top: 12px; color: var(--text-secondary)">
          {{ store.recognitionProgress.current + 1 }} / {{ store.recognitionProgress.total }}
        </p>
      </div>
      <template #footer>
        <el-button type="danger" @click="store.stopRecognition()">停止识别</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
  @use '@/styles/abstracts/mixins' as *;

  .label-raw-toolbar {
    @include annotation-toolbar;
  }
</style>
