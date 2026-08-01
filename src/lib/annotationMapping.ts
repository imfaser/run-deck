import type { Annotation, AnnotationInput, BoxInput, PointInput } from '@/schemas/annotation';

// ─── Frontend model (working copy in canvas store) ─────────────────

export interface FrontendPoint {
  id: string;
  x: number;
  y: number;
  label: 0 | 1;
}

export interface FrontendBox {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  boxType?: 'visual_ref';
}

export interface AnnotationObject {
  id: string;
  labelId: string;
  points: FrontendPoint[];
  boxes: FrontendBox[];
}

// ─── DB → Frontend ─────────────────────────────────────────────────

export function dbAnnotationToObject(db: Annotation): AnnotationObject {
  return {
    id: db.id,
    labelId: db.label_id,
    points: db.points.map((p) => ({
      id: p.id,
      x: p.x,
      y: p.y,
      label: p.sign === 'Positive' ? 1 : 0,
    })),
    boxes: db.boxes.map((b) => ({
      id: b.id,
      x1: b.x1,
      y1: b.y1,
      x2: b.x2,
      y2: b.y2,
      boxType: b.box_type === 'Visual' ? ('visual_ref' as const) : undefined,
    })),
  };
}

export function dbAnnotationsToObjects(dbAnnotations: Annotation[]): AnnotationObject[] {
  return dbAnnotations.map(dbAnnotationToObject);
}

// ─── Frontend → DB ─────────────────────────────────────────────────

export function objectToDbAnnotation(obj: AnnotationObject): AnnotationInput {
  const points: PointInput[] = obj.points.map((p) => ({
    id: p.id,
    x: p.x,
    y: p.y,
    sign: p.label === 1 ? 'Positive' : 'Negative',
  }));
  const boxes: BoxInput[] = obj.boxes.map((b) => ({
    id: b.id,
    box_type: b.boxType === 'visual_ref' ? 'Visual' : 'Annotate',
    x1: b.x1,
    y1: b.y1,
    x2: b.x2,
    y2: b.y2,
  }));
  return {
    id: obj.id,
    label_id: obj.labelId,
    boxes,
    points,
  };
}

export function objectsToDbAnnotations(objects: AnnotationObject[]): AnnotationInput[] {
  return objects
    .filter((o) => o.points.length > 0 || o.boxes.length > 0)
    .map((o) => objectToDbAnnotation(o));
}

// ─── Frontend Annotation type (from source label-raw) ──────────────

export type FrontendAnnotation = FrontendPoint | FrontendBox;
