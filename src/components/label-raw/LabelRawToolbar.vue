<script setup lang="ts">
  import { ref, computed } from 'vue';
  import { open } from '@tauri-apps/plugin-dialog';
  import { ElMessage } from 'element-plus/es/components/message/index.mjs';
  import { useLabel3dCanvasStore } from '@/stores/canvas-3d';
  import { useLabel3dStore } from '@/stores/label-3d';
  import type { VolumeConfig } from '@/schemas/volume';
  import { useLabel3dMaskStore } from '@/stores/mask';
  import { useLabel3dRecognizeStore } from '@/stores/recognize';
  import { logMessage } from '@/services/cmd';

  const canvas = useLabel3dCanvasStore();
  const label3d = useLabel3dStore();
  const mask = useLabel3dMaskStore();
  const recognize = useLabel3dRecognizeStore();

  const isLoadingMask = ref(false);
  const showConfigDialog = ref(false);
  const showBatchDialog = ref(false);

  const configForm = ref<VolumeConfig>({
    x: 100,
    y: 100,
    z: 100,
    dtype: 'u16',
    endian: 'little',
    axis: 'z',
  });

  const cursorDisplay = computed(() => {
    if (!canvas.cursorImagePos) return '坐标: -, -';
    return `坐标: ${canvas.cursorImagePos.x}, ${canvas.cursorImagePos.y}`;
  });

  async function handleOpenRaw() {
    const selected = await open({
      multiple: false,
      filters: [{ name: 'Raw', extensions: ['raw'] }],
    });
    if (!selected) return;

    label3d.filePath = selected as string;
    showConfigDialog.value = true;
  }

  async function handleConfirmConfig() {
    label3d.volumeConfig = { ...configForm.value };
    showConfigDialog.value = false;
    await label3d.openVolume();
  }

  async function handleAIRecognize() {
    await logMessage(
      'debug',
      `[toolbar] handleAIRecognize clicked, hasVolume=${label3d.hasVolume}`
    );
    if (!label3d.hasVolume) return;
    isLoadingMask.value = true;
    try {
      await recognize.recognizeCurrentSlice();
    } finally {
      isLoadingMask.value = false;
    }
  }

  const batchForm = ref({ start: 0, end: 0 });

  function handleOpenBatchDialog() {
    batchForm.value = { start: label3d.batchRange.start, end: label3d.batchRange.end };
    showBatchDialog.value = true;
  }

  async function handleConfirmBatch() {
    const { start, end } = batchForm.value;
    if (start >= end) {
      ElMessage.error('起始 slice 必须小于结束 slice');
      return;
    }
    showBatchDialog.value = false;
    label3d.batchRange = { start, end };
    isLoadingMask.value = true;
    try {
      await recognize.batchRecognize(start, end);
    } finally {
      isLoadingMask.value = false;
    }
  }

  const recognizeProgressDisplay = computed(() => {
    if (!recognize.isRecognizing) return '';
    return `${recognize.progress.current}/${recognize.progress.total}`;
  });

  function handleFitImage() {
    canvas.fitImageTrigger++;
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
        :disabled="!label3d.canRecognize"
        @click="handleAIRecognize"
      >
        <template #icon>
          <span>🤖</span>
        </template>
        AI 识别
      </el-button>
      <el-button v-if="recognize.isRecognizing" type="danger" @click="recognize.stopRecognition()">
        <template #icon>
          <span>⏹</span>
        </template>
        停止 {{ recognizeProgressDisplay }}
      </el-button>
      <el-button v-else :disabled="!label3d.hasVolume" @click="handleOpenBatchDialog">
        <template #icon>
          <span>🔄</span>
        </template>
        批量识别
      </el-button>
      <el-button :disabled="!label3d.sliceImageUrl" @click="handleFitImage">
        <template #icon>
          <span>⊞</span>
        </template>
        适应图像
      </el-button>
    </div>

    <div class="toolbar-right">
      <div class="mask-toggle">
        <span class="slider-label">前序Mask辅助:</span>
        <el-switch v-model="mask.maskSettings.prevMaskAssist" size="small" />
      </div>
      <div class="mask-color-picker">
        <span class="slider-label">Mask 颜色:</span>
        <el-color-picker
          v-model="mask.maskSettings.color"
          :predefine="['#0096ff', '#22c55e', '#ef4444', '#eab308', '#a855f7']"
        />
      </div>
      <div v-if="mask.maskSettings.prevMaskAssist" class="mask-color-picker">
        <span class="slider-label">前序颜色:</span>
        <el-color-picker
          v-model="mask.maskSettings.prevMaskColor"
          :predefine="['#ef4444', '#f97316', '#eab308', '#a855f7', '#ec4899']"
        />
      </div>
      <div class="confidence-slider">
        <span class="slider-label">置信度阈值:</span>
        <el-slider
          v-model="mask.maskSettings.threshold"
          :min="0"
          :max="255"
          :step="1"
          :show-tooltip="false"
          style="width: 120px"
        />
        <span class="slider-value">{{ mask.maskSettings.threshold }}</span>
      </div>
      <el-button :disabled="!label3d.hasVolume" @click="label3d.exportMaskVolume()">
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

    <!-- Batch range dialog -->
    <el-dialog
      v-model="showBatchDialog"
      title="批量识别范围"
      width="360px"
      :close-on-click-modal="false"
    >
      <el-form label-width="60px">
        <el-form-item label="起始">
          <el-input-number
            v-model="batchForm.start"
            :min="0"
            :max="label3d.volumeInfo.totalSlices - 1"
          />
        </el-form-item>
        <el-form-item label="结束">
          <el-input-number
            v-model="batchForm.end"
            :min="0"
            :max="label3d.volumeInfo.totalSlices - 1"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showBatchDialog = false">取消</el-button>
        <el-button type="primary" @click="handleConfirmBatch">开始识别</el-button>
      </template>
    </el-dialog>

    <!-- Recognize all progress dialog -->
    <el-dialog
      v-model="recognize.isRecognizing"
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
            label3d.volumeInfo.totalSlices > 0
              ? Math.round((recognize.progress.current / recognize.progress.total) * 100)
              : 0
          "
          :status="recognize.progress.current >= recognize.progress.total ? 'success' : undefined"
        />
        <p style="margin-top: 12px; color: var(--text-secondary)">
          {{ recognize.progress.current }} / {{ recognize.progress.total }}
        </p>
      </div>
      <template #footer>
        <el-button type="danger" @click="recognize.stopRecognition()">停止识别</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
  @use '@/styles/abstracts/mixins' as *;

  .label-raw-toolbar {
    @include annotation-toolbar;
  }

  .mask-toggle {
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
  }
</style>
