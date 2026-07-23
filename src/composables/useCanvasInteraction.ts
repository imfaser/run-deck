import { computed } from 'vue';
import { useMachine } from '@xstate/vue';
import { match, P } from 'ts-pattern';
import { canvasMachine } from '@/machines/canvasMachine';
import type { LabelMode, AnnotationType, BoxAnnotation } from '@/schemas/annotation';

interface CanvasStore {
  mode: LabelMode;
  tool: AnnotationType;
  stagePos: { x: number; y: number };
  stageScale: number;
  cursorImagePos: { x: number; y: number } | null;
  currentObjectId: string | null;
  addBoxToObject: (objectId: string, box: BoxAnnotation) => void;
  showNameDialog: boolean;
  pendingAnnotation: unknown;
  imageWidth: number;
  imageHeight: number;
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
