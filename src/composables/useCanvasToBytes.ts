export function useCanvasToBytes() {
  async function canvasToPngBytes(
    data: Uint8Array | number[],
    width: number,
    height: number
  ): Promise<number[]> {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    const imageData = ctx.createImageData(width, height);
    for (let i = 0; i < data.length; i++) {
      const px = i * 4;
      imageData.data[px] = data[i];
      imageData.data[px + 1] = data[i];
      imageData.data[px + 2] = data[i];
      imageData.data[px + 3] = 255;
    }
    ctx.putImageData(imageData, 0, 0);
    const dataUrl = canvas.toDataURL('image/png');
    const base64 = dataUrl.split(',')[1];
    const binaryStr = atob(base64);
    const bytes = new Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    return bytes;
  }

  return { canvasToPngBytes };
}
