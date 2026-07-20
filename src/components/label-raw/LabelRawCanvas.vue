<script setup lang="ts">
  import { ref, computed, watch, onUnmounted } from 'vue';
  import { useImage } from 'vue-konva';
  import { useResizeObserver, useEventListener } from '@vueuse/core';
  import Konva from 'konva';
  import { clamp } from 'es-toolkit';
  import { match } from 'ts-pattern';
  import { useLabelRawStore } from '@/stores/label-raw';
  import { getPointerImagePos } from '@/utils/coordTransform';
  import { getPointConfig, getBoxConfig } from '@/utils/annotationConfig';

  const store = useLabelRawStore();

  const containerRef = ref<HTMLDivElement | null>(null);
  const stageRef = ref<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const stageWidth = ref(800);
  const stageHeight = ref(600);

  const isSpaceDown = ref(false);
  const isPanning = ref(false);
  const panStart = ref({ x: 0, y: 0 });
  const groupStart = ref({ x: 0, y: 0 });

  const isDrawingBox = ref(false);
  const boxStart = ref<{ x: number; y: number } | null>(null);
  const tempBox = ref<{ x: number; y: number; width: number; height: number } | null>(null);

  const imageWidth = ref(0);
  const imageHeight = ref(0);
  const maskWidth = ref(0);
  const maskHeight = ref(0);

  const [baseImage] = useImage(computed(() => store.sliceImageUrl ?? ''));

  const currentMaskVisible = computed(() => {
    const kf = store.currentKeyframe;
    return kf ? kf.maskVisible : false;
  });
  const [maskImage] = useImage(computed(() => store.currentMaskUrl ?? ''));

  const groupConfig = computed(() => ({
    name: 'annotation-group',
    x: store.stagePos.x,
    y: store.stagePos.y,
    scaleX: store.stageScale,
    scaleY: store.stageScale,
  }));

  const tempBoxConfig = computed(() => {
    if (!tempBox.value) return {};
    return {
      x: tempBox.value.x,
      y: tempBox.value.y,
      width: tempBox.value.width,
      height: tempBox.value.height,
      stroke: '#eab308',
      strokeWidth: 2,
      strokeScaleEnabled: false,
      fill: 'transparent',
    };
  });

  const cursorStyle = computed(() => {
    if (isSpaceDown.value || isPanning.value) return 'grab';
    return match(store.mode)
      .with('create', () => 'crosshair')
      .with('delete', () => 'not-allowed')
      .otherwise(() => 'default');
  });

  watch(baseImage, (img) => {
    if (img) {
      imageWidth.value = img.width;
      imageHeight.value = img.height;
    }
  });

  watch(maskImage, (img) => {
    if (img) {
      maskWidth.value = img.width;
      maskHeight.value = img.height;
    }
  });

  useEventListener(window, 'keydown', handleKeyDown);
  useEventListener(window, 'keyup', handleKeyUp);

  onUnmounted(() => {
    const stage = getStage();
    if (stage) {
      stage.destroyChildren();
      stage.destroy();
    }
  });

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

  useResizeObserver(containerRef, (entries) => {
    const entry = entries[0];
    if (!entry) return;
    stageWidth.value = entry.contentRect.width;
    stageHeight.value = entry.contentRect.height;
    getLayer()?.batchDraw();
  });

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
    const clampedScale = Math.max(0.1, Math.min(10, newScale));

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

  function handleStageMouseDown(e: Konva.KonvaEventObject<MouseEvent>) {
    const evt = e.evt;

    if (isSpaceDown.value || evt.button === 1) {
      isPanning.value = true;
      panStart.value = { x: evt.clientX, y: evt.clientY };
      groupStart.value = { ...store.stagePos };
      const stage = getStage();
      if (stage) stage.container().style.cursor = 'grabbing';
      return;
    }

    if (store.mode === 'create' && store.tool === 'box') {
      if (isOnAnnotation(e.target)) return;
      const group = getGroup();
      if (!group) return;
      const pos = getPointerImagePos(getStage()!, group);
      if (!pos) return;

      isDrawingBox.value = true;
      boxStart.value = pos;
      tempBox.value = { x: pos.x, y: pos.y, width: 0, height: 0 };
    }
  }

  function handleStageMouseMove(e: Konva.KonvaEventObject<MouseEvent>) {
    const evt = e.evt;
    const group = getGroup();
    const stage = getStage();
    if (!group || !stage) return;

    const imgPos = getPointerImagePos(stage, group);
    store.cursorImagePos = imgPos;

    if (isPanning.value) {
      const dx = evt.clientX - panStart.value.x;
      const dy = evt.clientY - panStart.value.y;
      store.stagePos = {
        x: groupStart.value.x + dx,
        y: groupStart.value.y + dy,
      };
      return;
    }

    if (isDrawingBox.value && boxStart.value && tempBox.value) {
      const pos = getPointerImagePos(stage, group);
      if (!pos) return;
      tempBox.value = {
        x: Math.min(boxStart.value.x, pos.x),
        y: Math.min(boxStart.value.y, pos.y),
        width: Math.abs(pos.x - boxStart.value.x),
        height: Math.abs(pos.y - boxStart.value.y),
      };
    }
  }

  function handleStageMouseUp() {
    if (isPanning.value) {
      isPanning.value = false;
      const stage = getStage();
      if (stage) stage.container().style.cursor = 'default';
      return;
    }

    if (isDrawingBox.value && tempBox.value) {
      const { x, y, width, height } = tempBox.value;
      if (width > 2 && height > 2) {
        const tl = clampToImage(x, y);
        const br = clampToImage(x + width, y + height);
        store.addAnnotation({
          id: crypto.randomUUID(),
          type: 'box',
          x1: Math.round(tl.x),
          y1: Math.round(tl.y),
          x2: Math.round(br.x),
          y2: Math.round(br.y),
        });
      }
      tempBox.value = null;
      boxStart.value = null;
      isDrawingBox.value = false;
    }
  }

  function clampToImage(x: number, y: number) {
    return {
      x: clamp(x, 0, imageWidth.value),
      y: clamp(y, 0, imageHeight.value),
    };
  }

  function handleStageClick(e: Konva.KonvaEventObject<MouseEvent>) {
    const stage = getStage();
    const transformer = getTransformer();
    if (!stage) return;
    if (!store.hasVolume) return;

    if (e.target.getParent()?.getClassName() === 'Transformer') return;

    if (store.mode === 'create') {
      if (store.tool === 'p_point' || store.tool === 'n_point') {
        const group = getGroup();
        if (!group) return;
        const pos = getPointerImagePos(stage, group);
        if (!pos) return;

        const clamped = clampToImage(pos.x, pos.y);
        store.addAnnotation({
          id: crypto.randomUUID(),
          type: store.tool,
          x: clamped.x,
          y: clamped.y,
        });
      }
      return;
    }

    if (isOnAnnotation(e.target)) return;

    match(store.mode)
      .with('select', () => {
        store.clearSelection();
        if (transformer) transformer.nodes([]);
      })
      .otherwise(() => {});
  }

  function handleAnnotationClick(
    ann: { id: string; type: string },
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
          if (node) {
            transformer.nodes([node]);
          }
        })
        .otherwise(() => {});
    } else if (store.mode === 'delete') {
      e.cancelBubble = true;
      store.removeAnnotation(ann.id);
      const transformer = getTransformer();
      if (transformer) transformer.nodes([]);
    }
  }

  function handleDragEnd(ann: { id: string; type: string }, e: Konva.KonvaEventObject<DragEvent>) {
    const node = e.target;

    match(ann.type)
      .with('p_point', 'n_point', () => {
        store.updateAnnotation(ann.id, {
          x: Math.round(node.x()),
          y: Math.round(node.y()),
        });
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

  function handleKeyDown(e: KeyboardEvent) {
    if (e.code === 'Space' && !isSpaceDown.value) {
      e.preventDefault();
      isSpaceDown.value = true;
      const stage = getStage();
      if (stage) stage.container().style.cursor = 'grab';
    }
  }

  function handleKeyUp(e: KeyboardEvent) {
    if (e.code === 'Space') {
      isSpaceDown.value = false;
      const stage = getStage();
      if (stage) stage.container().style.cursor = 'default';
    }
  }

  function fitToImage() {
    if (!imageWidth.value || !imageHeight.value) return;
    const padding = 40;
    const availW = stageWidth.value - padding * 2;
    const availH = stageHeight.value - padding * 2;
    const scaleX = availW / imageWidth.value;
    const scaleY = availH / imageHeight.value;
    // Allow scale up for small images, cap at 5x
    const scale = Math.min(scaleX, scaleY, 5);

    store.stageScale = scale;
    store.stagePos = {
      x: (stageWidth.value - imageWidth.value * scale) / 2,
      y: (stageHeight.value - imageHeight.value * scale) / 2,
    };
  }

  defineExpose({ fitToImage });
</script>

<template>
  <div ref="containerRef" class="label-canvas-container">
    <v-stage
      ref="stageRef"
      :config="{ width: stageWidth, height: stageHeight }"
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
            :config="{
              image: baseImage,
              width: imageWidth,
              height: imageHeight,
            }"
          />

          <v-image
            v-if="maskImage && currentMaskVisible"
            :config="{
              image: maskImage,
              width: maskWidth,
              height: maskHeight,
              opacity: store.maskOpacity,
            }"
          />

          <v-circle
            v-for="ann in store.positivePoints"
            :key="ann.id"
            :config="{
              ...getPointConfig(ann, store.selectedId === ann.id),
              draggable: store.mode === 'select',
              scaleX: 1 / store.stageScale,
              scaleY: 1 / store.stageScale,
            }"
            @click="(e: Konva.KonvaEventObject<MouseEvent>) => handleAnnotationClick(ann, e)"
            @dragend="(e: Konva.KonvaEventObject<DragEvent>) => handleDragEnd(ann, e)"
          />

          <v-circle
            v-for="ann in store.negativePoints"
            :key="ann.id"
            :config="{
              ...getPointConfig(ann, store.selectedId === ann.id),
              draggable: store.mode === 'select',
              scaleX: 1 / store.stageScale,
              scaleY: 1 / store.stageScale,
            }"
            @click="(e: Konva.KonvaEventObject<MouseEvent>) => handleAnnotationClick(ann, e)"
            @dragend="(e: Konva.KonvaEventObject<DragEvent>) => handleDragEnd(ann, e)"
          />

          <v-rect
            v-for="ann in store.boxes"
            :key="ann.id"
            :config="{
              ...getBoxConfig(ann, store.selectedId === ann.id),
              draggable: store.mode === 'select',
            }"
            @click="(e: Konva.KonvaEventObject<MouseEvent>) => handleAnnotationClick(ann, e)"
            @dragend="(e: Konva.KonvaEventObject<DragEvent>) => handleDragEnd(ann, e)"
            @transformend="handleTransformEnd"
          />

          <v-rect v-if="tempBox" :config="tempBoxConfig" />
        </v-group>

        <v-transformer
          :config="{
            name: 'transformer-handle',
            boundBoxFunc: (
              oldBox: { x: number; y: number; width: number; height: number },
              newBox: { x: number; y: number; width: number; height: number }
            ) => {
              if (newBox.width < 5 || newBox.height < 5) return oldBox;
              return newBox;
            },
          }"
        />
      </v-layer>
    </v-stage>
  </div>
</template>

<style scoped lang="scss">
  .label-canvas-container {
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: var(--bg-secondary);

    :deep(.konvajs-content) {
      width: 100%;
      height: 100%;
    }
  }
</style>
