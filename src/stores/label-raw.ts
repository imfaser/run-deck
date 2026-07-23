import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import { cloneDeep, sortBy, debounce } from 'es-toolkit';
import { useExtractedObservable } from '@vueuse/rxjs';
import { liveQuery } from 'dexie';
import { from } from 'rxjs';
import { rawOpen, rawSlice, rawExportMasks, type RawOpenResponse } from '@/services/raw3d';
import { logMessage } from '@/services/cmd';
import { useRawRecognize } from '@/composables/useRawRecognize';
import { useMaskRenderer } from '@/composables/useMaskRenderer';
import { createAnnotationActions } from '@/stores/shared/annotation-actions';
import { db, type SliceSummary } from '@/db/label-raw-db';

interface SliceEntry {
  index: number;
  annotationCount: number;
  hasMask: boolean;
  maskVisible: boolean;
}

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
  showPrevMask: boolean;
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

  // ─── Keyframes (Dexie-backed) ──────────────────────
  const batchRange = ref<{ start: number; end: number }>({ start: 0, end: 0 });

  const sliceSummaries = useExtractedObservable(
    volumeId,
    (volId) =>
      from(
        liveQuery(async () => {
          if (!volId) return [] as SliceSummary[];
          const rows = await db.keyframes.where('volumeId').equals(volId).toArray();
          return rows.map((r) => ({
            sliceIndex: r.sliceIndex,
            annotationCount: r.objects.reduce((s, o) => s + o.points.length + o.boxes.length, 0),
            hasMask: r.rawMaskHash !== null,
            maskVisible: r.maskVisible,
          }));
        })
      ),
    { initialValue: [] as SliceSummary[] }
  );

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
  const maskSettings = ref<MaskSettings>({
    color: '#0096ff',
    opacity: 0.6,
    threshold: 128,
    showPrevMask: true,
  });
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

  // ─── Dexie helpers for useRawRecognize ─────────────
  async function getKeyframe(volId: string, idx: number) {
    try {
      return await db.keyframes.where('[volumeId+sliceIndex]').equals([volId, idx]).first();
    } catch (e) {
      await logMessage(
        'error',
        `[keyframe-db] getKeyframe failed volId=${volId} slice=${idx}: ${e}`
      );
      return undefined;
    }
  }

  async function putKeyframe(volId: string, sliceIndex: number, data: Partial<Keyframe>) {
    try {
      const existing = await getKeyframe(volId, sliceIndex);
      if (existing?.id) {
        await db.keyframes.update(existing.id, data);
        await logMessage(
          'debug',
          `[keyframe-db] updated slice=${sliceIndex} fields=${Object.keys(data).join(',')}`
        );
      } else {
        await db.keyframes.put({
          volumeId: volId,
          sliceIndex,
          objects: data.objects ?? [],
          maskUrl: data.maskUrl ?? null,
          maskVisible: data.maskVisible ?? true,
          rawMaskHash: data.rawMaskHash ?? null,
        });
        await logMessage('debug', `[keyframe-db] created slice=${sliceIndex}`);
      }
    } catch (e) {
      await logMessage('error', `[keyframe-db] putKeyframe failed slice=${sliceIndex}: ${e}`);
      throw e;
    }
  }

  // ─── Recognition composable ────────────────────────
  const recognize = useRawRecognize({
    volumeId,
    getKeyframe,
    putKeyframe,
    objects,
    currentIndex,
    totalSlices: computed(() => volumeInfo.value.totalSlices),
    currentMaskUrl,
    confidenceThreshold: computed(() => maskSettings.value.threshold),
    maskColor: computed(() => maskSettings.value.color),
  });

  const currentKeyframeSummary = computed(
    () => (sliceSummaries.value ?? []).find((s) => s.sliceIndex === currentIndex.value) ?? null
  );

  async function renderCurrentMask() {
    const volId = volumeId.value;
    if (!volId) return;
    try {
      const kf = await getKeyframe(volId, currentIndex.value);
      if (!kf?.rawMaskHash) {
        if (maskSettings.value.showPrevMask) {
          // Fallback to nearest previous slice's mask
          for (let i = currentIndex.value - 1; i >= 0; i--) {
            const prevKf = await getKeyframe(volId, i);
            if (prevKf?.rawMaskHash) {
              const { renderMask } = useMaskRenderer();
              currentMaskUrl.value = await renderMask(
                prevKf.rawMaskHash,
                maskSettings.value.threshold,
                maskSettings.value.color
              );
              return;
            }
          }
        }
        currentMaskUrl.value = null;
        return;
      }
      const { renderMask } = useMaskRenderer();
      const maskUrl = await renderMask(
        kf.rawMaskHash,
        maskSettings.value.threshold,
        maskSettings.value.color
      );
      await putKeyframe(volId, currentIndex.value, { maskUrl });
      currentMaskUrl.value = maskUrl;
    } catch (e) {
      await logMessage(
        'error',
        `[mask-render] renderCurrentMask failed slice=${currentIndex.value}: ${e}`
      );
    }
  }

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

  const hasVolume = computed(() => volumeId.value !== null);

  const allSlices = computed((): SliceEntry[] => {
    const entries = (sliceSummaries.value ?? []).map((s) => ({
      index: s.sliceIndex,
      annotationCount: s.annotationCount,
      hasMask: s.hasMask,
      maskVisible: s.maskVisible,
    }));

    if (
      allAnnotations.value.length > 0 &&
      !(sliceSummaries.value ?? []).some((s) => s.sliceIndex === currentIndex.value)
    ) {
      entries.push({
        index: currentIndex.value,
        annotationCount: allAnnotations.value.length,
        hasMask: false,
        maskVisible: true,
      });
    }

    return sortBy(entries, [(e) => e.index]);
  });

  const canRecognize = computed(() => {
    if (!volumeId.value) return false;
    if (allAnnotations.value.length > 0) return true;
    return (sliceSummaries.value ?? []).some((s) => s.sliceIndex < currentIndex.value && s.hasMask);
  });

  // ─── Actions: Volume ───────────────────────────────
  async function openVolume() {
    if (!filePath.value) return;

    const oldVolId = volumeId.value;

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

    // Clear old volume's keyframes from IDB
    if (oldVolId) {
      try {
        await db.keyframes.where('volumeId').equals(oldVolId).delete();
        await logMessage('debug', `[keyframe-db] cleared keyframes for old volume=${oldVolId}`);
      } catch (e) {
        await logMessage(
          'warn',
          `[keyframe-db] failed to clear old keyframes volId=${oldVolId}: ${e}`
        );
      }
    }

    volumeId.value = resp.volumeId;
    volumeInfo.value = {
      totalSlices: resp.totalSlices,
      sliceWidth: resp.sliceWidth,
      sliceHeight: resp.sliceHeight,
    };
    currentIndex.value = 0;
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

    await flushPendingSave();

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
      const kf = await getKeyframe(volumeId.value, index);
      if (kf?.maskUrl) {
        currentMaskUrl.value = kf.maskUrl;
      } else if (maskSettings.value.showPrevMask && kf?.rawMaskHash) {
        // Current slice has rawMaskHash but no rendered maskUrl — render it
        const { useMaskRenderer } = await import('@/composables/useMaskRenderer');
        const { renderMask } = useMaskRenderer();
        currentMaskUrl.value = await renderMask(
          kf.rawMaskHash,
          maskSettings.value.threshold,
          maskSettings.value.color
        );
      } else if (maskSettings.value.showPrevMask) {
        // Fallback to nearest previous slice's mask
        let prevMaskUrl: string | null = null;
        for (let i = index - 1; i >= 0; i--) {
          const prevKf = await getKeyframe(volumeId.value, i);
          if (prevKf?.rawMaskHash) {
            const { useMaskRenderer } = await import('@/composables/useMaskRenderer');
            const { renderMask } = useMaskRenderer();
            prevMaskUrl = await renderMask(
              prevKf.rawMaskHash,
              maskSettings.value.threshold,
              maskSettings.value.color
            );
            break;
          }
        }
        currentMaskUrl.value = prevMaskUrl;
      } else {
        currentMaskUrl.value = null;
      }
      if (kf) {
        objects.value = cloneDeep(kf.objects);
        await logMessage('debug', `[keyframe-db] loaded slice=${index} from IDB`);
      } else {
        objects.value = [];
      }
      selectedObjectId.value = null;
      selectedAnnotationId.value = null;
      currentObjectId.value = null;
    } catch (e) {
      await logMessage('error', `[slice] loadSlice failed index=${index}: ${e}`);
    } finally {
      isLoadingSlice.value = false;
    }
  }

  // ─── Actions: Keyframes ────────────────────────────
  async function saveObjectsToIdb(sliceIndex: number) {
    const volId = volumeId.value;
    if (!volId) return;

    const annCount = objects.value.reduce((sum, o) => sum + o.points.length + o.boxes.length, 0);

    try {
      if (objects.value.length === 0 || annCount === 0) {
        const kf = await getKeyframe(volId, sliceIndex);
        if (kf?.id) {
          await db.keyframes.delete(kf.id);
          await logMessage('debug', `[keyframe-db] removed slice=${sliceIndex}`);
        }
      } else {
        await putKeyframe(volId, sliceIndex, {
          objects: cloneDeep(objects.value),
        });
      }
      await logMessage(
        'debug',
        `[keyframe-db] saved slice=${sliceIndex} objects=${objects.value.length} annCount=${annCount}`
      );
    } catch (e) {
      await logMessage('error', `[keyframe-db] saveObjectsToIdb failed slice=${sliceIndex}: ${e}`);
    }
  }

  let pendingSliceIndex: number | null = null;
  const debouncedSave = debounce(async () => {
    if (pendingSliceIndex === null) return;
    const idx = pendingSliceIndex;
    pendingSliceIndex = null;
    await saveObjectsToIdb(idx);
  }, 500);

  watch(
    objects,
    () => {
      if (isLoadingSlice.value) return;
      pendingSliceIndex = currentIndex.value;
      debouncedSave();
    },
    { deep: true }
  );

  async function flushPendingSave() {
    debouncedSave.cancel();
    if (pendingSliceIndex !== null) {
      const idx = pendingSliceIndex;
      pendingSliceIndex = null;
      await saveObjectsToIdb(idx);
    }
  }

  async function removeKeyframe(index: number) {
    const volId = volumeId.value;
    if (!volId) return;

    const kf = await getKeyframe(volId, index);
    if (kf?.id) {
      try {
        await db.keyframes.delete(kf.id);
        await logMessage('debug', `[keyframe-db] removed slice=${index}`);
      } catch (e) {
        await logMessage('error', `[keyframe-db] removeKeyframe failed slice=${index}: ${e}`);
      }
    }
    if (currentIndex.value === index) {
      objects.value = [];
      currentObjectId.value = null;
    }
  }

  async function jumpToKeyframe(index: number) {
    await flushPendingSave();
    await loadSlice(index);
  }

  async function toggleMaskVisible(index: number) {
    const volId = volumeId.value;
    if (!volId) return;

    const kf = await getKeyframe(volId, index);
    if (kf?.id) {
      try {
        await db.keyframes.update(kf.id, { maskVisible: !kf.maskVisible });
        await logMessage(
          'debug',
          `[keyframe-db] toggleMaskVisible slice=${index} -> ${!kf.maskVisible}`
        );
      } catch (e) {
        await logMessage('error', `[keyframe-db] toggleMaskVisible failed slice=${index}: ${e}`);
      }
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
    const volId = volumeId.value;
    if (!volId) return;

    const { save } = await import('@tauri-apps/plugin-dialog');
    const outputPath = await save({
      filters: [{ name: 'Raw', extensions: ['raw'] }],
    });
    if (!outputPath) return;

    const rows = await db.keyframes.where('volumeId').equals(volId).toArray();
    await logMessage(
      'debug',
      `[export] queried ${rows.length} keyframes from IDB for volId=${volId}`
    );

    const masks = sortBy(
      rows
        .filter((r) => r.rawMaskHash !== null)
        .map((r) => ({
          index: r.sliceIndex,
          maskPngPath: r.rawMaskHash!,
        })),
      [(m) => m.index]
    );

    if (masks.length === 0) return;

    await logMessage('info', `[export] ${masks.length} masks to ${outputPath}`);
    await rawExportMasks(volId, masks, outputPath);
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
    sliceSummaries,
    currentKeyframeSummary,
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
    renderCurrentMask,
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
