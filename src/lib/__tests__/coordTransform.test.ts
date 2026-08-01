import { describe, it, expect } from 'vitest';
import { canvasToImage, imageToCanvas, getPointerImagePos } from '@/lib/coordTransform';

// Minimal mock of Konva Group
function createMockGroup(transform: { x: number; y: number; scaleX: number; scaleY: number }) {
  return {
    x: () => transform.x,
    y: () => transform.y,
    scaleX: () => transform.scaleX,
    scaleY: () => transform.scaleY,
  } as any;
}

// Minimal mock of Konva.Stage
function createMockStage(pointerPos: { x: number; y: number } | null) {
  return {
    getPointerPosition: () => pointerPos,
  } as any;
}

describe('coordTransform', () => {
  describe('canvasToImage', () => {
    it('converts canvas coordinates to image coordinates', () => {
      const group = createMockGroup({ x: 100, y: 50, scaleX: 2, scaleY: 2 });
      expect(canvasToImage(300, 150, group)).toEqual({ x: 100, y: 50 });
    });

    it('rounds to nearest integer', () => {
      const group = createMockGroup({ x: 10, y: 10, scaleX: 1.5, scaleY: 1.5 });
      // (25 - 10) / 1.5 = 10
      expect(canvasToImage(25, 25, group)).toEqual({ x: 10, y: 10 });
    });

    it('handles identity transform (no scale, no offset)', () => {
      const group = createMockGroup({ x: 0, y: 0, scaleX: 1, scaleY: 1 });
      expect(canvasToImage(100, 200, group)).toEqual({ x: 100, y: 200 });
    });

    it('handles negative group position', () => {
      const group = createMockGroup({ x: -50, y: -30, scaleX: 1, scaleY: 1 });
      expect(canvasToImage(50, 70, group)).toEqual({ x: 100, y: 100 });
    });
  });

  describe('imageToCanvas', () => {
    it('converts image coordinates to canvas coordinates', () => {
      const group = createMockGroup({ x: 100, y: 50, scaleX: 2, scaleY: 2 });
      expect(imageToCanvas(100, 50, group)).toEqual({ x: 300, y: 150 });
    });

    it('is inverse of canvasToImage', () => {
      const group = createMockGroup({ x: 100, y: 50, scaleX: 2, scaleY: 2 });
      const imgCoord = { x: 200, y: 100 };
      const canvasCoord = imageToCanvas(imgCoord.x, imgCoord.y, group);
      const backToImage = canvasToImage(canvasCoord.x, canvasCoord.y, group);
      expect(backToImage).toEqual(imgCoord);
    });

    it('handles identity transform', () => {
      const group = createMockGroup({ x: 0, y: 0, scaleX: 1, scaleY: 1 });
      expect(imageToCanvas(100, 200, group)).toEqual({ x: 100, y: 200 });
    });
  });

  describe('getPointerImagePos', () => {
    it('returns null when stage has no pointer position', () => {
      const stage = createMockStage(null);
      const group = createMockGroup({ x: 0, y: 0, scaleX: 1, scaleY: 1 });
      expect(getPointerImagePos(stage, group)).toBeNull();
    });

    it('converts pointer position to image coordinates', () => {
      const stage = createMockStage({ x: 300, y: 150 });
      const group = createMockGroup({ x: 100, y: 50, scaleX: 2, scaleY: 2 });
      expect(getPointerImagePos(stage, group)).toEqual({ x: 100, y: 50 });
    });

    it('returns null when pointer position is null', () => {
      const stage = createMockStage(null);
      const group = createMockGroup({ x: 0, y: 0, scaleX: 1, scaleY: 1 });
      expect(getPointerImagePos(stage, group)).toBeNull();
    });

    it('returns null when stage or group is null', () => {
      expect(
        getPointerImagePos(null, createMockGroup({ x: 0, y: 0, scaleX: 1, scaleY: 1 }))
      ).toBeNull();
      expect(getPointerImagePos(createMockStage({ x: 1, y: 1 }), null)).toBeNull();
    });
  });
});
