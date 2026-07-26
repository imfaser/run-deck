<script setup lang="ts">
  import { ref, computed, watch, onUnmounted } from 'vue';
  import { useImage } from 'vue-konva';
  import {
    Stage as VStage,
    Layer as VLayer,
    Group as VGroup,
    Image as VImage,
    Circle as VCircle,
    Rect as VRect,
    Transformer as VTransformer,
  } from 'vue-konva';
  import { useResizeObserver, useEventListener } from '@vueuse/core';
  import Konva from 'konva';
  import { match, P } from 'ts-pattern';
  import { clamp } from 'es-toolkit';
  import { useLabel2dCanvasStore } from '@/stores/canvas-2d';
  import { useLabel2dStore } from '@/stores/label-2d';
  import { useLabel2dDefStore } from '@/stores/label-def-2d';
  import { getPointerImagePos } from '@/utils/coordTransform';
  import { getPointConfig, getBoxConfig } from '@/utils/annotationConfig';
  import { useCanvasInteraction } from '@/composables/useCanvasInteraction';
  import { useCanvasAnnotations } from '@/composables/useCanvasAnnotations';
  import { useCanvasRefs } from '@/composables/useCanvasRefs';

  const canvas = useLabel2dCanvasStore();
  const label2d = useLabel2dStore();
  const labelDefStore = useLabel2dDefStore();

  // Watch for visual box creation and update config
  watch(
    () => canvas.objects.filter((o) => o.boxes.some((b) => b.boxType === 'visual_ref')),
    (visualBoxes) => {
      if (visualBoxes.length > 0) {
        for (const config of labelDefStore.locateConfigs) {
          if (config.visualType === 'slice_crop') {
            labelDefStore.updateLocateConfig(config.labelId, {
              visualRefObjectId: visualBoxes[0].id,
            });
          }
        }
      }
    },
    { deep: true }
  );
  const containerRef = ref<HTMLDivElement | null>(null);
  const stageRef = ref<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const stage = ref({ width: 800, height: 600 });
  const image = ref({ width: 0, height: 0 });
  const mask = ref({ width: 0, height: 0 });

  const { getStage, getGroup, getTransformer, getLayer } = useCanvasRefs(stageRef);

  const {
    snapshot,
    send,
    cursorStyle,
    handleStageMouseDown: machineMouseDown,
    handleStageMouseMove: machineMouseMove,
    handleStageMouseUp: machineMouseUp,
    handleKeyDown,
    handleKeyUp,
  } = useCanvasInteraction({
    store: canvas,
    refs: {
      getStage: () =>
        getStage() as unknown as { container: () => { style: { cursor: string } } } | null,
      getGroup: () => getGroup() as unknown as { x: () => number; y: () => number } | null,
      getPointerImagePos: (s: unknown, g: unknown) =>
        getPointerImagePos(s as Konva.Stage, g as Konva.Group),
    },
  });

  watch(
    () => canvas.pendingAnnotation,
    (val) => {
      if (!val) send({ type: 'CLEAR_TEMP_BOX' });
    }
  );

  const [baseImage] = useImage(computed(() => label2d.imageUrl ?? ''));
  const [maskImage] = useImage(computed(() => label2d.maskUrl ?? ''));

  function clampToImage(x: number, y: number) {
    return {
      x: clamp(x, 0, image.value.width),
      y: clamp(y, 0, image.value.height),
    };
  }

  const {
    handleWheel,
    handleStageClick,
    handleAnnotationClick,
    handleDragEnd,
    handleTransformEnd,
    fitToImage,
  } = useCanvasAnnotations({
    store: canvas,
    refs: {
      getStage: () => getStage() as unknown as Konva.Stage | undefined,
      getGroup: () => getGroup() as unknown as Konva.Group | undefined,
      getTransformer: () => getTransformer() as unknown as Konva.Transformer | undefined,
      getPointerImagePos: (s, g) =>
        getPointerImagePos(s as Konva.Stage, g as Konva.Group) as {
          x: number;
          y: number;
        },
    },
    dims: { image, stage },
    clampPosition: clampToImage,
    canCreate: () => image.value.width > 0 && image.value.height > 0,
  });

  const groupConfig = computed(() => ({
    name: 'annotation-group',
    x: canvas.stagePos.x,
    y: canvas.stagePos.y,
    scaleX: canvas.stageScale,
    scaleY: canvas.stageScale,
  }));

  const tempBoxConfig = computed(() => {
    const box = snapshot.value.context.tempBox;
    if (!box) return {};
    return {
      x: box.x,
      y: box.y,
      width: box.w,
      height: box.h,
      stroke: '#e6a23c',
      strokeWidth: 2,
      strokeScaleEnabled: false,
      fill: 'transparent',
      listening: false,
    };
  });

  const pendingBoxConfig = computed(() =>
    match(canvas.pendingAnnotation)
      .with({ type: 'box', box: P.select() }, (b) => ({
        x: b.x1,
        y: b.y1,
        width: b.x2 - b.x1,
        height: b.y2 - b.y1,
        stroke: '#e6a23c',
        strokeWidth: 2,
        strokeScaleEnabled: false,
        fill: 'rgba(234, 179, 8, 0.08)',
        listening: false,
      }))
      .otherwise(() => null)
  );

  watch(baseImage, (img) => {
    if (img) {
      image.value = { width: img.width, height: img.height };
      canvas.imageWidth = img.width;
      canvas.imageHeight = img.height;
    }
  });

  watch(maskImage, (img) => {
    if (img) {
      mask.value = { width: img.width, height: img.height };
    }
  });

  useEventListener(window, 'keydown', handleKeyDown);
  useEventListener(window, 'keyup', handleKeyUp);

  watch(
    () => canvas.fitImageTrigger,
    () => fitToImage()
  );

  onUnmounted(() => {
    const s = getStage();
    if (s) {
      s.destroyChildren();
      s.destroy();
    }
  });

  useResizeObserver(containerRef, (entries) => {
    const entry = entries[0];
    if (!entry) return;
    stage.value = { width: entry.contentRect.width, height: entry.contentRect.height };
    getLayer()?.batchDraw();
  });

  function handleStageMouseDown(e: Konva.KonvaEventObject<MouseEvent>) {
    if (canvas.mode === 'create' && (image.value.width === 0 || image.value.height === 0)) return;
    machineMouseDown({ evt: e.evt });
  }

  function handleStageMouseMove(e: Konva.KonvaEventObject<MouseEvent>) {
    machineMouseMove({ evt: e.evt });
    const s = getStage();
    if (s) {
      const pos = s.getPointerPosition();
      if (pos) canvas.cursorScreenPos = pos;
    }
  }

  function handleStageMouseUp(_e: Konva.KonvaEventObject<MouseEvent>) {
    machineMouseUp();
    const s = getStage();
    if (s) {
      const pos = s.getPointerPosition();
      if (pos) canvas.cursorScreenPos = pos;
    }
  }

  defineExpose({ fitToImage });

  const visualBoxes = computed(() => {
    return canvas.objects
      .filter((obj) => obj.boxes.some((b) => b.boxType === 'visual_ref'))
      .flatMap((obj) => obj.boxes.map((box) => ({ box, obj })));
  });
</script>

<template>
  <div ref="containerRef" class="label-canvas-container">
    <v-stage
      ref="stageRef"
      :config="{ width: stage.width, height: stage.height }"
      :style="{ cursor: cursorStyle }"
      @mousedown="handleStageMouseDown"
      @mousemove="handleStageMouseMove"
      @mouseup="handleStageMouseUp"
      @wheel="handleWheel"
      @click="handleStageClick"
    >
      <v-layer>
        <v-group :config="groupConfig">
          <v-image
            v-if="baseImage"
            :config="{ image: baseImage, width: image.width, height: image.height }"
          />
          <v-image
            v-if="maskImage && label2d.maskVisible"
            :config="{
              image: maskImage,
              width: mask.width,
              height: mask.height,
              opacity: label2d.maskSettings.opacity,
            }"
          />
          <template v-for="obj in canvas.objects" :key="obj.id">
            <template v-if="!obj.boxes.some((b) => b.boxType === 'visual_ref')">
              <v-circle
                v-for="ann in obj.points"
                :key="ann.id"
                :config="{
                  ...getPointConfig(
                    ann,
                    canvas.selectedAnnotationId === ann.id,
                    labelDefStore.labelById(obj.labelId)?.color ?? '#888'
                  ),
                  draggable: canvas.mode === 'select',
                }"
                @click="(e: Konva.KonvaEventObject<MouseEvent>) => handleAnnotationClick(ann, e)"
                @dragend="(e: Konva.KonvaEventObject<DragEvent>) => handleDragEnd(ann, e)"
              />
              <v-rect
                v-for="ann in obj.boxes"
                :key="ann.id"
                :config="{
                  ...getBoxConfig(
                    ann,
                    canvas.selectedAnnotationId === ann.id,
                    labelDefStore.labelById(obj.labelId)?.color ?? '#888'
                  ),
                  draggable: canvas.mode === 'select',
                }"
                @click="(e: Konva.KonvaEventObject<MouseEvent>) => handleAnnotationClick(ann, e)"
                @dragend="(e: Konva.KonvaEventObject<DragEvent>) => handleDragEnd(ann, e)"
                @transformend="handleTransformEnd"
              />
            </template>
          </template>
          <!-- Visual Box rendering (dashed, purple) -->
          <v-rect
            v-for="{ box } in visualBoxes"
            :key="box.id"
            :config="{
              x: box.x1,
              y: box.y1,
              width: box.x2 - box.x1,
              height: box.y2 - box.y1,
              stroke: '#8b5cf6',
              strokeWidth: 2,
              strokeDashEnabled: true,
              strokeDash: [8, 4],
              strokeScaleEnabled: false,
              fill: 'rgba(139, 92, 246, 0.08)',
              draggable: canvas.mode === 'select',
            }"
            @click="(e: Konva.KonvaEventObject<MouseEvent>) => handleAnnotationClick(box, e)"
            @dragend="(e: Konva.KonvaEventObject<DragEvent>) => handleDragEnd(box, e)"
            @transformend="handleTransformEnd"
          />
          <v-rect v-if="tempBoxConfig.stroke" :config="tempBoxConfig" />
          <v-rect v-if="pendingBoxConfig" :config="pendingBoxConfig" />
          <v-transformer :config="{ name: 'transformer-handle' }" />
        </v-group>
      </v-layer>
    </v-stage>
  </div>
</template>

<style scoped lang="scss">
  .label-canvas-container {
    width: 100%;
    height: 100%;
    overflow: hidden;
  }
</style>
