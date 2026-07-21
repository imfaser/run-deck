import { onMounted, onUnmounted } from 'vue';
import { useDebounceFn } from '@vueuse/core';

interface MaskRenderStore {
  maskColor: string;
  confidenceThreshold: number;
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

  let prevMaskColor = store.maskColor;
  let prevThreshold = store.confidenceThreshold;
  let unsubscribe: () => void;

  onMounted(() => {
    unsubscribe = store.$subscribe(() => {
      if (store.maskColor !== prevMaskColor || store.confidenceThreshold !== prevThreshold) {
        prevMaskColor = store.maskColor;
        prevThreshold = store.confidenceThreshold;
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
