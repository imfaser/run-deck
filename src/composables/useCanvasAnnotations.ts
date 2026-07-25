import type Konva from 'konva';
import { match, P } from 'ts-pattern';
import { flatMap } from 'es-toolkit';
import type {
  PointAnnotation,
  BoxAnnotation,
  LabelMode,
  AnnotationType,
} from '@/schemas/annotation';
import { isPointInAnyBox } from '@/utils/spatialConstraint';
import { logMessage } from '@/services/cmd';

export type PendingAnnotation =
  | {
      type: 'point';
      point: PointAnnotation;
    }
  | {
      type: 'box';
      box: BoxAnnotation;
    }
  | null;

interface AnnotationObjectLike {
  id: string;
  labelId: string;
  points: Array<PointAnnotation>;
  boxes: Array<BoxAnnotation>;
}

interface AnnotationStore {
  stageScale: number;
  stagePos: { x: number; y: number };
  mode: LabelMode;
  tool: AnnotationType;
  objects: AnnotationObjectLike[];
  currentObjectId: string | null;
  selectedAnnotationId: string | null;
  addPointToObject: (objectId: string, point: PointAnnotation) => void;
  addBoxToObject: (objectId: string, box: BoxAnnotation) => void;
  updateAnnotationInObject: (id: string, data: Record<string, unknown>) => void;
  removeAnnotationFromObject: (id: string) => void;
  selectAnnotation: (id: string) => void;
  clearSelection: () => void;
  pendingAnnotation: PendingAnnotation;
  cursorScreenPos?: { x: number; y: number } | null;
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

type CanvasDimensionsInput =
  | CanvasDimensions
  | {
      image: { value: { width: number; height: number } };
      stage: { value: { width: number; height: number } };
    };

function resolveDims(input: CanvasDimensionsInput): CanvasDimensions {
  return match(input)
    .with({ image: P.select('image'), stage: P.select('stage') }, ({ image, stage }) => ({
      imageWidth: {
        get value() {
          return image.value.width;
        },
      },
      imageHeight: {
        get value() {
          return image.value.height;
        },
      },
      stageWidth: {
        get value() {
          return stage.value.width;
        },
      },
      stageHeight: {
        get value() {
          return stage.value.height;
        },
      },
    }))
    .otherwise(() => input as CanvasDimensions);
}

interface CanvasAnnotationsOptions {
  store: AnnotationStore;
  refs: StageRefs;
  dims: CanvasDimensionsInput;
  maxScale?: number;
  clampPosition?: (x: number, y: number) => { x: number; y: number };
  canCreate?: () => boolean;
}

export function useCanvasAnnotations(options: CanvasAnnotationsOptions) {
  const { store, refs, maxScale = 10, clampPosition, canCreate } = options;
  const dims = resolveDims(options.dims);
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

  function getAllAnnotationIds(): Set<string> {
    const allAnnotations = flatMap(store.objects, (o) => [...o.points, ...o.boxes]);
    return new Set(allAnnotations.map((a) => a.id));
  }

  function isOnAnnotation(target: Konva.Node): boolean {
    if (target.getParent()?.getClassName() === 'Transformer') return true;
    const name = target.name();
    const ids = getAllAnnotationIds();
    const found = name ? ids.has(name) : false;
    const attrs = target.getAttrs();
    logMessage(
      'debug',
      `[canvas] isOnAnnotation name="${name}" found=${found} class=${target.className} id=${attrs.id} nodeId=${target._id} attrsKeys=${Object.keys(attrs).join(',')}`
    );
    return found;
  }

  function handleStageClick(e: Konva.KonvaEventObject<MouseEvent>) {
    const stage = getStage();
    const transformer = getTransformer();
    if (!stage) return;
    if (canCreate && !canCreate()) return;
    if (e.target.getParent()?.getClassName() === 'Transformer') return;

    const targetName = e.target.name();
    const targetClass = e.target.className;
    const targetAttrs = e.target.getAttrs();
    const onAnnotation = isOnAnnotation(e.target);
    logMessage(
      'debug',
      `[canvas] stageClick mode=${store.mode} tool=${store.tool} target="${targetName}" class=${targetClass} onAnnotation=${onAnnotation} targetAttrs=${JSON.stringify(targetAttrs)} pending=${store.pendingAnnotation ? JSON.stringify(store.pendingAnnotation) : 'null'} objCount=${store.objects.length}`
    );

    match(store.mode)
      .with('create', () => handleCreateClick(e, stage))
      .with('select', () => {
        if (!onAnnotation) {
          store.clearSelection();
          if (transformer) transformer.nodes([]);
        }
      })
      .with('delete', () => {})
      .exhaustive();
  }

  function handleCreateClick(e: Konva.KonvaEventObject<MouseEvent>, stage: Konva.Stage) {
    match(store.tool)
      .with(P.union('p_point', 'n_point'), () => handlePointCreate(e, stage))
      .with('box', () => {})
      .exhaustive();
  }

  function handlePointCreate(_e: Konva.KonvaEventObject<MouseEvent>, stage: Konva.Stage) {
    const group = getGroup();
    if (!group) return;
    const pos = getPointerImagePos(stage, group);
    logMessage(
      'debug',
      `[canvas] pointCreate pos=${pos ? `(${Math.round(pos.x)},${Math.round(pos.y)})` : 'null'} hasClamp=${!!clampPosition} imageW=${dims.imageWidth.value} imageH=${dims.imageHeight.value} currentObjId=${store.currentObjectId}`
    );
    if (!pos) return;
    const final = clampPosition ? clampPosition(pos.x, pos.y) : pos;

    if (!store.currentObjectId) {
      store.pendingAnnotation = {
        type: 'point',
        point: {
          id: crypto.randomUUID(),
          x: final.x,
          y: final.y,
          label: store.tool === 'p_point' ? 1 : 0,
        },
      };
      if (store.cursorScreenPos) {
        const pointer = stage.getPointerPosition();
        if (pointer) store.cursorScreenPos = pointer;
      }
      return;
    }

    const currentObj = store.objects.find((o) => o.id === store.currentObjectId);
    if (currentObj && currentObj.boxes.length > 0) {
      if (!isPointInAnyBox({ x: final.x, y: final.y }, currentObj.boxes)) {
        import('element-plus').then(({ ElMessage }) => {
          ElMessage.warning('点必须在边界框内');
        });
        return;
      }
    }

    store.addPointToObject(store.currentObjectId!, {
      id: crypto.randomUUID(),
      x: final.x,
      y: final.y,
      label: store.tool === 'p_point' ? 1 : 0,
    });
  }

  function handleAnnotationClick(
    ann: PointAnnotation | BoxAnnotation,
    e: Konva.KonvaEventObject<MouseEvent>
  ) {
    const targetAttrs = e.target.getAttrs();
    logMessage(
      'debug',
      `[canvas] annClick mode=${store.mode} annId=${ann.id} targetName="${e.target.name()}" targetAttrs=${JSON.stringify(targetAttrs)} cancelBubble=${e.cancelBubble}`
    );
    match(store.mode)
      .with('select', () => {
        e.cancelBubble = true;
        const isBox = store.objects.some((o) => o.boxes.some((b) => b.id === ann.id));
        store.selectAnnotation(ann.id);
        if (isBox) {
          attachTransformer(ann.id);
        }
      })
      .with('delete', () => {
        e.cancelBubble = true;
        store.removeAnnotationFromObject(ann.id);
        const transformer = getTransformer();
        if (transformer) transformer.nodes([]);
      })
      .otherwise(() => {});
  }

  function attachTransformer(annId: string) {
    const stage = getStage();
    const transformer = getTransformer();
    if (!stage || !transformer) return;
    const node = stage.findOne('.' + annId);
    logMessage(
      'debug',
      `[canvas] box node=${!!node} nodeX=${node?.x()} nodeY=${node?.y()} nodeW=${node?.width()} nodeH=${node?.height()} transformer nodes before=${transformer.nodes().length}`
    );
    if (node) transformer.nodes([node]);
  }

  function handleDragEnd(
    ann: PointAnnotation | BoxAnnotation,
    _e: Konva.KonvaEventObject<DragEvent>
  ) {
    logMessage(
      'debug',
      `[canvas] dragEnd id=${ann.id} target=${_e.target.name()} x=${_e.target.x()} y=${_e.target.y()}`
    );
    const node = _e.target;

    if ('label' in ann) {
      store.updateAnnotationInObject(ann.id, {
        x: Math.round(node.x()),
        y: Math.round(node.y()),
      });
    } else {
      const width = ann.x2 - ann.x1;
      const height = ann.y2 - ann.y1;
      store.updateAnnotationInObject(ann.id, {
        x1: Math.round(node.x()),
        y1: Math.round(node.y()),
        x2: Math.round(node.x() + width),
        y2: Math.round(node.y() + height),
      });
    }

    const transformer = getTransformer();
    if (transformer) {
      transformer.nodes(transformer.nodes());
    }
  }

  function handleTransformEnd(e: Konva.KonvaEventObject<Event>) {
    const node = e.target;
    const annId = node.name();
    const isBox = store.objects.some((o) => o.boxes.some((b) => b.id === annId));
    if (!isBox) return;
    const width = node.width() * node.scaleX();
    const height = node.height() * node.scaleY();
    store.updateAnnotationInObject(annId, {
      x1: Math.round(node.x()),
      y1: Math.round(node.y()),
      x2: Math.round(node.x() + width),
      y2: Math.round(node.y() + height),
    });
    node.scaleX(1);
    node.scaleY(1);
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
