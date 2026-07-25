import { onMounted, onUnmounted } from 'vue';
import { useDebounceFn } from '@vueuse/core';

interface MaskSettings {
  color: string;
  prevMaskColor: string;
  threshold: number;
  prevMaskAssist: boolean;
}

interface MaskRenderStore {
  maskSettings: MaskSettings;
  $subscribe: (callback: () => void) => () => void;
}

interface UseMaskRenderOnChangeOpts {
  store: MaskRenderStore;
  renderFn: () => Promise<void>;
}

export function useMaskRenderOnChange(options: UseMaskRenderOnChangeOpts) {
  const { store, renderFn } = options;

  const debouncedRerender = useDebounceFn(renderFn, 300);

  let prevMaskColor = store.maskSettings.color;
  let prevPrevMaskColor = store.maskSettings.prevMaskColor;
  let prevThreshold = store.maskSettings.threshold;
  let prevPrevMaskAssist = store.maskSettings.prevMaskAssist;
  let unsubscribe: () => void;

  onMounted(() => {
    unsubscribe = store.$subscribe(() => {
      if (
        store.maskSettings.color !== prevMaskColor ||
        store.maskSettings.prevMaskColor !== prevPrevMaskColor ||
        store.maskSettings.threshold !== prevThreshold ||
        store.maskSettings.prevMaskAssist !== prevPrevMaskAssist
      ) {
        prevMaskColor = store.maskSettings.color;
        prevPrevMaskColor = store.maskSettings.prevMaskColor;
        prevThreshold = store.maskSettings.threshold;
        prevPrevMaskAssist = store.maskSettings.prevMaskAssist;
        debouncedRerender();
      }
    });
  });

  onUnmounted(() => {
    unsubscribe?.();
  });
}
