import { describe, it, expect } from 'vitest';
import { isPointInBox, isPointInAnyBox, findBoxForPoint } from '@/lib/spatialConstraint';
import type { AnnotationPoint } from '@/schemas/annotation';

describe('spatialConstraint', () => {
  describe('isPointInBox', () => {
    it('returns true when point is inside box', () => {
      expect(isPointInBox({ x: 5, y: 5 }, { x1: 0, y1: 0, x2: 10, y2: 10 })).toBe(true);
    });

    it('returns true when point is on box edge', () => {
      expect(isPointInBox({ x: 0, y: 0 }, { x1: 0, y1: 0, x2: 10, y2: 10 })).toBe(true);
      expect(isPointInBox({ x: 10, y: 10 }, { x1: 0, y1: 0, x2: 10, y2: 10 })).toBe(true);
    });

    it('returns false when point is outside box', () => {
      expect(isPointInBox({ x: 11, y: 5 }, { x1: 0, y1: 0, x2: 10, y2: 10 })).toBe(false);
      expect(isPointInBox({ x: 5, y: 11 }, { x1: 0, y1: 0, x2: 10, y2: 10 })).toBe(false);
      expect(isPointInBox({ x: -1, y: 5 }, { x1: 0, y1: 0, x2: 10, y2: 10 })).toBe(false);
    });

    it('returns false for point outside negative-coordinate box', () => {
      expect(isPointInBox({ x: -5, y: -5 }, { x1: -10, y1: -10, x2: 0, y2: 0 })).toBe(true);
      expect(isPointInBox({ x: 1, y: 1 }, { x1: -10, y1: -10, x2: 0, y2: 0 })).toBe(false);
    });

    it('handles zero-size box (point-like)', () => {
      expect(isPointInBox({ x: 5, y: 5 }, { x1: 5, y1: 5, x2: 5, y2: 5 })).toBe(true);
      expect(isPointInBox({ x: 4, y: 5 }, { x1: 5, y1: 5, x2: 5, y2: 5 })).toBe(false);
    });
  });

  describe('isPointInAnyBox', () => {
    it('returns true if point is in any box', () => {
      const boxes = [
        { x1: 0, y1: 0, x2: 5, y2: 5 },
        { x1: 10, y1: 10, x2: 20, y2: 20 },
      ];
      expect(isPointInAnyBox({ x: 15, y: 15 }, boxes)).toBe(true);
    });

    it('returns false if point is in no box', () => {
      const boxes = [
        { x1: 0, y1: 0, x2: 5, y2: 5 },
        { x1: 10, y1: 10, x2: 20, y2: 20 },
      ];
      expect(isPointInAnyBox({ x: 7, y: 7 }, boxes)).toBe(false);
    });

    it('returns false for empty box array', () => {
      expect(isPointInAnyBox({ x: 5, y: 5 }, [])).toBe(false);
    });
  });

  describe('findBoxForPoint', () => {
    it('returns the first matching box', () => {
      const boxes = [
        { x1: 0, y1: 0, x2: 5, y2: 5 },
        { x1: 3, y1: 3, x2: 8, y2: 8 },
      ];
      const result = findBoxForPoint(
        { id: 'p1', annotation_id: 'a1', x: 4, y: 4, sign: 'Positive' } as AnnotationPoint,
        boxes
      );
      expect(result).toEqual({ x1: 0, y1: 0, x2: 5, y2: 5 });
    });

    it('returns undefined if no box matches', () => {
      const boxes = [{ x1: 0, y1: 0, x2: 5, y2: 5 }];
      const result = findBoxForPoint(
        { id: 'p1', annotation_id: 'a1', x: 10, y: 10, sign: 'Positive' } as AnnotationPoint,
        boxes
      );
      expect(result).toBeUndefined();
    });

    it('returns undefined for empty box array', () => {
      const result = findBoxForPoint(
        { id: 'p1', annotation_id: 'a1', x: 5, y: 5, sign: 'Positive' } as AnnotationPoint,
        []
      );
      expect(result).toBeUndefined();
    });
  });
});
