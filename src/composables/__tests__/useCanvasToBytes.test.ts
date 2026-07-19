import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockImageData = { data: new Uint8ClampedArray(16) };
const mockCtx = {
  createImageData: vi.fn().mockReturnValue(mockImageData),
  putImageData: vi.fn(),
};
const mockToDataURL = vi
  .fn()
  .mockReturnValue(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPj/HwADBwIAMCbHYQAAAABJRU5ErkJggg=='
  );

beforeEach(() => {
  vi.clearAllMocks();
  HTMLCanvasElement.prototype.getContext = vi
    .fn()
    .mockReturnValue(mockCtx) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.toDataURL =
    mockToDataURL as unknown as typeof HTMLCanvasElement.prototype.toDataURL;
});

describe('useCanvasToBytes', () => {
  it('converts grayscale data to PNG bytes', async () => {
    const { useCanvasToBytes } = await import('../useCanvasToBytes');
    const { canvasToPngBytes } = useCanvasToBytes();

    const data = [0, 128, 255, 64];
    const result = await canvasToPngBytes(data, 2, 2);

    expect(mockCtx.createImageData).toHaveBeenCalledWith(2, 2);
    expect(mockCtx.putImageData).toHaveBeenCalled();
    expect(mockToDataURL).toHaveBeenCalledWith('image/png');
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it('handles empty data', async () => {
    const { useCanvasToBytes } = await import('../useCanvasToBytes');
    const { canvasToPngBytes } = useCanvasToBytes();

    const result = await canvasToPngBytes([], 0, 0);

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });
});
