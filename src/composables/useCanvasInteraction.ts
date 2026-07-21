import { computed } from 'vue';
import { useMachine } from '@xstate/vue';
import { match, P } from 'ts-pattern';
import { canvasMachine } from '@/machines/canvasMachine';
import type { LabelMode, AnnotationType, Annotation } from '@/schemas/annotation';

interface CanvasStore {
  mode: LabelMode;
  tool: AnnotationType;
  stagePos: { x: number; y: number };
  stageScale: number;
  cursorImagePos: { x: number; y: number } | null;
  annotations: Array<{ id: string; type: string }>;
  addAnnotation: (ann: Annotation) => void;
  selectAnnotation: (id: string) => void;
  removeAnnotation: (id: string) => void;
  clearSelection: () => void;
}

interface CanvasRefs {
  getStage: () => { container: () => { style: { cursor: string } } } | null;
  getGroup: () => { x: () => number; y: () => number } | null;
  getPointerImagePos: (stage: unknown, group: unknown) => { x: number; y: number } | null;
}

export function useCanvasInteraction(store: CanvasStore, refs?: CanvasRefs) {
  const { snapshot, send } = useMachine(canvasMachine, {
    input: { store },
  });

  const cursorStyle = computed(() => {
    return match(snapshot.value.value)
      .with('panning', () => 'grabbing')
      .with('spaceHeld', () => 'grab')
      .otherwise(() =>
        match(store.mode)
          .with('create', () => 'crosshair')
          .with('delete', () => 'not-allowed')
          .otherwise(() => 'default')
      );
  });

  function getImagePos(): { x: number; y: number } | null {
    return match(refs)
      .with(P.nonNullable, (r) => {
        const stage = r.getStage();
        const group = r.getGroup();
        return match({ stage, group })
          .with({ stage: P.nonNullable, group: P.nonNullable }, ({ stage, group }) =>
            r.getPointerImagePos(stage, group)
          )
          .otherwise(() => null);
      })
      .otherwise(() => null);
  }

  function handleStageMouseDown(e: { evt: { button: number; clientX: number; clientY: number } }) {
    const evt = e.evt;
    const imgPos = getImagePos();
    send({
      type: 'MOUSE_DOWN',
      button: evt.button,
      clientX: evt.clientX,
      clientY: evt.clientY,
      imageX: imgPos?.x,
      imageY: imgPos?.y,
    });
    match(refs)
      .with(P.nonNullable, (r) => {
        const stage = r.getStage();
        match({ state: snapshot.value.value, stage })
          .with({ state: P.union('panning', 'spaceHeld'), stage: P.nonNullable }, ({ stage }) => {
            stage.container().style.cursor = 'grabbing';
          })
          .otherwise(() => {});
      })
      .otherwise(() => {});
  }

  function handleStageMouseMove(e: { evt: { clientX: number; clientY: number } }) {
    const imgPos = getImagePos();
    store.cursorImagePos = imgPos;
    send({
      type: 'MOUSE_MOVE',
      clientX: e.evt.clientX,
      clientY: e.evt.clientY,
      imageX: imgPos?.x,
      imageY: imgPos?.y,
    });
    match(snapshot.value.value)
      .with('panning', () => {
        const ctx = snapshot.value.context;
        const dx = e.evt.clientX - ctx.panStart.x;
        const dy = e.evt.clientY - ctx.panStart.y;
        store.stagePos = {
          x: ctx.groupStart.x + dx,
          y: ctx.groupStart.y + dy,
        };
      })
      .otherwise(() => {});
  }

  function handleStageMouseUp() {
    send({ type: 'MOUSE_UP' });
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.code === 'Space' && !snapshot.value.context.isSpaceDown) {
      e.preventDefault();
      send({ type: 'SPACE_DOWN' });
    }
  }

  function handleKeyUp(e: KeyboardEvent) {
    if (e.code === 'Space') {
      send({ type: 'SPACE_UP' });
    }
  }

  return {
    snapshot,
    send,
    cursorStyle,
    handleStageMouseDown,
    handleStageMouseMove,
    handleStageMouseUp,
    handleKeyDown,
    handleKeyUp,
  };
}
