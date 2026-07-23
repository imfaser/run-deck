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
  AnnotationObject,
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
  objects: AnnotationObject[];
  maskUrl: string | null;
  maskVisible: boolean;
  rawMaskHash: string | null;
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
  const batchRange = ref<{ start: number; end: number }>({ start: 0, end: 0 });

  function cloneKeyframes() {
    keyframes.value = new Map(keyframes.value);
  }

  // ─── Canvas state ──────────────────────────────────
  const mode = ref<LabelMode>('create');
  const tool = ref<AnnotationType>('p_point');
  const objects = ref<AnnotationObject[]>([]);
  const selectedObjectId = ref<string | null>(null);
  const selectedAnnotationId = ref<string | null>(null);
  const currentObjectId = ref<string | null>(null);
  const stageScale = ref(1);
  const stagePos = ref({ x: 0, y: 0 });
  const imageWidth = ref(0);
  const imageHeight = ref(0);

  // ─── Mask settings ─────────────────────────────────
  const maskSettings = ref<MaskSettings>({ color: '#0096ff', opacity: 0.6, threshold: 128 });
  const cursorImagePos = ref<{ x: number; y: number } | null>(null);
  const cursorScreenPos = ref<{ x: number; y: number } | null>(null);

  // ─── Fit image trigger ─────────────────────────────
  const fitImageTrigger = ref(0);

  // ─── Name dialog ───────────────────────────────────
  const showNameDialog = ref(false);
  const pendingAnnotation = ref<
    | { type: 'point'; point: PointAnnotation }
    | {
        type: 'box';
        box: BoxAnnotation;
      }
    | null
  >(null);

  // ─── Select dialog ─────────────────────────────────
  const showSelectDialog = ref(false);

  // ─── Recognition composable ────────────────────────
  const recognize = useRawRecognize({
    volumeId,
    keyframes,
    objects,
    currentIndex,
    totalSlices: computed(() => volumeInfo.value.totalSlices),
    currentMaskUrl,
    confidenceThreshold: computed(() => maskSettings.value.threshold),
    maskColor: computed(() => maskSettings.value.color),
    cloneKeyframes,
  });

  // ─── Computed ──────────────────────────────────────
  const currentObject = computed(
    () => objects.value.find((o) => o.id === currentObjectId.value) ?? null
  );

  const allPoints = computed(() => objects.value.flatMap((o) => o.points));

  const allBoxes = computed(() => objects.value.flatMap((o) => o.boxes));

  const allAnnotations = computed(() => [...allPoints.value, ...allBoxes.value]);

  const selectedAnnotation = computed(() => {
    const id = selectedAnnotationId.value;
    if (!id) return null;
    for (const obj of objects.value) {
      const point = obj.points.find((p) => p.id === id);
      if (point) return point;
      const box = obj.boxes.find((b) => b.id === id);
      if (box) return box;
    }
    return null;
  });

  const currentKeyframe = computed(() => keyframes.value.get(currentIndex.value) ?? null);

  const hasVolume = computed(() => volumeId.value !== null);

  const allSlices = computed(() =>
    sortBy(
      [
        ...Array.from(keyframes.value.entries()).map(([idx, kf]) => ({
          index: idx,
          annotationCount: kf.objects.reduce((sum, o) => sum + o.points.length + o.boxes.length, 0),
          hasMask: kf.rawMaskHash !== null,
          maskVisible: kf.maskVisible,
        })),
        ...(allAnnotations.value.length > 0 && !keyframes.value.has(currentIndex.value)
          ? [
              {
                index: currentIndex.value,
                annotationCount: allAnnotations.value.length,
                hasMask: false,
                maskVisible: true,
              },
            ]
          : []),
      ],
      [(e) => e.index]
    )
  );

  const canRecognize = computed(() => {
    if (!volumeId.value) return false;
    if (allAnnotations.value.length > 0) return true;
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
    batchRange.value = { start: 0, end: resp.totalSlices - 1 };
    objects.value = [];
    selectedObjectId.value = null;
    selectedAnnotationId.value = null;
    currentObjectId.value = null;
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

    // Save current objects before navigating away
    saveCurrentObjects();

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

      // Restore objects and mask from keyframe if exists
      const kf = keyframes.value.get(index);
      currentMaskUrl.value = kf?.maskUrl ?? null;
      if (kf) {
        objects.value = cloneDeep(kf.objects);
      } else {
        objects.value = [];
      }
      selectedObjectId.value = null;
      selectedAnnotationId.value = null;
      currentObjectId.value = null;
    } finally {
      isLoadingSlice.value = false;
    }
  }

  // ─── Actions: Keyframes ────────────────────────────
  function saveCurrentObjects() {
    if (objects.value.length === 0) return;
    const annCount = objects.value.reduce((sum, o) => sum + o.points.length + o.boxes.length, 0);
    if (annCount === 0) return;
    const idx = currentIndex.value;
    const kf = keyframes.value.get(idx);
    if (kf) {
      kf.objects = cloneDeep(objects.value);
    } else {
      keyframes.value.set(idx, {
        objects: cloneDeep(objects.value),
        maskUrl: null,
        maskVisible: true,
        rawMaskHash: null,
      });
    }
    cloneKeyframes();
  }

  function removeKeyframe(index: number) {
    keyframes.value.delete(index);
    cloneKeyframes();
    if (currentIndex.value === index) {
      objects.value = [];
      currentObjectId.value = null;
    }
  }

  function jumpToKeyframe(index: number) {
    saveCurrentObjects();
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
    objects,
    selectedObjectId,
    selectedAnnotationId,
    currentObjectId,
    stageScale,
    stagePos,
  });

  function clearObjects() {
    objects.value = [];
    selectedObjectId.value = null;
    selectedAnnotationId.value = null;
    currentObjectId.value = null;
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
    batchRange,
    allSlices,
    hasVolume,
    canRecognize,
    // Canvas state
    mode,
    tool,
    objects,
    selectedObjectId,
    selectedAnnotationId,
    currentObjectId,
    stageScale,
    stagePos,
    imageWidth,
    imageHeight,
    // Mask settings
    maskSettings,
    cursorImagePos,
    cursorScreenPos,
    // Fit image trigger
    fitImageTrigger,
    // Name dialog
    showNameDialog,
    pendingAnnotation,
    showSelectDialog,
    // Computed
    currentObject,
    allPoints,
    allBoxes,
    allAnnotations,
    selectedAnnotation,
    // Actions
    openVolume,
    loadSlice,
    removeKeyframe,
    jumpToKeyframe,
    toggleMaskVisible,
    ...sharedActions,
    clearObjects,
    // Recognition (from composable)
    isRecognizing: recognize.isRecognizing,
    recognitionProgress: recognize.progress,
    stopRecognition: recognize.stopRecognition,
    recognizeCurrentSlice: recognize.recognizeCurrentSlice,
    batchRecognize: recognize.batchRecognize,
    exportMaskVolume,
  };
});
