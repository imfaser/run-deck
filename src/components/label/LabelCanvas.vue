<script setup lang="ts">
  import { ref, computed, watch, onUnmounted } from 'vue';
  import { useImage } from 'vue-konva';
  import { useResizeObserver, useEventListener } from '@vueuse/core';
  import Konva from 'konva';
  import { useLabelStore } from '@/stores/label';
  import { getPointerImagePos } from '@/utils/coordTransform';
  import { getPointConfig, getBoxConfig } from '@/utils/annotationConfig';
  import { useCanvasInteraction } from '@/composables/useCanvasInteraction';
  import { useCanvasAnnotations } from '@/composables/useCanvasAnnotations';

  const store = useLabelStore();
  const {
    snapshot,
    cursorStyle,
    handleStageMouseDown: machineMouseDown,
    handleStageMouseMove: machineMouseMove,
    handleStageMouseUp: machineMouseUp,
    handleKeyDown,
    handleKeyUp,
  } = useCanvasInteraction(store, {
    getStage: () =>
      getStage() as unknown as { container: () => { style: { cursor: string } } } | null,
    getGroup: () => getGroup() as unknown as { x: () => number; y: () => number } | null,
    getPointerImagePos: (s: unknown, g: unknown) =>
      getPointerImagePos(s as Konva.Stage, g as Konva.Group),
  });

  const containerRef = ref<HTMLDivElement | null>(null);
  const stageRef = ref<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const transformerRef = ref<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const stageWidth = ref(800);
  const stageHeight = ref(600);
  const imageWidth = ref(0);
  const imageHeight = ref(0);
  const maskWidth = ref(0);
  const maskHeight = ref(0);

  const [baseImage] = useImage(computed(() => store.imageUrl ?? ''));
  const [maskImage] = useImage(computed(() => store.maskUrl ?? ''));

  const {
    handleWheel,
    handleStageClick,
    handleAnnotationClick,
    handleDragEnd,
    handleTransformEnd,
    fitToImage,
  } = useCanvasAnnotations({
    store,
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
    dims: { imageWidth, imageHeight, stageWidth, stageHeight },
  });

  const groupConfig = computed(() => ({
    name: 'annotation-group',
    x: store.stagePos.x,
    y: store.stagePos.y,
    scaleX: store.stageScale,
    scaleY: store.stageScale,
  }));

  const tempBoxConfig = computed(() => {
    const box = snapshot.value.context.tempBox;
    if (!box) return {};
    return {
      x: box.x,
      y: box.y,
      width: box.w,
      height: box.h,
      stroke: 'var(--color-warning)',
      strokeWidth: 2,
      strokeScaleEnabled: false,
      fill: 'transparent',
    };
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
    return transformerRef.value?.getNode?.() ?? null;
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

  function handleStageMouseDown(e: Konva.KonvaEventObject<MouseEvent>) {
    machineMouseDown({ evt: e.evt });
  }

  function handleStageMouseMove(e: Konva.KonvaEventObject<MouseEvent>) {
    machineMouseMove({ evt: e.evt });
  }

  function handleStageMouseUp() {
    machineMouseUp();
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
            :config="{ image: baseImage, width: imageWidth, height: imageHeight }"
          />
          <v-image
            v-if="maskImage && store.maskVisible"
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
          <v-rect v-if="tempBoxConfig.stroke" :config="tempBoxConfig" />
          <v-transformer ref="transformerRef" :config="{ name: 'transformer-handle' }" />
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
