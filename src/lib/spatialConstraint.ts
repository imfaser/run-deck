import type { AnnotationPoint } from '@/schemas/annotation';

export interface PointLike {
  x: number;
  y: number;
}

export interface BoxLike {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export function isPointInBox(point: PointLike, box: BoxLike): boolean {
  return point.x >= box.x1 && point.x <= box.x2 && point.y >= box.y1 && point.y <= box.y2;
}

export function isPointInAnyBox(point: PointLike, boxes: BoxLike[]): boolean {
  return boxes.some((box) => isPointInBox(point, box));
}

export function findBoxForPoint(point: AnnotationPoint, boxes: BoxLike[]): BoxLike | undefined {
  return boxes.find((box) => isPointInBox(point, box));
}
