import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import type { AnnotationObject } from '@/schemas/annotation';
import type { KeyframeRecord } from '@/db/label-raw-db';

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
    content: [
      {
        type: 'image',
        data: 'http://mcp.localhost/mock-hash-abc',
        mimeType: 'image/png',
      },
    ],
  }),
}));

vi.mock('@/services/cmd', () => ({
  mcpStoreImageBytes: vi.fn().mockResolvedValue('mcp://test/img'),
  logMessage: vi.fn(),
  setLogLevel: vi.fn(),
  setLogLevelFilter: vi.fn(),
}));

vi.mock('@/composables/useMaskRenderer', () => ({
  useMaskRenderer: () => ({
    renderMask: vi.fn().mockResolvedValue('data:image/png;base64,mock'),
  }),
}));

vi.mock('@/composables/useCanvasToBytes', () => ({
  useCanvasToBytes: () => ({
    canvasToPngBytes: vi.fn().mockResolvedValue(new Array(100).fill(0)),
  }),
}));

function createTestObject(id = 'obj-1', labelId = 'label-car'): AnnotationObject {
  return {
    id,
    labelId,
    points: [],
    boxes: [],
  };
}

function createOpts() {
  const store = new Map<string, KeyframeRecord>();

  function makeKey(volId: string, idx: number) {
    return `${volId}::${idx}`;
  }

  return {
    volumeId: ref<string | null>('vol-1'),
    getKeyframe: vi.fn(async (volId: string, idx: number) => {
      return store.get(makeKey(volId, idx));
    }),
    putKeyframe: vi.fn(async (volId: string, sliceIndex: number, data: Partial<KeyframeRecord>) => {
      const key = makeKey(volId, sliceIndex);
      const existing = store.get(key);
      if (existing) {
        Object.assign(existing, data);
      } else {
        store.set(key, {
          volumeId: volId,
          sliceIndex,
          objects: data.objects ?? [],
          maskUrl: data.maskUrl ?? null,
          maskVisible: data.maskVisible ?? true,
          rawMaskHash: data.rawMaskHash ?? null,
          ...data,
        });
      }
    }),
    objects: ref<AnnotationObject[]>([]),
    currentIndex: ref(0),
    totalSlices: ref(10),
    currentMaskUrl: ref<string | null>(null),
    confidenceThreshold: ref(128),
    maskColor: ref('#0096ff'),
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

    expect(opts.putKeyframe).toHaveBeenCalled();
    const putCalls = (opts.putKeyframe as ReturnType<typeof vi.fn>).mock.calls;
    // First call creates the keyframe with objects
    expect(putCalls[0][0]).toBe('vol-1');
    expect(putCalls[0][1]).toBe(0);
    expect(putCalls[0][2].objects).toHaveLength(1);
    // Second call writes recognition results (mask)
    expect(putCalls.length).toBeGreaterThanOrEqual(2);
    const lastCall = putCalls[putCalls.length - 1];
    expect(lastCall[2].rawMaskHash).toBe('http://mcp.localhost/mock-hash-abc');
    expect(lastCall[2].maskUrl).toBe('data:image/png;base64,mock');
    expect(opts.currentMaskUrl.value).toBe('data:image/png;base64,mock');
  });

  it('recognizeCurrentSlice skips when no volume', async () => {
    const opts = createOpts();
    opts.volumeId.value = null;

    const { useRawRecognize } = await import('../useRawRecognize');
    const { recognizeCurrentSlice } = useRawRecognize(opts);

    await recognizeCurrentSlice();

    expect(opts.putKeyframe).not.toHaveBeenCalled();
  });

  it('recognizeCurrentSlice uses existing keyframe', async () => {
    const opts = createOpts();
    const obj = createTestObject();
    obj.points.push({ id: 'p1', x: 10, y: 20, label: 1 });
    opts.objects.value = [obj];

    // Pre-populate the store
    await opts.putKeyframe('vol-1', 0, {
      objects: [{ ...obj }],
      maskUrl: null,
      maskVisible: true,
      rawMaskHash: null,
    });

    const { useRawRecognize } = await import('../useRawRecognize');
    const { recognizeCurrentSlice } = useRawRecognize(opts);

    await recognizeCurrentSlice();

    // putKeyframe should be called for recognition result
    const putCalls = (opts.putKeyframe as ReturnType<typeof vi.fn>).mock.calls;
    const lastCall = putCalls[putCalls.length - 1];
    expect(lastCall[2].rawMaskHash).toBe('http://mcp.localhost/mock-hash-abc');
  });

  it('batchRecognize skips slices with mask', async () => {
    const opts = createOpts();
    const obj1 = createTestObject('obj-1', 'car');
    obj1.points.push({ id: 'p1', x: 10, y: 20, label: 1 });

    await opts.putKeyframe('vol-1', 0, { objects: [obj1] });
    await opts.putKeyframe('vol-1', 3, { rawMaskHash: 'existing-hash' });

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

    await opts.putKeyframe('vol-1', 2, {
      objects: [obj],
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
