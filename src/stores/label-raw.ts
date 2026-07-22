import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { cloneDeep, sortBy } from 'es-toolkit';
import { rawOpen, rawSlice, rawExportMasks, type RawOpenResponse } from '@/services/raw3d';
import { logMessage } from '@/services/cmd';
import { useRawRecognize } from '@/composables/useRawRecognize';
import { createAnnotationActions } from '@/stores/shared/annotation-actions';
import type {
  AnnotationType,
  LabelMode,
  PointAnnotation,
  BoxAnnotation,
  Annotation,
} from '@/schemas/annotation';

export type VolumeDtype = 'u8' | 'u16';
export type VolumeEndian = 'little' | 'big';
export type VolumeAxis = 'x' | 'y' | 'z';

export interface VolumeConfig {
  x: number;
  y: number;
  z: number;
  dtype: VolumeDtype;
  endian: VolumeEndian;
  axis: VolumeAxis;
}

export interface VolumeInfo {
  totalSlices: number;
  sliceWidth: number;
  sliceHeight: number;
}

export interface MaskSettings {
  color: string;
  opacity: number;
  threshold: number;
}

export interface Keyframe {
  annotations: Annotation[];
  maskUrl: string | null;
  maskVisible: boolean;
  rawMaskHash: string | null;
  manual: boolean;
}

export const useLabelRawStore = defineStore('label-raw', () => {
  // ─── Volume config ─────────────────────────────────
  const filePath = ref<string | null>(null);
  const volumeConfig = ref<VolumeConfig>({
    x: 100,
    y: 100,
    z: 100,
    dtype: 'u16',
    endian: 'little',
    axis: 'z',
  });

  // ─── Volume handle ─────────────────────────────────
  const volumeId = ref<string | null>(null);
  const volumeInfo = ref<VolumeInfo>({ totalSlices: 0, sliceWidth: 0, sliceHeight: 0 });

  // ─── Current view ──────────────────────────────────
  const currentIndex = ref(0);
  const sliceImageUrl = ref<string | null>(null);
  const sliceMin = ref(0);
  const sliceMax = ref(255);
  const isLoadingSlice = ref(false);
  const currentMaskUrl = ref<string | null>(null);

  // ─── Keyframes ─────────────────────────────────────
  const keyframes = ref<Map<number, Keyframe>>(new Map());

  function cloneKeyframes() {
    keyframes.value = new Map(keyframes.value);
  }

  // ─── Canvas state ──────────────────────────────────
  const mode = ref<LabelMode>('create');
  const tool = ref<AnnotationType>('p_point');
  const annotations = ref<Annotation[]>([]);
  const selectedId = ref<string | null>(null);
  const stageScale = ref(1);
  const stagePos = ref({ x: 0, y: 0 });

  // ─── Mask settings ─────────────────────────────────
  const maskSettings = ref<MaskSettings>({ color: '#0096ff', opacity: 0.6, threshold: 128 });
  const cursorImagePos = ref<{ x: number; y: number } | null>(null);

  // ─── Fit image trigger ─────────────────────────────
  const fitImageTrigger = ref(0);

  // ─── Recognition composable ────────────────────────
  const recognize = useRawRecognize({
    volumeId,
    keyframes,
    annotations,
    currentIndex,
    totalSlices: computed(() => volumeInfo.value.totalSlices),
    currentMaskUrl,
    confidenceThreshold: computed(() => maskSettings.value.threshold),
    maskColor: computed(() => maskSettings.value.color),
    cloneKeyframes,
  });

  // ─── Computed ──────────────────────────────────────
  const positivePoints = computed(() =>
    annotations.value.filter((a): a is PointAnnotation => a.type === 'p_point')
  );

  const negativePoints = computed(() =>
    annotations.value.filter((a): a is PointAnnotation => a.type === 'n_point')
  );

  const boxes = computed(() =>
    annotations.value.filter((a): a is BoxAnnotation => a.type === 'box')
  );

  const selectedAnnotation = computed(
    () => annotations.value.find((a) => a.id === selectedId.value) ?? null
  );

  const currentKeyframe = computed(() => keyframes.value.get(currentIndex.value) ?? null);

  const isManualKeyframe = computed(() => currentKeyframe.value?.manual === true);

  const hasVolume = computed(() => volumeId.value !== null);

  const manualKeyframes = computed(() =>
    sortBy(
      Array.from(keyframes.value.entries())
        .filter(([, kf]) => kf.manual)
        .map(([idx, kf]) => ({
          index: idx,
          annotationCount: kf.annotations.length,
          hasMask: kf.rawMaskHash !== null,
          maskVisible: kf.maskVisible,
        })),
      [(e) => e.index]
    )
  );

  const annotatedSlices = computed(() => {
    const seen = new Set<number>();
    return sortBy(
      [
        ...Array.from(keyframes.value.entries())
          .filter(([idx, kf]) => {
            if (!kf.manual && kf.annotations.length > 0) {
              seen.add(idx);
              return true;
            }
            return false;
          })
          .map(([idx, kf]) => ({
            index: idx,
            annotationCount: kf.annotations.length,
            hasMask: kf.rawMaskHash !== null,
          })),
        // Only add current slice's local annotations if:
        // 1. It has annotations
        // 2. It's not already in the seen set (from non-manual keyframes)
        // 3. It's not a manual keyframe
        ...(annotations.value.length > 0 &&
        !seen.has(currentIndex.value) &&
        !keyframes.value.get(currentIndex.value)?.manual
          ? [
              {
                index: currentIndex.value,
                annotationCount: annotations.value.length,
                hasMask: false,
              },
            ]
          : []),
      ],
      [(e) => e.index]
    );
  });

  const canRecognize = computed(() => {
    if (!volumeId.value) return false;
    if (annotations.value.length > 0) return true;
    // Check if any previous slice has a mask
    for (let i = currentIndex.value - 1; i >= 0; i--) {
      if (keyframes.value.get(i)?.rawMaskHash) return true;
    }
    return false;
  });

  // ─── Actions: Volume ───────────────────────────────
  async function openVolume() {
    if (!filePath.value) return;

    const { x, y, z, dtype, endian, axis } = volumeConfig.value;
    await logMessage('info', `[volume] open ${filePath.value} shape=${x}x${y}x${z} dtype=${dtype}`);
    const resp: RawOpenResponse = await rawOpen({
      path: filePath.value,
      x,
      y,
      z,
      dtype,
      endian,
      axis,
    });

    volumeId.value = resp.volumeId;
    volumeInfo.value = {
      totalSlices: resp.totalSlices,
      sliceWidth: resp.sliceWidth,
      sliceHeight: resp.sliceHeight,
    };
    currentIndex.value = 0;
    keyframes.value.clear();
    annotations.value = [];
    selectedId.value = null;
    sliceImageUrl.value = null;

    await loadSlice(0);
    await logMessage(
      'info',
      `[volume] opened volumeId=${resp.volumeId} slices=${resp.totalSlices} size=${resp.sliceWidth}x${resp.sliceHeight}`
    );
  }

  async function loadSlice(index: number) {
    if (!volumeId.value) return;
    if (index < 0 || index >= volumeInfo.value.totalSlices) return;

    // Save current annotations before navigating away
    saveCurrentAnnotations();

    isLoadingSlice.value = true;
    try {
      currentIndex.value = index;
      const resp = await rawSlice(volumeId.value, index);

      // Convert bytes to data URL via offscreen canvas
      const canvas = document.createElement('canvas');
      canvas.width = resp.width;
      canvas.height = resp.height;
      const ctx = canvas.getContext('2d')!;
      const imageData = ctx.createImageData(resp.width, resp.height);

      for (let i = 0; i < resp.data.length; i++) {
        const idx = i * 4;
        imageData.data[idx] = resp.data[i];
        imageData.data[idx + 1] = resp.data[i];
        imageData.data[idx + 2] = resp.data[i];
        imageData.data[idx + 3] = 255;
      }

      ctx.putImageData(imageData, 0, 0);
      sliceImageUrl.value = canvas.toDataURL();
      sliceMin.value = resp.min;
      sliceMax.value = resp.max;

      // Restore annotations and mask from keyframe if exists
      const kf = keyframes.value.get(index);
      currentMaskUrl.value = kf?.maskUrl ?? null;
      if (kf) {
        annotations.value = cloneDeep(kf.annotations);
      } else {
        annotations.value = [];
      }
      selectedId.value = null;
    } finally {
      isLoadingSlice.value = false;
    }
  }

  // ─── Actions: Keyframes ────────────────────────────
  function saveCurrentAnnotations() {
    if (annotations.value.length === 0) return;
    const idx = currentIndex.value;
    const kf = keyframes.value.get(idx);
    if (kf) {
      kf.annotations = [...annotations.value];
    } else {
      keyframes.value.set(idx, {
        annotations: [...annotations.value],
        maskUrl: null,
        maskVisible: true,
        rawMaskHash: null,
        manual: false,
      });
    }
    cloneKeyframes();
  }

  function toggleKeyframe() {
    const idx = currentIndex.value;
    if (keyframes.value.has(idx)) {
      keyframes.value.delete(idx);
      cloneKeyframes();
    } else {
      keyframes.value.set(idx, {
        annotations: [...annotations.value],
        maskUrl: null,
        maskVisible: true,
        rawMaskHash: null,
        manual: true,
      });
      cloneKeyframes();
    }
  }

  function removeKeyframe(index: number) {
    keyframes.value.delete(index);
    cloneKeyframes();
    // If we're on the deleted keyframe, clear annotations
    if (currentIndex.value === index) {
      annotations.value = [];
    }
  }

  function jumpToKeyframe(index: number) {
    // Save current annotations to current keyframe before navigating
    saveCurrentAnnotations();
    loadSlice(index);
  }

  function toggleMaskVisible(index: number) {
    const kf = keyframes.value.get(index);
    if (kf) {
      kf.maskVisible = !kf.maskVisible;
      cloneKeyframes();
    }
  }

  // ─── Actions: Annotations ──────────────────────────
  const sharedActions = createAnnotationActions({
    mode,
    tool,
    annotations,
    selectedId,
    stageScale,
    stagePos,
  });

  function addAnnotation(annotation: Annotation) {
    if (!volumeId.value) return;
    annotations.value.push(annotation);
    const kf = keyframes.value.get(currentIndex.value);
    if (kf) {
      kf.annotations = [...annotations.value];
      cloneKeyframes();
    }
  }

  function clearAnnotations() {
    annotations.value = [];
    selectedId.value = null;
  }

  // ─── Actions: Export ───────────────────────────────
  async function exportMaskVolume() {
    if (!volumeId.value) return;

    const { save } = await import('@tauri-apps/plugin-dialog');
    const outputPath = await save({
      filters: [{ name: 'Raw', extensions: ['raw'] }],
    });
    if (!outputPath) return;

    const masks = sortBy(
      Array.from(keyframes.value.entries())
        .filter(([, kf]) => kf.rawMaskHash !== null)
        .map(([idx, kf]) => ({
          index: idx,
          maskPngPath: kf.rawMaskHash!,
        })),
      [(m) => m.index]
    );

    if (masks.length === 0) return;

    await logMessage('info', `[export] ${masks.length} masks to ${outputPath}`);
    await rawExportMasks(volumeId.value, masks, outputPath);
    await logMessage('info', `[export] done`);
  }

  return {
    // Volume config
    filePath,
    volumeConfig,
    // Volume handle
    volumeId,
    volumeInfo,
    // Current view
    currentIndex,
    sliceImageUrl,
    currentMaskUrl,
    sliceMin,
    sliceMax,
    isLoadingSlice,
    // Keyframes
    keyframes,
    currentKeyframe,
    isManualKeyframe,
    manualKeyframes,
    annotatedSlices,
    hasVolume,
    canRecognize,
    // Canvas state
    mode,
    tool,
    annotations,
    selectedId,
    stageScale,
    stagePos,
    // Mask settings
    maskSettings,
    cursorImagePos,
    // Fit image trigger
    fitImageTrigger,
    // Computed
    positivePoints,
    negativePoints,
    boxes,
    selectedAnnotation,
    // Actions
    openVolume,
    loadSlice,
    toggleKeyframe,
    removeKeyframe,
    jumpToKeyframe,
    toggleMaskVisible,
    ...sharedActions,
    addAnnotation,
    clearAnnotations,
    // Recognition (from composable)
    isRecognizing: recognize.isRecognizing,
    recognitionProgress: recognize.progress,
    stopRecognition: recognize.stopRecognition,
    recognizeCurrentSlice: recognize.recognizeCurrentSlice,
    batchProcessKeyframes: recognize.batchProcessKeyframes,
    recognizeAllSlices: recognize.recognizeAllSlices,
    exportMaskVolume,
  };
});
