import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useMount, useUpdateEffect } from 'ahooks';
import { Stage, Layer, Group, Image as KImage, Circle, Rect, Transformer } from 'react-konva';
import type Konva from 'konva';
import { match, P } from 'ts-pattern';
import { useLabel3DCanvasStore } from '@/store/label-3d-canvas';
import { canvasRefs } from '@/hooks/useCanvasRefs';
import { useCanvasAnnotations } from '@/hooks/useCanvasAnnotations';
import { useLabels } from '@/hooks/useLabels';
import { getPointConfig, getBoxConfig } from '@/lib/annotationConfig';
import { toRenderableUrl } from '@/lib/url';
import type { AnnotationObject } from '@/lib/annotationMapping';
import type { CanvasInteractionApi } from '@/hooks/useCanvasInteraction';

export interface Label3DCanvasProps {
  canEdit?: boolean;
  sliceImageUrl?: string | null;
  interaction: CanvasInteractionApi;
}

/** react-konva 需要 HTMLImageElement 而非 URL。 */
function useKonvaImage(src: string | null): HTMLImageElement | null {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!src) {
      setImage(null);
      return;
    }
    const renderable = toRenderableUrl(src);
    const img = new window.Image();
    img.onload = () => setImage(img);
    img.onerror = () => setImage(null);
    img.src = renderable;
    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [src]);

  return image;
}

export function Label3DCanvas({ canEdit = true, sliceImageUrl, interaction }: Label3DCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
  const groupRef = useRef<Konva.Group | null>(null);
  const transformerRef = useRef<Konva.Transformer | null>(null);
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });

  const objects = useLabel3DCanvasStore((s) => s.objects);
  const selectedAnnotationId = useLabel3DCanvasStore((s) => s.selectedAnnotationId);
  const mode = useLabel3DCanvasStore((s) => s.mode);
  const stagePos = useLabel3DCanvasStore((s) => s.stagePos);
  const stageScale = useLabel3DCanvasStore((s) => s.stageScale);
  const imageWidth = useLabel3DCanvasStore((s) => s.imageWidth);
  const imageHeight = useLabel3DCanvasStore((s) => s.imageHeight);
  const pendingAnnotation = useLabel3DCanvasStore((s) => s.pendingAnnotation);
  const fitImageTrigger = useLabel3DCanvasStore((s) => s.fitImageTrigger);
  const { data: labels } = useLabels();

  const baseImage = useKonvaImage(sliceImageUrl ?? null);

  const {
    fitToImage,
    handleAnnotationClick,
    handleDragEnd,
    handleTransformEnd,
    handleWheel,
    handleStageClick,
  } = useCanvasAnnotations({
    dims: { stageWidth: stageSize.width, stageHeight: stageSize.height },
    maxScale: 5,
  });

  // 注册共享 refs
  useMount(() => {
    canvasRefs.setStage(stageRef.current);
    canvasRefs.setGroup(groupRef.current);
    canvasRefs.setTransformer(transformerRef.current);
  });

  // 图像加载后同步尺寸到 store + 每次进入自动 fit 一次（跳过首次 baseImage=null）
  useUpdateEffect(() => {
    if (baseImage && baseImage.width && baseImage.height) {
      const s = useLabel3DCanvasStore.getState();
      s.setImageDimensions(baseImage.width, baseImage.height);
      s.setFitImageTrigger();
    }
  }, [baseImage]);

  // 画布尺寸自适应
  useEffect(() => {
    const el = containerRef.current;
    if (!el) {
      return;
    }
    const ro = new ResizeObserver(([entry]) => {
      if (!entry) {
        return;
      }
      setStageSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 选中框时挂载 Transformer（仅对 box，点不做）
  useLayoutEffect(() => {
    const tr = transformerRef.current;
    const stage = stageRef.current;
    if (!tr || !stage) {
      return;
    }
    if (!selectedAnnotationId) {
      tr.nodes([]);
      return;
    }
    const isBox = objects.some((o) => o.boxes.some((b) => b.id === selectedAnnotationId));
    if (!isBox) {
      tr.nodes([]);
      return;
    }
    const node = stage.findOne('.' + selectedAnnotationId);
    if (node) {
      tr.nodes([node]);
    } else {
      tr.nodes([]);
    }
  }, [selectedAnnotationId, objects]);

  // fitImageTrigger → 适应图像
  useEffect(() => {
    if (fitImageTrigger > 0) {
      fitToImage();
    }
  }, [fitImageTrigger, fitToImage]);

  const tempBox = interaction.snapshot.context.tempBox;
  const tempBoxVisible = canEdit && tempBox && (tempBox.w > 0 || tempBox.h > 0);

  const pendingBox = match(pendingAnnotation)
    .with({ type: 'box', box: P.select() }, (b) => b)
    .otherwise(() => null);

  // Visual boxes: 所有 box_type=Visual 的框（单独渲染）
  const visualBoxes = objects.flatMap((obj) =>
    obj.boxes.filter((b) => b.boxType === 'visual_ref').map((box) => ({ box, obj }))
  );

  const selectedColor = (obj: AnnotationObject): string => {
    const label = (labels ?? []).find((l) => l.id === obj.labelId);
    return label?.color ?? '#888';
  };

  function renderPoint(obj: AnnotationObject, point: (typeof obj.points)[number]) {
    const cfg = getPointConfig(
      { x: point.x, y: point.y, sign: point.label as 0 | 1 },
      selectedAnnotationId === point.id
    );
    return (
      <Circle
        key={point.id}
        name={point.id}
        x={cfg.x}
        y={cfg.y}
        radius={cfg.radius}
        fill={cfg.fill}
        stroke={cfg.stroke}
        strokeWidth={cfg.strokeWidth}
        shadowColor={cfg.shadowColor}
        shadowBlur={cfg.shadowBlur}
        shadowOpacity={cfg.shadowOpacity}
        hitStrokeWidth={cfg.hitStrokeWidth}
        scaleX={1 / stageScale}
        scaleY={1 / stageScale}
        draggable={canEdit && mode === 'select'}
        listening={canEdit}
        onClick={(e) => handleAnnotationClick(point, e)}
        onDragEnd={(e) => handleDragEnd(point, e)}
      />
    );
  }

  function renderBox(obj: AnnotationObject, box: (typeof obj.boxes)[number]) {
    const cfg = getBoxConfig(box, selectedAnnotationId === box.id, selectedColor(obj));
    return (
      <Rect
        key={box.id}
        name={box.id}
        x={cfg.x}
        y={cfg.y}
        width={cfg.width}
        height={cfg.height}
        stroke={cfg.stroke}
        strokeWidth={cfg.strokeWidth}
        strokeScaleEnabled={false}
        dash={cfg.dash}
        fill={cfg.fill}
        hitStrokeWidth={cfg.hitStrokeWidth}
        draggable={canEdit && mode === 'select'}
        listening={canEdit}
        onClick={(e) => handleAnnotationClick(box, e)}
        onDragEnd={(e) => handleDragEnd(box, e)}
        onTransformEnd={handleTransformEnd}
      />
    );
  }

  return (
    <div ref={containerRef} className="size-full overflow-hidden">
      <Stage
        ref={stageRef}
        width={stageSize.width}
        height={stageSize.height}
        style={{ cursor: interaction.cursorStyle }}
        onMouseDown={interaction.handleStageMouseDown}
        onMouseMove={interaction.handleStageMouseMove}
        onMouseUp={interaction.handleStageMouseUp}
        onWheel={handleWheel}
        onClick={handleStageClick}
      >
        <Layer>
          <Group
            ref={groupRef}
            name="annotation-group"
            x={stagePos.x}
            y={stagePos.y}
            scaleX={stageScale}
            scaleY={stageScale}
          >
            {baseImage && (
              <KImage
                image={baseImage}
                width={imageWidth || baseImage.width}
                height={imageHeight || baseImage.height}
              />
            )}

            {objects.map((obj) => (
              <Group key={obj.id}>
                {obj.points.map((p) => renderPoint(obj, p))}
                {obj.boxes.filter((b) => b.boxType !== 'visual_ref').map((b) => renderBox(obj, b))}
              </Group>
            ))}

            {visualBoxes.map(({ box, obj }) => (
              <Group key={box.id}>{renderBox(obj, box)}</Group>
            ))}

            {tempBoxVisible && (
              <Rect
                x={tempBox.x}
                y={tempBox.y}
                width={tempBox.w}
                height={tempBox.h}
                stroke="#e6a23c"
                strokeWidth={2}
                strokeScaleEnabled={false}
                fill="transparent"
                listening={false}
              />
            )}
            {pendingBox && (
              <Rect
                x={pendingBox.x1}
                y={pendingBox.y1}
                width={pendingBox.x2 - pendingBox.x1}
                height={pendingBox.y2 - pendingBox.y1}
                stroke="#e6a23c"
                strokeWidth={2}
                strokeScaleEnabled={false}
                fill="rgba(234, 179, 8, 0.08)"
                listening={false}
              />
            )}
          </Group>

          <Transformer
            ref={transformerRef}
            name="transformer-handle"
            flipEnabled={false}
            boundBoxFunc={(oldBox, newBox) => {
              if (Math.abs(newBox.width) < 5 || Math.abs(newBox.height) < 5) {
                return oldBox;
              }
              return newBox;
            }}
          />
        </Layer>
      </Stage>
    </div>
  );
}
