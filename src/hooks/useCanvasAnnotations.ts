import { match } from 'ts-pattern';
import { flatMap } from 'es-toolkit';
import { useMemoizedFn } from 'ahooks';
import type Konva from 'konva';
import { useLabel3DCanvasStore } from '@/store/label-3d-canvas';
import { isPointInAnyBox } from '@/lib/spatialConstraint';
import { logMessage } from '@/services/cmds';
import { LABELS } from '@/constants/labels';
import { canvasRefs } from './useCanvasRefs';
import { toast } from 'sonner';
import type { AnnotationObject, FrontendAnnotation } from '@/lib/annotationMapping';

interface Dims {
  stageWidth: number;
  stageHeight: number;
}

export interface UseCanvasAnnotationsOpts {
  dims: Dims;
  maxScale?: number;
  onImageClick?: () => void;
}

export function useCanvasAnnotations(options: UseCanvasAnnotationsOpts) {
  const { dims, maxScale = 10 } = options;

  function store() {
    return useLabel3DCanvasStore.getState();
  }

  function getAllAnnotationIds(): Set<string> {
    const allAnnotations = flatMap(store().objects, (o) => [...o.points, ...o.boxes]);
    return new Set(allAnnotations.map((a) => a.id));
  }

  function isOnAnnotation(target: Konva.Node): boolean {
    if (target.getParent()?.getClassName() === 'Transformer') {
      return true;
    }
    const name = target.name();
    const ids = getAllAnnotationIds();
    return name ? ids.has(name) : false;
  }

  const handleWheel = useMemoizedFn(function handleWheel(e: Konva.KonvaEventObject<WheelEvent>) {
    e.evt.preventDefault();
    const stage = canvasRefs.getStage();
    const group = canvasRefs.getGroup();
    if (!stage || !group) {
      return;
    }

    const oldScale = store().stageScale;
    const pointer = stage.getPointerPosition();
    if (!pointer) {
      return;
    }

    const mousePointTo = {
      x: (pointer.x - group.x()) / oldScale,
      y: (pointer.y - group.y()) / oldScale,
    };

    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const factor = 1.1;
    const newScale = direction > 0 ? oldScale * factor : oldScale / factor;
    const clampedScale = Math.max(0.1, Math.min(maxScale, newScale));

    store().setStageScale(clampedScale);
    store().setStagePos({
      x: pointer.x - mousePointTo.x * clampedScale,
      y: pointer.y - mousePointTo.y * clampedScale,
    });
  });

  const handlePointCreate = useMemoizedFn(function handlePointCreate(
    _e: Konva.KonvaEventObject<MouseEvent>,
    stage: Konva.Stage
  ) {
    const group = canvasRefs.getGroup();
    if (!group) {
      return;
    }
    const pos = canvasRefs.getPointerImagePos(stage, group);
    logMessage(
      'debug',
      `[canvas] pointCreate pos=${pos ? `(${Math.round(pos.x)},${Math.round(pos.y)})` : 'null'} imageW=${store().imageWidth} imageH=${store().imageHeight} currentObjId=${store().currentObjectId}`
    ).catch(() => {});
    if (!pos) {
      return;
    }

    const s = store();

    if (!s.currentObjectId) {
      s.setPendingAnnotation({
        type: 'point',
        point: {
          id: crypto.randomUUID(),
          x: pos.x,
          y: pos.y,
          label: s.tool === 'p_point' ? 1 : 0,
        },
      });
      return;
    }

    const currentObj = s.objects.find((o) => o.id === s.currentObjectId);
    if (currentObj && currentObj.boxes.length > 0) {
      if (!isPointInAnyBox({ x: pos.x, y: pos.y }, currentObj.boxes)) {
        toast.warning(LABELS.label3d.pointMustBeInBox);
        return;
      }
    }

    s.addPointToObject(s.currentObjectId, {
      id: crypto.randomUUID(),
      x: pos.x,
      y: pos.y,
      label: s.tool === 'p_point' ? 1 : 0,
    });
  });

  const handleCreateClick = useMemoizedFn(function handleCreateClick(
    e: Konva.KonvaEventObject<MouseEvent>,
    stage: Konva.Stage
  ) {
    match(store().tool)
      .with('p_point', 'n_point', () => handlePointCreate(e, stage))
      .with('box', () => {})
      .exhaustive();
  });

  const handleStageClick = useMemoizedFn(function handleStageClick(
    e: Konva.KonvaEventObject<MouseEvent>
  ) {
    const stage = canvasRefs.getStage();
    const transformer = canvasRefs.getTransformer();
    if (!stage) {
      return;
    }
    if (e.target.getParent()?.getClassName() === 'Transformer') {
      return;
    }

    const onAnnotation = isOnAnnotation(e.target);
    logMessage(
      'debug',
      `[canvas] stageClick mode=${store().mode} tool=${store().tool} target="${e.target.name()}" class=${e.target.className} onAnnotation=${onAnnotation} pending=${store().pendingAnnotation ? JSON.stringify(store().pendingAnnotation) : 'null'} objCount=${store().objects.length}`
    ).catch(() => {});

    match(store().mode)
      .with('create', () => handleCreateClick(e, stage))
      .with('select', () => {
        if (!onAnnotation) {
          store().clearSelection();
          if (transformer) {
            transformer.nodes([]);
          }
        }
      })
      .with('delete', () => {})
      .with('move', () => {})
      .exhaustive();
  });

  const isBoxAnnotation = (objects: AnnotationObject[], id: string): boolean =>
    objects.some((o) => o.boxes.some((b) => b.id === id));

  const attachTransformer = (annId: string) => {
    const stage = canvasRefs.getStage();
    const transformer = canvasRefs.getTransformer();
    if (!stage || !transformer) {
      return;
    }
    const node = stage.findOne('.' + annId);
    logMessage('debug', `[canvas] box node=${!!node}`).catch(() => {});
    if (node) {
      transformer.nodes([node]);
    }
  };

  const handleAnnotationClick = useMemoizedFn(function handleAnnotationClick(
    ann: FrontendAnnotation,
    e: Konva.KonvaEventObject<MouseEvent>
  ) {
    logMessage(
      'debug',
      `[canvas] annClick mode=${store().mode} annId=${ann.id} targetName="${e.target.name()}"`
    ).catch(() => {});
    match(store().mode)
      .with('select', () => {
        e.cancelBubble = true;
        const isBox = isBoxAnnotation(store().objects, ann.id);
        store().selectAnnotation(ann.id);
        if (isBox) {
          attachTransformer(ann.id);
        }
      })
      .with('delete', () => {
        e.cancelBubble = true;
        store().removeAnnotationFromObject(ann.id);
        const transformer = canvasRefs.getTransformer();
        if (transformer) {
          transformer.nodes([]);
        }
      })
      .otherwise(() => {});
  });

  const handleDragEnd = useMemoizedFn(function handleDragEnd(
    ann: FrontendAnnotation,
    e: Konva.KonvaEventObject<DragEvent>
  ) {
    logMessage('debug', `[canvas] dragEnd id=${ann.id} x=${e.target.x()} y=${e.target.y()}`).catch(
      () => {}
    );
    const node = e.target;

    if ('label' in ann) {
      store().updateAnnotationInObject(ann.id, {
        x: Math.round(node.x()),
        y: Math.round(node.y()),
      });
    } else {
      const width = ann.x2 - ann.x1;
      const height = ann.y2 - ann.y1;
      store().updateAnnotationInObject(ann.id, {
        x1: Math.round(node.x()),
        y1: Math.round(node.y()),
        x2: Math.round(node.x() + width),
        y2: Math.round(node.y() + height),
      });
    }

    const transformer = canvasRefs.getTransformer();
    if (transformer) {
      transformer.nodes(transformer.nodes());
    }
  });

  const handleTransformEnd = useMemoizedFn(function handleTransformEnd(
    e: Konva.KonvaEventObject<Event>
  ) {
    const node = e.target;
    const annId = node.name();
    const isBox = store().objects.some((o) => o.boxes.some((b) => b.id === annId));
    if (!isBox) {
      return;
    }
    const width = node.width() * node.scaleX();
    const height = node.height() * node.scaleY();
    store().updateAnnotationInObject(annId, {
      x1: Math.round(node.x()),
      y1: Math.round(node.y()),
      x2: Math.round(node.x() + width),
      y2: Math.round(node.y() + height),
    });
    node.scaleX(1);
    node.scaleY(1);
  });

  const fitToImage = useMemoizedFn(function fitToImage() {
    const s = store();
    if (!s.imageWidth || !s.imageHeight) {
      return;
    }
    // 小图放大：以画布 75% 为基准，取 min(scaleX, scaleY) 再乘 0.75，
    // 大图缩小：同样收敛到窗口 75% 内，保证任何尺寸都"适配"。
    const padding = 40;
    const availW = dims.stageWidth - padding * 2;
    const availH = dims.stageHeight - padding * 2;
    const scaleX = availW / s.imageWidth;
    const scaleY = availH / s.imageHeight;
    const scale = Math.min(scaleX, scaleY) * 0.75;
    s.setStageScale(scale);
    s.setStagePos({
      x: (dims.stageWidth - s.imageWidth * scale) / 2,
      y: (dims.stageHeight - s.imageHeight * scale) / 2,
    });
  });

  const getAnnotationById = useMemoizedFn(function getAnnotationById(
    id: string
  ): { object: AnnotationObject; ann: FrontendAnnotation } | null {
    for (const obj of store().objects) {
      const p = obj.points.find((pt) => pt.id === id);
      if (p) {
        return { object: obj, ann: p };
      }
      const b = obj.boxes.find((bx) => bx.id === id);
      if (b) {
        return { object: obj, ann: b };
      }
    }
    return null;
  });

  // 所有回调均为 useMemoizedFn（引用恒定），直接返回稳定对象，无需 useMemo
  return {
    handleWheel,
    handleStageClick,
    handleAnnotationClick,
    handleDragEnd,
    handleTransformEnd,
    fitToImage,
    getAnnotationById,
  };
}
