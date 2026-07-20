export type AnnotationType = 'p_point' | 'n_point' | 'box';
export type LabelMode = 'select' | 'create' | 'delete';

export interface PointAnnotation {
  id: string;
  type: 'p_point' | 'n_point';
  x: number;
  y: number;
}

export interface BoxAnnotation {
  id: string;
  type: 'box';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export type Annotation = PointAnnotation | BoxAnnotation;
