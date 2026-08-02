import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { mutate } from 'swr';
import { toast } from 'sonner';
import {
  openRaw,
  rawSlice,
  dbUpsertImage,
  dbSetAnnotations,
  dbListAnnotationsByImage,
  dbGetImageByHash,
  logMessage,
} from '@/services/cmds';
import { useLabel3DCanvasStore } from '@/store/label-3d-canvas';
import { dbAnnotationsToObjects, objectsToDbAnnotations } from '@/lib/annotationMapping';
import { LABELS } from '@/constants/labels';
import type { OpenVolumeInput, OpenVolumeResponse, VolumeConfig } from '@/schemas/volume';
import type { ImageType } from '@/schemas/image';

/** 灰度数据 → dataURL（Uint8ClampedArray 转 offscreen canvas）。 */
function grayscaleToDataUrl(data: number[], width: number, height: number): string {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('failed to get 2d context');
  }
  const imgData = ctx.createImageData(width, height);
  for (let i = 0; i < data.length; i++) {
    const v = data[i];
    imgData.data[i * 4] = v;
    imgData.data[i * 4 + 1] = v;
    imgData.data[i * 4 + 2] = v;
    imgData.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(imgData, 0, 0);
  return canvas.toDataURL('image/png');
}

export type DirtyConfirmChoice = 'save' | 'discard' | null;

export interface Label3DVolumeState {
  volume: OpenVolumeResponse | null;
  currentIndex: number;
  currentImageHash: string | null;
  currentMaskHash: string | null;
  sliceImageUrl: string | null;
  isLoadingSlice: boolean;
  isSaving: boolean;
  dirtyConfirm: DirtyConfirmChoice;
  /** 脏确认后待跳转的目标切片索引。 */
  pendingIndex: number | null;
  /** 删除非当前切片时挂起的目标索引：切片加载完成后清空并保存。 */
  pendingDeleteIndex: number | null;

  openVolume: (config: VolumeConfig, path: string) => Promise<OpenVolumeResponse | null>;
  loadSliceByIndex: (index: number) => Promise<void>;
  saveCurrent: () => Promise<boolean>;
  saveEmptyForHash: (hash: string, index: number) => Promise<void>;
  setCurrentMaskHash: (hash: string | null) => void;
  requestLoadSlice: (index: number) => void;
  applyPendingLoad: () => void;
  confirmSave: () => Promise<void>;
  confirmDiscard: () => void;
  cancelDirty: () => void;
  confirmDirty: (choice: 'save' | 'discard') => void;
  deleteSlice: (index: number) => Promise<void>;
}

export const useLabel3DVolumeStore = create<Label3DVolumeState>()(
  immer((set, get) => ({
    volume: null,
    currentIndex: 0,
    currentImageHash: null,
    currentMaskHash: null,
    sliceImageUrl: null,
    isLoadingSlice: false,
    isSaving: false,
    dirtyConfirm: null,
    pendingIndex: null,
    pendingDeleteIndex: null,

    loadSliceByIndex: async (index) => {
      const volume = get().volume;
      if (!volume) {
        return;
      }
      set((s) => {
        s.isLoadingSlice = true;
      });
      try {
        const slice = await rawSlice(volume.volumeId, index);
        const dataUrl = grayscaleToDataUrl(slice.data, slice.width, slice.height);
        // 读走 SWR：先落缓存（不重新请求），再供画布消费，
        // 保证 useSliceAnnotations 与画布工作副本一致
        const annotations = await dbListAnnotationsByImage(slice.imageHash);
        const image = await dbGetImageByHash(slice.imageHash);
        await mutate(['slice-annotations', slice.imageHash], annotations, { revalidate: false });
        const canvas = useLabel3DCanvasStore.getState();
        canvas.loadObjects(dbAnnotationsToObjects(annotations));
        canvas.setImageDimensions(slice.width, slice.height);
        canvas.resetCanvas();
        canvas.setPendingAnnotation(null);
        set((s) => {
          s.currentIndex = index;
          s.currentImageHash = slice.imageHash;
          s.currentMaskHash = image?.mask_hash ?? null;
          s.sliceImageUrl = dataUrl;
          s.isLoadingSlice = false;
        });
        await logMessage(
          'info',
          `[volume] loaded slice ${index} hash=${slice.imageHash} anns=${annotations.length}`
        );
        // 挂起的删除：切片加载完成后清空该切片标注
        if (get().pendingDeleteIndex === index) {
          set((s) => {
            s.pendingDeleteIndex = null;
          });
          await get().saveEmptyForHash(slice.imageHash, index);
        }
      } catch (e) {
        set((s) => {
          s.isLoadingSlice = false;
        });
        await logMessage('error', `[slice] load slice ${index} failed: ${e}`);
        toast.error(LABELS.label3d.sliceLoadFailed(index));
      }
    },

    openVolume: async (config, path) => {
      if (get().isLoadingSlice) {
        return null;
      }
      const input: OpenVolumeInput = { path, ...config };
      try {
        const res = await openRaw(input);
        set((s) => {
          s.volume = res;
          s.currentIndex = 0;
          s.currentImageHash = null;
          s.currentMaskHash = null;
          s.sliceImageUrl = null;
        });
        await logMessage(
          'info',
          `[volume] opened ${path} id=${res.volumeId} slices=${res.totalSlices}`
        );
        useLabel3DCanvasStore.getState().loadObjects([]);
        await get().loadSliceByIndex(0);
        return res;
      } catch (e) {
        await logMessage('error', `[volume] open failed: ${e}`);
        toast.error(LABELS.label3d.openFailed(e));
        return null;
      }
    },

    setCurrentMaskHash: (hash) => {
      set((s) => {
        s.currentMaskHash = hash;
      });
    },

    saveEmptyForHash: async (hash, index) => {
      await dbSetAnnotations(hash, []);
      // 后端同步走 SWR：清 annotation 缓存 + 刷新切片计数
      await mutate(['slice-annotations', hash], [], { revalidate: false });
      useLabel3DCanvasStore.getState().loadObjects([]);
      await logMessage('info', `[delete] slice ${index} hash=${hash} cleared`);
      toast.success(LABELS.label3d.sliceCleared(index));
      const volume = get().volume;
      if (volume) {
        await mutate(['slice-summaries', volume.volumeId]);
      }
    },

    saveCurrent: async () => {
      if (get().isSaving) {
        return false;
      }
      const { currentImageHash, currentIndex } = get();
      if (!currentImageHash) {
        return false;
      }

      set((s) => {
        s.isSaving = true;
      });
      try {
        const canvas = useLabel3DCanvasStore.getState();
        const objects = canvas.objects;
        const empty = objects.every((o) => o.points.length === 0 && o.boxes.length === 0);

        if (!empty) {
          const volume = get().volume;
          await dbUpsertImage({
            hash: currentImageHash,
            width: canvas.imageWidth,
            height: canvas.imageHeight,
            image_type: 'Slice' as ImageType,
            volume_id: volume?.volumeId ?? null,
            slice_index: currentIndex,
          });
        }

        await dbSetAnnotations(currentImageHash, objectsToDbAnnotations(objects));

        useLabel3DCanvasStore.getState().setDirty(false);
        set((s) => {
          s.isSaving = false;
        });
        toast.success(LABELS.label3d.sliceSaved(currentIndex));
        await logMessage(
          'info',
          `[save] slice ${currentIndex} hash=${currentImageHash} anns=${objects.length}`
        );

        // 后端同步走 SWR：annotation 缓存重新校验（db 形状）+ 切片计数刷新
        await mutate(['slice-annotations', currentImageHash]);
        const volume = get().volume;
        if (volume) {
          await mutate(['slice-summaries', volume.volumeId]);
        }
        return true;
      } catch (e) {
        set((s) => {
          s.isSaving = false;
        });
        await logMessage('error', `[save] slice ${currentIndex} failed: ${e}`);
        toast.error(LABELS.label3d.saveFailed(e));
        return false;
      }
    },

    requestLoadSlice: (index) => {
      // 加载中丢弃新请求，避免并发 raw_slice IPC（配合 useThrottleFn 双保险）
      if (get().isLoadingSlice) {
        return;
      }
      const { dirty } = useLabel3DCanvasStore.getState();
      if (dirty) {
        set((s) => {
          s.pendingIndex = index;
          s.dirtyConfirm = 'save';
        });
        return;
      }
      get()
        .loadSliceByIndex(index)
        .catch(() => {});
    },

    applyPendingLoad: () => {
      const target = get().pendingIndex;
      set((s) => {
        s.pendingIndex = null;
        s.dirtyConfirm = null;
      });
      if (target !== null) {
        get()
          .loadSliceByIndex(target)
          .catch(() => {});
      }
    },

    confirmSave: async () => {
      const ok = await get().saveCurrent();
      if (ok) {
        get().applyPendingLoad();
      }
    },

    confirmDiscard: () => {
      useLabel3DCanvasStore.getState().setDirty(false);
      get().applyPendingLoad();
    },

    cancelDirty: () => {
      set((s) => {
        s.pendingIndex = null;
        s.pendingDeleteIndex = null;
        s.dirtyConfirm = null;
      });
    },

    confirmDirty: (choice) => {
      if (choice === 'save') {
        get().confirmSave();
      } else {
        get().confirmDiscard();
      }
    },

    deleteSlice: async (index) => {
      const { currentIndex, currentImageHash } = get();
      if (index === currentIndex) {
        if (currentImageHash) {
          await get().saveEmptyForHash(currentImageHash, index);
        }
        return;
      }
      set((s) => {
        s.pendingDeleteIndex = index;
      });
      get().requestLoadSlice(index);
    },
  }))
);

// 供组件以 `useLabel3DVolumeStore((s) => s.xxx)` 选择子状态使用
export type Label3DVolume = Label3DVolumeState;
