import { ref } from 'vue';
import { match, P } from 'ts-pattern';
import { logMessage } from '@/services/cmd';

function parseColor(color: string): { r: number; g: number; b: number } {
  return match(color)
    .with(P.string.regex(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i), (hex) => {
      const parts = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i)!;
      return {
        r: parseInt(parts[1], 16),
        g: parseInt(parts[2], 16),
        b: parseInt(parts[3], 16),
      };
    })
    .with(P.string.regex(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/), (rgba) => {
      const parts = rgba.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/)!;
      return {
        r: parseInt(parts[1], 10),
        g: parseInt(parts[2], 10),
        b: parseInt(parts[3], 10),
      };
    })
    .otherwise(() => ({ r: 0, g: 150, b: 255 }));
}

export function useMaskRenderer() {
  const renderedMaskUrl = ref<string | null>(null);
  const isRendering = ref(false);

  async function renderMask(
    grayImageUrl: string,
    threshold: number,
    color = '#0096ff'
  ): Promise<string | null> {
    isRendering.value = true;
    try {
      await logMessage(
        'debug',
        `[prev-mask] renderMask entry: url=${grayImageUrl.slice(0, 80)}..., threshold=${threshold}, color=${color}`
      );
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = grayImageUrl;
      await img.decode();
      await logMessage(
        'debug',
        `[prev-mask] renderMask decoded: ${img.naturalWidth}x${img.naturalHeight}`
      );

      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        await logMessage('warn', '[prev-mask] renderMask failed to get 2d context');
        return null;
      }

      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const rgb = parseColor(color);

      let aboveThreshold = 0;
      for (let i = 0; i < data.length; i += 4) {
        const gray = data[i];
        const confidence = gray / 255;
        if (confidence >= threshold / 255) {
          data[i] = rgb.r;
          data[i + 1] = rgb.g;
          data[i + 2] = rgb.b;
          data[i + 3] = Math.round(confidence * 180);
          aboveThreshold++;
        } else {
          data[i + 3] = 0;
        }
      }

      ctx.putImageData(imageData, 0, 0);
      const result = canvas.toDataURL();
      renderedMaskUrl.value = result;
      await logMessage(
        'debug',
        `[prev-mask] renderMask done: ${aboveThreshold}/${data.length / 4} pixels above threshold, outputLen=${result.length}`
      );
      return result;
    } catch (e) {
      await logMessage('error', `[prev-mask] renderMask failed: ${e}`);
      return null;
    } finally {
      isRendering.value = false;
    }
  }

  function clearMask() {
    renderedMaskUrl.value = null;
  }

  return {
    renderedMaskUrl,
    isRendering,
    renderMask,
    clearMask,
  };
}
