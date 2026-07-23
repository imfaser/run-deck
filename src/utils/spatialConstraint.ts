import type { PointAnnotation, BoxAnnotation } from '@/schemas/annotation';

export function isPointInBox(
  point: { x: number; y: number },
  box: { x1: number; y1: number; x2: number; y2: number }
): boolean {
  return point.x >= box.x1 && point.x <= box.x2 && point.y >= box.y1 && point.y <= box.y2;
}

export function isPointInAnyBox(point: { x: number; y: number }, boxes: BoxAnnotation[]): boolean {
  return boxes.some((box) => isPointInBox(point, box));
}

export function findBoxForPoint(
  point: PointAnnotation,
  boxes: BoxAnnotation[]
): BoxAnnotation | undefined {
  return boxes.find((box) => isPointInBox(point, box));
}
