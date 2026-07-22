import { onMounted, onUnmounted } from 'vue';
import { useDebounceFn } from '@vueuse/core';

interface MaskSettings {
  color: string;
  threshold: number;
}

interface MaskRenderStore {
  maskSettings: MaskSettings;
  $subscribe: (callback: () => void) => () => void;
}

interface MaskRenderOptions {
  store: MaskRenderStore;
  hasMask: () => boolean;
  renderFn: () => Promise<void>;
}

export function useMaskRenderOnChange(options: MaskRenderOptions) {
  const { store, hasMask, renderFn } = options;

  const debouncedRerender = useDebounceFn(renderFn, 300);

  let prevMaskColor = store.maskSettings.color;
  let prevThreshold = store.maskSettings.threshold;
  let unsubscribe: () => void;

  onMounted(() => {
    unsubscribe = store.$subscribe(() => {
      if (
        store.maskSettings.color !== prevMaskColor ||
        store.maskSettings.threshold !== prevThreshold
      ) {
        prevMaskColor = store.maskSettings.color;
        prevThreshold = store.maskSettings.threshold;
        if (hasMask()) {
          debouncedRerender();
        }
      }
    });
  });

  onUnmounted(() => {
    unsubscribe?.();
  });
}
