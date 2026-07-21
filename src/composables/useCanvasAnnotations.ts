import type Konva from 'konva';
import { match } from 'ts-pattern';
import type { Annotation } from '@/schemas/annotation';

interface AnnotationStore {
  stageScale: number;
  stagePos: { x: number; y: number };
  mode: string;
  tool: string;
  annotations: Array<{ id: string; type: string; [key: string]: unknown }>;
  addAnnotation: (ann: Annotation) => void;
  updateAnnotation: (id: string, data: Record<string, unknown>) => void;
  removeAnnotation: (id: string) => void;
  selectAnnotation: (id: string) => void;
  clearSelection: () => void;
}

interface StageRefs {
  getStage: () => Konva.Stage | undefined;
  getGroup: () => Konva.Group | undefined;
  getTransformer: () => Konva.Transformer | undefined;
  getPointerImagePos: (
    stage: Konva.Stage,
    group: Konva.Group
  ) => { x: number; y: number } | undefined;
}

interface CanvasDimensions {
  imageWidth: { value: number };
  imageHeight: { value: number };
  stageWidth: { value: number };
  stageHeight: { value: number };
}

interface CanvasAnnotationsOptions {
  store: AnnotationStore;
  refs: StageRefs;
  dims: CanvasDimensions;
  maxScale?: number;
  clampPosition?: (x: number, y: number) => { x: number; y: number };
  canCreate?: () => boolean;
}

export function useCanvasAnnotations(options: CanvasAnnotationsOptions) {
  const { store, refs, dims, maxScale = 10, clampPosition, canCreate } = options;
  const { getStage, getGroup, getTransformer, getPointerImagePos } = refs;

  function handleWheel(e: Konva.KonvaEventObject<WheelEvent>) {
    e.evt.preventDefault();
    const stage = getStage();
    const group = getGroup();
    if (!stage || !group) return;

    const oldScale = store.stageScale;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const mousePointTo = {
      x: (pointer.x - group.x()) / oldScale,
      y: (pointer.y - group.y()) / oldScale,
    };

    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const factor = 1.1;
    const newScale = direction > 0 ? oldScale * factor : oldScale / factor;
    const clampedScale = Math.max(0.1, Math.min(maxScale, newScale));

    store.stageScale = clampedScale;
    store.stagePos = {
      x: pointer.x - mousePointTo.x * clampedScale,
      y: pointer.y - mousePointTo.y * clampedScale,
    };
  }

  function isOnAnnotation(target: Konva.Node): boolean {
    if (target.getParent()?.getClassName() === 'Transformer') return true;
    const name = target.name();
    if (name && store.annotations.some((a) => a.id === name)) return true;
    return false;
  }

  function handleStageClick(e: Konva.KonvaEventObject<MouseEvent>) {
    const stage = getStage();
    const transformer = getTransformer();
    if (!stage) return;
    if (canCreate && !canCreate()) return;
    if (e.target.getParent()?.getClassName() === 'Transformer') return;

    if (store.mode === 'create') {
      if (store.tool === 'p_point' || store.tool === 'n_point') {
        const group = getGroup();
        if (!group) return;
        const pos = getPointerImagePos(stage, group);
        if (!pos) return;
        const final = clampPosition ? clampPosition(pos.x, pos.y) : pos;
        store.addAnnotation({
          id: crypto.randomUUID(),
          type: store.tool,
          x: final.x,
          y: final.y,
        });
      }
      return;
    }

    if (isOnAnnotation(e.target)) {
      if (store.mode === 'delete') {
        const ann = store.annotations.find((a) => a.id === e.target.name());
        if (ann) {
          store.removeAnnotation(ann.id);
          if (transformer) transformer.nodes([]);
        }
      }
      return;
    }

    match(store.mode)
      .with('select', () => {
        store.clearSelection();
        if (transformer) transformer.nodes([]);
      })
      .otherwise(() => {});
  }

  function handleAnnotationClick(
    ann: { id: string; type: string; [key: string]: unknown },
    e: Konva.KonvaEventObject<MouseEvent>
  ) {
    if (store.mode === 'select') {
      e.cancelBubble = true;
      store.selectAnnotation(ann.id);
      match(ann.type)
        .with('box', () => {
          const stage = getStage();
          const transformer = getTransformer();
          if (!stage || !transformer) return;
          const node = stage.findOne('.' + ann.id);
          if (node) transformer.nodes([node]);
        })
        .otherwise(() => {});
    } else if (store.mode === 'delete') {
      e.cancelBubble = true;
      store.removeAnnotation(ann.id);
      const transformer = getTransformer();
      if (transformer) transformer.nodes([]);
    }
  }

  function handleDragEnd(
    ann: { id: string; type: string; [key: string]: unknown },
    e: Konva.KonvaEventObject<DragEvent>
  ) {
    const node = e.target;
    match(ann.type)
      .with('p_point', 'n_point', () => {
        store.updateAnnotation(ann.id, { x: Math.round(node.x()), y: Math.round(node.y()) });
      })
      .with('box', () => {
        const width = node.width() * node.scaleX();
        const height = node.height() * node.scaleY();
        store.updateAnnotation(ann.id, {
          x1: Math.round(node.x()),
          y1: Math.round(node.y()),
          x2: Math.round(node.x() + width),
          y2: Math.round(node.y() + height),
        });
      })
      .otherwise(() => {});
  }

  function handleTransformEnd(e: Konva.KonvaEventObject<Event>) {
    const node = e.target;
    const ann = store.annotations.find((a) => a.id === node.name());
    if (!ann) return;
    match(ann.type)
      .with('box', () => {
        const width = node.width() * node.scaleX();
        const height = node.height() * node.scaleY();
        store.updateAnnotation(ann.id, {
          x1: Math.round(node.x()),
          y1: Math.round(node.y()),
          x2: Math.round(node.x() + width),
          y2: Math.round(node.y() + height),
        });
        node.scaleX(1);
        node.scaleY(1);
      })
      .otherwise(() => {});
  }

  function fitToImage() {
    if (!dims.imageWidth.value || !dims.imageHeight.value) return;
    const padding = 40;
    const availW = dims.stageWidth.value - padding * 2;
    const availH = dims.stageHeight.value - padding * 2;
    const scaleX = availW / dims.imageWidth.value;
    const scaleY = availH / dims.imageHeight.value;
    const scale = Math.min(scaleX, scaleY, 1);
    store.stageScale = scale;
    store.stagePos = {
      x: (dims.stageWidth.value - dims.imageWidth.value * scale) / 2,
      y: (dims.stageHeight.value - dims.imageHeight.value * scale) / 2,
    };
  }

  return {
    handleWheel,
    isOnAnnotation,
    handleStageClick,
    handleAnnotationClick,
    handleDragEnd,
    handleTransformEnd,
    fitToImage,
  };
}
