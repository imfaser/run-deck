import { ref } from 'vue';

function parseColor(color: string): { r: number; g: number; b: number } {
  const hex = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(color);
  if (hex) {
    return {
      r: parseInt(hex[1], 16),
      g: parseInt(hex[2], 16),
      b: parseInt(hex[3], 16),
    };
  }
  const rgba = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(color);
  if (rgba) {
    return {
      r: parseInt(rgba[1], 10),
      g: parseInt(rgba[2], 10),
      b: parseInt(rgba[3], 10),
    };
  }
  return { r: 0, g: 150, b: 255 };
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
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = grayImageUrl;
      await img.decode();

      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const rgb = parseColor(color);

      for (let i = 0; i < data.length; i += 4) {
        const gray = data[i];
        const confidence = gray / 255;
        if (confidence >= threshold / 255) {
          data[i] = rgb.r;
          data[i + 1] = rgb.g;
          data[i + 2] = rgb.b;
          data[i + 3] = Math.round(confidence * 180);
        } else {
          data[i + 3] = 0;
        }
      }

      ctx.putImageData(imageData, 0, 0);
      const result = canvas.toDataURL();
      renderedMaskUrl.value = result;
      return result;
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
