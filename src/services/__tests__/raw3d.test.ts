import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockInvoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

describe('raw3d service', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
  });

  it('rawOpen calls invoke with correct args', async () => {
    mockInvoke.mockResolvedValue({
      volumeId: 'vol-1',
      totalSlices: 100,
      sliceWidth: 512,
      sliceHeight: 512,
    });
    const { rawOpen } = await import('../raw3d');

    const result = await rawOpen({
      path: '/test/raw',
      x: 100,
      y: 100,
      z: 100,
      dtype: 'u16',
      endian: 'little',
      axis: 'z',
    });

    expect(mockInvoke).toHaveBeenCalledWith('raw_open', {
      req: {
        path: '/test/raw',
        x: 100,
        y: 100,
        z: 100,
        dtype: 'u16',
        endian: 'little',
        axis: 'z',
      },
    });
    expect(result.volumeId).toBe('vol-1');
    expect(result.totalSlices).toBe(100);
  });

  it('rawSlice calls invoke with correct args', async () => {
    mockInvoke.mockResolvedValue({
      data: new Array(256).fill(128),
      width: 16,
      height: 16,
      min: 0,
      max: 255,
    });
    const { rawSlice } = await import('../raw3d');

    const result = await rawSlice('vol-1', 42);

    expect(mockInvoke).toHaveBeenCalledWith('raw_slice', {
      volumeId: 'vol-1',
      index: 42,
    });
    expect(result.width).toBe(16);
    expect(result.data).toHaveLength(256);
  });

  it('rawExportParquet calls invoke with correct args', async () => {
    mockInvoke.mockResolvedValue('/output/exported.parquet');
    const { rawExportParquet } = await import('../raw3d');

    const meta = {
      axis: 'z',
      dtype: 'u16',
      endian: 'little',
      xSize: 512,
      ySize: 512,
      zSize: 100,
    };

    const result = await rawExportParquet(
      'vol-1',
      [
        {
          id: 'uuid-1',
          layer: 0,
          labels: [
            {
              name: '圆形',
              subNames: [],
              boxes: [{ x1: 100, y1: 200, x2: 300, y2: 400 }],
              points: [],
            },
          ],
          maskPngPath: 'http://mcp.localhost/hash0',
          meta,
        },
        {
          id: 'uuid-2',
          layer: 5,
          labels: [],
          maskPngPath: 'http://mcp.localhost/hash5',
          meta,
        },
      ],
      '/output/exported.parquet'
    );

    expect(mockInvoke).toHaveBeenCalledWith('parquet_export_masks', {
      volumeId: 'vol-1',
      masks: [
        {
          id: 'uuid-1',
          layer: 0,
          labels: [
            {
              name: '圆形',
              subNames: [],
              boxes: [{ x1: 100, y1: 200, x2: 300, y2: 400 }],
              points: [],
            },
          ],
          maskPngPath: 'http://mcp.localhost/hash0',
          meta,
        },
        {
          id: 'uuid-2',
          layer: 5,
          labels: [],
          maskPngPath: 'http://mcp.localhost/hash5',
          meta,
        },
      ],
      outputPath: '/output/exported.parquet',
    });
    expect(result).toBe('/output/exported.parquet');
  });
});
