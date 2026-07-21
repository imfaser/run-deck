<script setup lang="ts">
  import { ref, computed } from 'vue';
  import { open } from '@tauri-apps/plugin-dialog';
  import { useLabelRawStore } from '@/stores/label-raw';
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
      const maskUrl = await renderMask(kf.rawMaskHash, store.confidenceThreshold, store.maskColor);
      kf.maskUrl = maskUrl;
    },
  });

  const emit = defineEmits<{
    fitImage: [];
  }>();

  const isLoadingMask = ref(false);
  const showConfigDialog = ref(false);

  // Config dialog state
  const configX = ref(100);
  const configY = ref(100);
  const configZ = ref(100);
  const configDtype = ref('u16');
  const configEndian = ref('little');
  const configAxis = ref('z');

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
    store.volumeX = configX.value;
    store.volumeY = configY.value;
    store.volumeZ = configZ.value;
    store.dtype = configDtype.value as 'u8' | 'u16';
    store.endian = configEndian.value as 'little' | 'big';
    store.axis = configAxis.value as 'x' | 'y' | 'z';
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

  async function handleBatchProcess() {
    isLoadingMask.value = true;
    try {
      await store.batchProcessKeyframes();
    } finally {
      isLoadingMask.value = false;
    }
  }

  async function handleRecognizeAll() {
    const { ElMessageBox } = await import('element-plus');

    // Show endSlice dialog (1-indexed for user)
    let endSlice: number | undefined;
    try {
      const result = await ElMessageBox.prompt('识别全部：指定结束 slice 编号', '识别全部', {
        confirmButtonText: '开始识别',
        cancelButtonText: '取消',
        inputPlaceholder: `默认 ${store.totalSlices}`,
        inputType: 'number',
        inputValue: String(store.totalSlices),
        inputValidator: (val: string) => {
          if (val === '') return true;
          const n = Number(val);
          if (Number.isNaN(n) || n < 1 || n > store.totalSlices) {
            return `请输入 1 ~ ${store.totalSlices} 之间的数字`;
          }
          return true;
        },
      });
      if (result.value !== '' && result.value !== undefined) {
        endSlice = Number(result.value) - 1; // Convert to 0-indexed
      }
    } catch {
      return; // User cancelled
    }

    // Start recognition in background
    store.recognizeAllSlices(endSlice);
  }

  const recognizeProgressDisplay = computed(() => {
    if (!store.isRecognizing) return '';
    return `${store.recognitionProgress.current + 1}/${store.recognitionProgress.total}`;
  });
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
      <el-button :disabled="!store.hasVolume" @click="store.toggleKeyframe()">
        <template #icon>
          <span>📌</span>
        </template>
        {{ store.isManualKeyframe ? '取消关键帧' : '关键帧标记' }}
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
      <el-button :disabled="!store.hasVolume" @click="handleBatchProcess">
        <template #icon>
          <span>⚡</span>
        </template>
        批量处理
      </el-button>
      <el-button v-if="store.isRecognizing" type="danger" @click="store.stopRecognition()">
        <template #icon>
          <span>⏹</span>
        </template>
        停止 {{ recognizeProgressDisplay }}
      </el-button>
      <el-button v-else :disabled="!store.hasVolume" @click="handleRecognizeAll">
        <template #icon>
          <span>🔄</span>
        </template>
        识别全部
      </el-button>
      <el-button :disabled="!store.sliceImageUrl" @click="emit('fitImage')">
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
          v-model="store.maskColor"
          :predefine="['#0096ff', '#22c55e', '#ef4444', '#eab308', '#a855f7']"
        />
      </div>
      <div class="confidence-slider">
        <span class="slider-label">置信度阈值:</span>
        <el-slider
          v-model="store.confidenceThreshold"
          :min="0"
          :max="255"
          :step="1"
          :show-tooltip="false"
          style="width: 120px"
        />
        <span class="slider-value">{{ store.confidenceThreshold }}</span>
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
          <el-input-number v-model="configX" :min="1" :max="10000" />
        </el-form-item>
        <el-form-item label="Y">
          <el-input-number v-model="configY" :min="1" :max="10000" />
        </el-form-item>
        <el-form-item label="Z">
          <el-input-number v-model="configZ" :min="1" :max="10000" />
        </el-form-item>
        <el-form-item label="Dtype">
          <el-select v-model="configDtype">
            <el-option label="uint8" value="u8" />
            <el-option label="uint16" value="u16" />
          </el-select>
        </el-form-item>
        <el-form-item label="Endian">
          <el-select v-model="configEndian">
            <el-option label="Little" value="little" />
            <el-option label="Big" value="big" />
          </el-select>
        </el-form-item>
        <el-form-item label="Axis">
          <el-select v-model="configAxis">
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
      title="识别全部"
      width="360px"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      :show-close="false"
      center
    >
      <div style="text-align: center; padding: 16px 0">
        <el-progress
          :percentage="
            store.totalSlices > 0
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
