import { onMounted, onUnmounted } from 'vue';
import { useDebounceFn } from '@vueuse/core';

interface MaskSettings {
  color: string;
  threshold: number;
  showPrevMask: boolean;
}

interface MaskRenderStore {
  maskSettings: MaskSettings;
  $subscribe: (callback: () => void) => () => void;
}

interface MaskRenderOptions {
  store: MaskRenderStore;
  renderFn: () => Promise<void>;
}

export function useMaskRenderOnChange(options: MaskRenderOptions) {
  const { store, renderFn } = options;

  const debouncedRerender = useDebounceFn(renderFn, 300);

  let prevMaskColor = store.maskSettings.color;
  let prevThreshold = store.maskSettings.threshold;
  let prevShowPrevMask = store.maskSettings.showPrevMask;
  let unsubscribe: () => void;

  onMounted(() => {
    unsubscribe = store.$subscribe(() => {
      if (
        store.maskSettings.color !== prevMaskColor ||
        store.maskSettings.threshold !== prevThreshold ||
        store.maskSettings.showPrevMask !== prevShowPrevMask
      ) {
        prevMaskColor = store.maskSettings.color;
        prevThreshold = store.maskSettings.threshold;
        prevShowPrevMask = store.maskSettings.showPrevMask;
        debouncedRerender();
      }
    });
  });

  onUnmounted(() => {
    unsubscribe?.();
  });
}
