import type Konva from 'konva';

/**
 * 共享 Konva 节点引用：模块级单例。
 * 画布组件通过 setStage/setGroup/setTransformer 注册节点，
 * 各 hooks（interaction/annotations）经 get* 读取，保证同一实例。
 */
const shared: {
  stage: Konva.Stage | null;
  group: Konva.Group | null;
  transformer: Konva.Transformer | null;
} = {
  stage: null,
  group: null,
  transformer: null,
};

export const canvasRefs = {
  setStage: (stage: Konva.Stage | null) => {
    shared.stage = stage;
  },
  setGroup: (group: Konva.Group | null) => {
    shared.group = group;
  },
  setTransformer: (transformer: Konva.Transformer | null) => {
    shared.transformer = transformer;
  },
  getStage: () => shared.stage,
  getGroup: () => shared.group,
  getTransformer: () => shared.transformer,

  getPointerImagePos(
    stage: Konva.Stage | null,
    group: Konva.Group | null
  ): { x: number; y: number } | null {
    if (!stage || !group) {
      return null;
    }
    const pos = stage.getPointerPosition();
    if (!pos) {
      return null;
    }
    return {
      x: Math.round((pos.x - group.x()) / group.scaleX()),
      y: Math.round((pos.y - group.y()) / group.scaleY()),
    };
  },
};

export function useCanvasRefs() {
  return canvasRefs;
}

export type CanvasRefsApi = typeof canvasRefs;
