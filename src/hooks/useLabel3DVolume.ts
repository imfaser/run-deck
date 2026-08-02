import { useShallow } from 'zustand/react/shallow';
import { useLabel3DVolumeStore, type Label3DVolumeState } from '@/store/label-3d-volume';

export type { DirtyConfirmChoice } from '@/store/label-3d-volume';

export interface UseLabel3DVolumeOpts {
  enabled?: boolean;
}

/** hook 对外形状：store 的 UI 子集（不含内部 pending 与 saveEmptyForHash）。 */
export type Label3DVolume = Pick<
  Label3DVolumeState,
  | 'volume'
  | 'currentIndex'
  | 'currentImageHash'
  | 'currentMaskHash'
  | 'sliceImageUrl'
  | 'isLoadingSlice'
  | 'isSaving'
  | 'dirtyConfirm'
  | 'openVolume'
  | 'loadSliceByIndex'
  | 'saveCurrent'
  | 'setCurrentMaskHash'
  | 'requestLoadSlice'
  | 'applyPendingLoad'
  | 'confirmSave'
  | 'confirmDiscard'
  | 'cancelDirty'
  | 'confirmDirty'
  | 'deleteSlice'
>;

/**
 * 页面级 volume 会话 hook：薄封装，直接订阅 label-3d-volume store。
 * 复杂流程（open/load/save/delete/dirty-confirm）在 store 内实现，
 * 经 `get()` 读取实时状态，天然规避闭包陈旧问题。
 */
export function useLabel3DVolume(_opts: UseLabel3DVolumeOpts = {}): Label3DVolume {
  return useLabel3DVolumeStore(
    useShallow((s) => ({
      volume: s.volume,
      currentIndex: s.currentIndex,
      currentImageHash: s.currentImageHash,
      currentMaskHash: s.currentMaskHash,
      sliceImageUrl: s.sliceImageUrl,
      isLoadingSlice: s.isLoadingSlice,
      isSaving: s.isSaving,
      dirtyConfirm: s.dirtyConfirm,
      openVolume: s.openVolume,
      loadSliceByIndex: s.loadSliceByIndex,
      saveCurrent: s.saveCurrent,
      setCurrentMaskHash: s.setCurrentMaskHash,
      requestLoadSlice: s.requestLoadSlice,
      applyPendingLoad: s.applyPendingLoad,
      confirmSave: s.confirmSave,
      confirmDiscard: s.confirmDiscard,
      cancelDirty: s.cancelDirty,
      confirmDirty: s.confirmDirty,
      deleteSlice: s.deleteSlice,
    }))
  );
}
