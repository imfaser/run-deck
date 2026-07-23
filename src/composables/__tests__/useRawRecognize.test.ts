import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import type { AnnotationObject } from '@/schemas/annotation';
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

function createTestObject(id = 'obj-1', name = 'car'): AnnotationObject {
  return {
    id,
    name,
    color: '#ff3b30',
    points: [],
    boxes: [],
  };
}

function createOpts() {
  return {
    volumeId: ref<string | null>('vol-1'),
    keyframes: ref<Map<number, Keyframe>>(new Map()),
    objects: ref<AnnotationObject[]>([]),
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
    const obj = createTestObject();
    obj.points.push({ id: 'p1', x: 10, y: 20, label: 1 });
    opts.objects.value = [obj];

    const { useRawRecognize } = await import('../useRawRecognize');
    const { recognizeCurrentSlice } = useRawRecognize(opts);

    await recognizeCurrentSlice();

    expect(opts.keyframes.value.has(0)).toBe(true);
    const kf = opts.keyframes.value.get(0)!;
    expect(kf.objects).toHaveLength(1);
    expect(kf.objects[0].points).toHaveLength(1);
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
    const obj = createTestObject();
    obj.points.push({ id: 'p1', x: 10, y: 20, label: 1 });
    opts.objects.value = [obj];

    const existingKf: Keyframe = {
      objects: [{ ...obj }],
      maskUrl: null,
      maskVisible: true,
      rawMaskHash: null,
    };
    opts.keyframes.value.set(0, existingKf);

    const { useRawRecognize } = await import('../useRawRecognize');
    const { recognizeCurrentSlice } = useRawRecognize(opts);

    await recognizeCurrentSlice();

    expect(opts.keyframes.value.size).toBe(1);
    expect(existingKf.rawMaskHash).toBe('mcp://localhost/mock-hash-abc');
  });

  it('batchRecognize skips slices with mask', async () => {
    const opts = createOpts();
    const obj1 = createTestObject('obj-1', 'car');
    obj1.points.push({ id: 'p1', x: 10, y: 20, label: 1 });
    opts.keyframes.value.set(0, {
      objects: [obj1],
      maskUrl: null,
      maskVisible: true,
      rawMaskHash: null,
    });
    opts.keyframes.value.set(3, {
      objects: [],
      maskUrl: null,
      maskVisible: true,
      rawMaskHash: 'existing-hash',
    });

    const { useRawRecognize } = await import('../useRawRecognize');
    const { batchRecognize } = useRawRecognize(opts);

    await batchRecognize(0, 5);

    const { segmentImage } = await import('@/services/sam3');
    expect(segmentImage).toHaveBeenCalledTimes(5);
  });

  it('batchRecognize rejects invalid range', async () => {
    const opts = createOpts();

    const { useRawRecognize } = await import('../useRawRecognize');
    const { batchRecognize } = useRawRecognize(opts);

    await batchRecognize(5, 5);

    const { ElMessage } = await import('element-plus');
    expect(ElMessage.error).toBeDefined();
  });

  it('batchRecognize propagates prev_mask chain', async () => {
    const opts = createOpts();
    const obj = createTestObject();
    obj.points.push({ id: 'p1', x: 10, y: 20, label: 1 });
    opts.keyframes.value.set(2, {
      objects: [obj],
      maskUrl: null,
      maskVisible: true,
      rawMaskHash: 'mcp://localhost/seed-hash',
    });

    const { useRawRecognize } = await import('../useRawRecognize');
    const { batchRecognize } = useRawRecognize(opts);

    await batchRecognize(2, 5);

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
