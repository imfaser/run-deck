import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import type { Annotation } from '@/types/annotation';
import type { Keyframe } from '@/stores/label-raw';

vi.mock('@/services/raw3d', () => ({
  rawSlice: vi.fn().mockResolvedValue({
    data: new Array(256).fill(128),
    width: 16,
    height: 16,
    min: 0,
    max: 255,
  }),
}));

vi.mock('@/services/sam3', () => ({
  segmentImage: vi.fn().mockResolvedValue({
    content: [{ type: 'image', data: 'mock-hash-abc', mimeType: 'image/png' }],
  }),
}));

vi.mock('@/services/cmd', () => ({
  mcpStoreImageBytes: vi.fn().mockResolvedValue('mcp://test/img'),
  logMessage: vi.fn(),
}));

vi.mock('@/composables/useMaskRenderer', () => ({
  useMaskRenderer: () => ({
    renderMask: vi.fn().mockResolvedValue('data:image/png;base64,mock'),
  }),
}));

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: (hash: string, _protocol?: string) => `mcp://localhost/${hash}`,
}));

vi.mock('@/composables/useCanvasToBytes', () => ({
  useCanvasToBytes: () => ({
    canvasToPngBytes: vi.fn().mockResolvedValue(new Array(100).fill(0)),
  }),
}));

function createOpts() {
  return {
    volumeId: ref<string | null>('vol-1'),
    keyframes: ref<Map<number, Keyframe>>(new Map()),
    annotations: ref<Annotation[]>([]),
    currentIndex: ref(0),
    totalSlices: ref(10),
    currentMaskUrl: ref<string | null>(null),
    confidenceThreshold: ref(128),
    maskColor: ref('#0096ff'),
    cloneKeyframes: vi.fn(),
  };
}

describe('useRawRecognize', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('recognizeCurrentSlice creates keyframe if none exists', async () => {
    const opts = createOpts();
    opts.annotations.value = [{ id: 'a1', type: 'p_point', x: 10, y: 20 }];

    const { useRawRecognize } = await import('../useRawRecognize');
    const { recognizeCurrentSlice } = useRawRecognize(opts);

    await recognizeCurrentSlice();

    expect(opts.keyframes.value.has(0)).toBe(true);
    const kf = opts.keyframes.value.get(0)!;
    expect(kf.annotations).toHaveLength(1);
    expect(kf.rawMaskHash).toBe('mcp://localhost/mock-hash-abc');
    expect(kf.maskUrl).toBe('data:image/png;base64,mock');
    expect(opts.currentMaskUrl.value).toBe('data:image/png;base64,mock');
  });

  it('recognizeCurrentSlice skips when no volume', async () => {
    const opts = createOpts();
    opts.volumeId.value = null;

    const { useRawRecognize } = await import('../useRawRecognize');
    const { recognizeCurrentSlice } = useRawRecognize(opts);

    await recognizeCurrentSlice();

    expect(opts.keyframes.value.size).toBe(0);
  });

  it('recognizeCurrentSlice uses existing keyframe', async () => {
    const opts = createOpts();
    opts.annotations.value = [{ id: 'a1', type: 'p_point', x: 10, y: 20 }];

    const existingKf: Keyframe = {
      annotations: [{ id: 'a1', type: 'p_point', x: 10, y: 20 }],
      maskUrl: null,
      maskVisible: true,
      rawMaskHash: null,
      manual: false,
    };
    opts.keyframes.value.set(0, existingKf);

    const { useRawRecognize } = await import('../useRawRecognize');
    const { recognizeCurrentSlice } = useRawRecognize(opts);

    await recognizeCurrentSlice();

    expect(opts.keyframes.value.size).toBe(1);
    expect(existingKf.rawMaskHash).toBe('mcp://localhost/mock-hash-abc');
  });

  it('batchProcessKeyframes processes keyframes without mask', async () => {
    const opts = createOpts();
    opts.keyframes.value.set(0, {
      annotations: [{ id: 'a1', type: 'p_point', x: 10, y: 20 }],
      maskUrl: null,
      maskVisible: true,
      rawMaskHash: null,
      manual: false,
    });
    opts.keyframes.value.set(3, {
      annotations: [{ id: 'a2', type: 'p_point', x: 30, y: 40 }],
      maskUrl: null,
      maskVisible: true,
      rawMaskHash: 'existing-hash',
      manual: false,
    });

    const { useRawRecognize } = await import('../useRawRecognize');
    const { batchProcessKeyframes } = useRawRecognize(opts);

    await batchProcessKeyframes();

    const { segmentImage } = await import('@/services/sam3');
    expect(segmentImage).toHaveBeenCalledTimes(1);
  });

  it('recognizeAllSlices refuses when no keyframes', async () => {
    const opts = createOpts();

    const { useRawRecognize } = await import('../useRawRecognize');
    const { recognizeAllSlices } = useRawRecognize(opts);

    await recognizeAllSlices();

    const { logMessage } = await import('@/services/cmd');
    expect(logMessage).toHaveBeenCalledWith(
      'warn',
      '[recognizeAll] refused: no keyframes with mask or annotations'
    );
  });

  it('recognizeAllSlices propagates prev_mask chain', async () => {
    const opts = createOpts();
    opts.keyframes.value.set(2, {
      annotations: [{ id: 'a1', type: 'p_point', x: 10, y: 20 }],
      maskUrl: null,
      maskVisible: true,
      rawMaskHash: 'mcp://localhost/seed-hash',
      manual: false,
    });

    const { useRawRecognize } = await import('../useRawRecognize');
    const { recognizeAllSlices } = useRawRecognize(opts);

    await recognizeAllSlices(5);

    const { segmentImage } = await import('@/services/sam3');
    expect(segmentImage).toHaveBeenCalled();
  });

  it('stopRecognition stops the loop', async () => {
    const opts = createOpts();

    const { useRawRecognize } = await import('../useRawRecognize');
    const { stopRecognition, isRecognizing } = useRawRecognize(opts);

    stopRecognition();

    expect(isRecognizing.value).toBe(false);
  });
});
