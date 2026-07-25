import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import { cloneDeep, sortBy, debounce } from 'es-toolkit';
import { useExtractedObservable } from '@vueuse/rxjs';
import { liveQuery } from 'dexie';
import { from } from 'rxjs';
import { rawOpen, rawSlice, rawExportMasks, type RawOpenResponse } from '@/services/raw3d';
import { logMessage } from '@/services/cmd';
import {
  getKeyframe,
  putKeyframe,
  deleteKeyframe,
  getKeyframesByVolume,
  deleteKeyframesByVolume,
  toggleMaskVisible as toggleMaskVisibleRepo,
} from '@/db/keyframe-repo';
import type { SliceSummary } from '@/schemas/keyframe';
import type { VolumeConfig, VolumeInfo } from '@/schemas/volume';
import type { useCanvasStore } from '@/stores/canvas';

export const useLabel3dStore = (id: string, canvas: ReturnType<typeof useCanvasStore>) =>
  defineStore(`label-3d-${id}`, () => {
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

    // ─── Keyframes (Dexie-backed) ──────────────────────
    const batchRange = ref<{ start: number; end: number }>({ start: 0, end: 0 });

    const sliceSummaries = useExtractedObservable(
      volumeId,
      (volId) =>
        from(
          liveQuery(async () => {
            if (!volId) return [] as SliceSummary[];
            const rows = await getKeyframesByVolume(volId);
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

    // ─── Computed ──────────────────────────────────────
    const hasVolume = computed(() => volumeId.value !== null);

    const currentKeyframeSummary = computed(
      () => (sliceSummaries.value ?? []).find((s) => s.sliceIndex === currentIndex.value) ?? null
    );

    const allSlices = computed(
      (): Array<{
        index: number;
        annotationCount: number;
        hasMask: boolean;
        maskVisible: boolean;
      }> => {
        const entries = (sliceSummaries.value ?? []).map((s) => ({
          index: s.sliceIndex,
          annotationCount: s.annotationCount,
          hasMask: s.hasMask,
          maskVisible: s.maskVisible,
        }));

        if (
          canvas.allAnnotations.length > 0 &&
          !(sliceSummaries.value ?? []).some((s) => s.sliceIndex === currentIndex.value)
        ) {
          entries.push({
            index: currentIndex.value,
            annotationCount: canvas.allAnnotations.length,
            hasMask: false,
            maskVisible: true,
          });
        }

        return sortBy(entries, [(e) => e.index]);
      }
    );

    const canRecognize = computed(() => {
      if (!volumeId.value) return false;
      if (canvas.allAnnotations.length > 0) return true;
      return (sliceSummaries.value ?? []).some(
        (s) => s.sliceIndex < currentIndex.value && s.hasMask
      );
    });

    // ─── Actions: Volume ───────────────────────────────
    async function openVolume() {
      if (!filePath.value) return;

      const oldVolId = volumeId.value;

      const { x, y, z, dtype, endian, axis } = volumeConfig.value;
      await logMessage(
        'info',
        `[volume] open ${filePath.value} shape=${x}x${y}x${z} dtype=${dtype}`
      );
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
          await deleteKeyframesByVolume(oldVolId);
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
      canvas.clearObjects();
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
        const offscreen = document.createElement('canvas');
        offscreen.width = resp.width;
        offscreen.height = resp.height;
        const ctx = offscreen.getContext('2d')!;
        const imageData = ctx.createImageData(resp.width, resp.height);

        for (let i = 0; i < resp.data.length; i++) {
          const idx = i * 4;
          imageData.data[idx] = resp.data[i];
          imageData.data[idx + 1] = resp.data[i];
          imageData.data[idx + 2] = resp.data[i];
          imageData.data[idx + 3] = 255;
        }

        ctx.putImageData(imageData, 0, 0);
        sliceImageUrl.value = offscreen.toDataURL();
        sliceMin.value = resp.min;
        sliceMax.value = resp.max;

        // Restore objects from keyframe if exists
        const kf = await getKeyframe(volumeId.value, index);
        if (kf) {
          canvas.objects = cloneDeep(kf.objects);
          // Migrate old-format objects (name → labelId)
          const { migrateObjects } = await import('@/composables/useLabelMigration');
          const didMigrate = await migrateObjects(canvas.objects);
          if (didMigrate) {
            await saveObjectsToIdb(index);
          }
          canvas.selectedObjectId = null;
          canvas.selectedAnnotationId = null;
          canvas.currentObjectId = null;
          await logMessage('debug', `[keyframe-db] loaded slice=${index} from IDB`);
        } else {
          canvas.clearObjects();
        }
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

      const annCount = canvas.objects.reduce((sum, o) => sum + o.points.length + o.boxes.length, 0);

      try {
        if (canvas.objects.length === 0 || annCount === 0) {
          await deleteKeyframe(volId, sliceIndex);
        } else {
          await putKeyframe(volId, sliceIndex, {
            objects: cloneDeep(canvas.objects),
          });
        }
        await logMessage(
          'debug',
          `[keyframe-db] saved slice=${sliceIndex} objects=${canvas.objects.length} annCount=${annCount}`
        );
      } catch (e) {
        await logMessage(
          'error',
          `[keyframe-db] saveObjectsToIdb failed slice=${sliceIndex}: ${e}`
        );
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
      () => canvas.objects,
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

      try {
        await deleteKeyframe(volId, index);
      } catch {
        // error already logged by deleteKeyframe
      }
      if (currentIndex.value === index) {
        canvas.objects = [];
        canvas.currentObjectId = null;
      }
    }

    async function jumpToKeyframe(index: number) {
      await flushPendingSave();
      await loadSlice(index);
    }

    async function toggleMaskVisible(index: number) {
      const volId = volumeId.value;
      if (!volId) return;
      await toggleMaskVisibleRepo(volId, index);
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

      const rows = await getKeyframesByVolume(volId);
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
      // Actions
      openVolume,
      loadSlice,
      removeKeyframe,
      jumpToKeyframe,
      toggleMaskVisible,
      exportMaskVolume,
    };
  })();
