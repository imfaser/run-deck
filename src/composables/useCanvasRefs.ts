import type Konva from 'konva';

export interface CanvasRefs {
  getStage: () => Konva.Stage | null;
  getGroup: () => Konva.Group | null;
  getTransformer: () => Konva.Transformer | null;
  getLayer: () => Konva.Layer | null;
}

export function useCanvasRefs(stageRef: {
  value: { getStage?: () => Konva.Stage } | null;
}): CanvasRefs {
  function getStage(): Konva.Stage | null {
    return stageRef.value?.getStage?.() ?? null;
  }

  function getGroup(): Konva.Group | null {
    const stage = getStage();
    if (!stage) return null;
    return stage.findOne('.annotation-group') as Konva.Group | null;
  }

  function getTransformer(): Konva.Transformer | null {
    const stage = getStage();
    if (!stage) return null;
    return stage.findOne('.transformer-handle') as Konva.Transformer | null;
  }

  function getLayer(): Konva.Layer | null {
    const stage = getStage();
    if (!stage) return null;
    return stage.findOne('Layer') as Konva.Layer | null;
  }

  return { getStage, getGroup, getTransformer, getLayer };
}
