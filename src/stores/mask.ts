import { defineStore } from 'pinia';
import { ref } from 'vue';
import { logMessage } from '@/services/cmd';
import { useMaskRenderer } from '@/composables/useMaskRenderer';
import { getKeyframe } from '@/db/keyframe-repo';
import { useLabel3dStore } from '@/stores/label-3d';
import type { MaskSettings } from '@/schemas/volume';

export const useLabel3dMaskStore = defineStore('mask-3d', () => {
  const label3d = useLabel3dStore();

  const maskSettings = ref<MaskSettings>({
    color: '#0096ff',
    prevMaskColor: '#ef4444',
    opacity: 0.6,
    threshold: 128,
    prevMaskAssist: true,
  });
  const currentMaskUrl = ref<string | null>(null);

  function setCurrentMaskUrl(url: string | null) {
    currentMaskUrl.value = url;
  }

  async function renderCurrentMask() {
    const volId = label3d.volumeId;
    if (!volId) return;
    try {
      const kf = await getKeyframe(volId, label3d.currentIndex);
      if (!kf?.rawMaskHash) {
        if (maskSettings.value.prevMaskAssist) {
          await logMessage(
            'debug',
            `[prev-mask] renderCurrentMask search: slice=${label3d.currentIndex}, searching backwards`
          );
          for (let i = label3d.currentIndex - 1; i >= 0; i--) {
            const prevKf = await getKeyframe(volId, i);
            if (prevKf?.rawMaskHash) {
              await logMessage('debug', `[prev-mask] renderCurrentMask found prev: slice=${i}`);
              const { renderMask } = useMaskRenderer();
              currentMaskUrl.value = await renderMask(
                prevKf.rawMaskHash,
                maskSettings.value.threshold,
                maskSettings.value.prevMaskColor
              );
              return;
            }
          }
          await logMessage(
            'debug',
            `[prev-mask] renderCurrentMask search exhausted: no prev mask found`
          );
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
      currentMaskUrl.value = maskUrl;
    } catch (e) {
      await logMessage(
        'error',
        `[mask-render] renderCurrentMask failed slice=${label3d.currentIndex}: ${e}`
      );
    }
  }

  return {
    maskSettings,
    currentMaskUrl,
    setCurrentMaskUrl,
    renderCurrentMask,
  };
});
