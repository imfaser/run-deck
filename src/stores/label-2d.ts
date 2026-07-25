import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { MaskSettings } from '@/schemas/volume';

export const useLabel2dStore = (id: string) =>
  defineStore(`label-2d-${id}`, () => {
    // ─── Image ───────────────────────────────────────
    const imagePath = ref<string | null>(null);
    const imageUrl = ref<string | null>(null);

    // ─── Mask ────────────────────────────────────────
    const maskUrl = ref<string | null>(null);
    const maskVisible = ref(true);
    const maskSettings = ref<MaskSettings>({
      color: '#0096ff',
      prevMaskColor: '#ef4444',
      opacity: 0.6,
      threshold: 128,
      prevMaskAssist: true,
    });
    const rawMaskPath = ref<string | null>(null);

    return {
      // Image
      imagePath,
      imageUrl,
      // Mask
      maskUrl,
      maskVisible,
      maskSettings,
      rawMaskPath,
    };
  })();
