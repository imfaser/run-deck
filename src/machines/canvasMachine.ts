import { setup, assign } from 'xstate';
import type { LabelMode, AnnotationType, BoxAnnotation } from '@/schemas/annotation';
import type { PendingAnnotation } from '@/composables/useCanvasAnnotations';

interface Point {
  x: number;
  y: number;
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface CanvasStore {
  mode: LabelMode;
  tool: AnnotationType;
  stagePos: Point;
  currentObjectId: string | null;
  addBoxToObject: (objectId: string, box: BoxAnnotation) => void;
  showNameDialog: boolean;
  pendingAnnotation: PendingAnnotation;
  cursorScreenPos: { value: Point | null } | null;
}

interface CanvasContext {
  store: CanvasStore;
  isSpaceDown: boolean;
  panStart: Point;
  groupStart: Point;
  boxStart: Point | null;
  tempBox: Box | null;
}

type CanvasEvent =
  | { type: 'SPACE_DOWN' }
  | { type: 'SPACE_UP' }
  | {
      type: 'MOUSE_DOWN';
      button: number;
      clientX: number;
      clientY: number;
      imageX?: number;
      imageY?: number;
    }
  | { type: 'MOUSE_MOVE'; clientX: number; clientY: number; imageX?: number; imageY?: number }
  | { type: 'MOUSE_UP' }
  | { type: 'CLEAR_TEMP_BOX' };

export const canvasMachine = setup({
  types: {
    context: {} as CanvasContext,
    events: {} as CanvasEvent,
  },
  guards: {
    isCreateBoxMode: ({ context }) => {
      return context.store.mode === 'create' && context.store.tool === 'box';
    },
    isLargeEnough: ({ context }) => {
      if (!context.tempBox) return false;
      return context.tempBox.w > 2 && context.tempBox.h > 2;
    },
  },
  actions: {
    startPan: assign(({ context, event }) => {
      const evt = event as { clientX: number; clientY: number };
      return {
        panStart: { x: evt.clientX, y: evt.clientY },
        groupStart: { ...context.store.stagePos },
      };
    }),
    startBox: assign(({ event }) => {
      const evt = event as { imageX?: number; imageY?: number };
      if (evt.imageX == null || evt.imageY == null) return {};
      const pos = { x: evt.imageX, y: evt.imageY };
      return {
        boxStart: pos,
        tempBox: { x: pos.x, y: pos.y, w: 0, h: 0 },
      };
    }),
    updateBox: assign(({ context, event }) => {
      const evt = event as { imageX?: number; imageY?: number };
      if (evt.imageX == null || evt.imageY == null || !context.boxStart) return {};
      const pos = { x: evt.imageX, y: evt.imageY };
      return {
        tempBox: {
          x: Math.min(context.boxStart.x, pos.x),
          y: Math.min(context.boxStart.y, pos.y),
          w: Math.abs(pos.x - context.boxStart.x),
          h: Math.abs(pos.y - context.boxStart.y),
        },
      };
    }),
    commitBox: ({ context }) => {
      if (!context.tempBox) return;
      const { x, y, w, h } = context.tempBox;
      if (w > 2 && h > 2) {
        if (!context.store.currentObjectId) {
          context.store.pendingAnnotation = {
            type: 'box',
            box: {
              id: crypto.randomUUID(),
              x1: Math.round(x),
              y1: Math.round(y),
              x2: Math.round(x + w),
              y2: Math.round(y + h),
            },
          };
          return;
        }
        context.store.addBoxToObject(context.store.currentObjectId, {
          id: crypto.randomUUID(),
          x1: Math.round(x),
          y1: Math.round(y),
          x2: Math.round(x + w),
          y2: Math.round(y + h),
        });
        context.tempBox = null;
      }
    },
    resetBox: assign(({ context }) => {
      if (context.store.pendingAnnotation?.type === 'box') {
        return { boxStart: null };
      }
      return { boxStart: null, tempBox: null };
    }),
    setSpaceDown: assign({ isSpaceDown: true }),
    setSpaceUp: assign({ isSpaceDown: false }),
    clearTempBox: assign({ tempBox: null }),
  },
}).createMachine({
  id: 'canvas',
  initial: 'idle',
  context: ({ input }) => ({
    store: (input as { store: CanvasStore }).store,
    isSpaceDown: false,
    panStart: { x: 0, y: 0 },
    groupStart: { x: 0, y: 0 },
    boxStart: null,
    tempBox: null,
  }),
  states: {
    idle: {
      on: {
        SPACE_DOWN: {
          target: 'spaceHeld',
          actions: 'setSpaceDown',
        },
        MOUSE_DOWN: [
          {
            guard: 'isCreateBoxMode',
            target: 'drawingBox',
            actions: 'startBox',
          },
          {
            target: 'idle',
          },
        ],
        CLEAR_TEMP_BOX: {
          actions: 'clearTempBox',
        },
      },
    },
    spaceHeld: {
      on: {
        SPACE_UP: {
          target: 'idle',
          actions: 'setSpaceUp',
        },
        MOUSE_DOWN: {
          target: 'panning',
          actions: 'startPan',
        },
      },
    },
    panning: {
      on: {
        MOUSE_UP: {
          target: 'idle',
        },
      },
    },
    drawingBox: {
      on: {
        MOUSE_MOVE: {
          target: 'boxDrawn',
          actions: 'updateBox',
        },
        MOUSE_UP: {
          target: 'idle',
          actions: 'resetBox',
        },
      },
    },
    boxDrawn: {
      on: {
        MOUSE_MOVE: {
          actions: 'updateBox',
        },
        MOUSE_UP: [
          {
            guard: 'isLargeEnough',
            target: 'idle',
            actions: ['commitBox', 'resetBox'],
          },
          {
            target: 'idle',
            actions: 'resetBox',
          },
        ],
      },
    },
  },
});
