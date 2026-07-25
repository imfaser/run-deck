import { setup, assign } from 'xstate';
import {
  type LabelMode,
  type AnnotationType,
  type BoxAnnotation,
  AnnotationObject,
} from '@/schemas/annotation';
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
  setTool: (tool: AnnotationType) => void;
  showNameDialog: boolean;
  pendingAnnotation: PendingAnnotation;
  objects: AnnotationObject[];
  cursorScreenPos: { value: Point | null } | null;
  imageWidth: number;
  imageHeight: number;
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
      return (
        context.store.mode === 'create' &&
        (context.store.tool === 'box' || context.store.tool === 'visual_box')
      );
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
    updatePan: assign(({ context, event }) => {
      const evt = event as { clientX: number; clientY: number };
      const dx = evt.clientX - context.panStart.x;
      const dy = evt.clientY - context.panStart.y;
      context.store.stagePos = {
        x: context.groupStart.x + dx,
        y: context.groupStart.y + dy,
      };
      return {};
    }),
    startBox: assign(({ event, context }) => {
      const evt = event as { imageX?: number; imageY?: number };
      if (evt.imageX == null || evt.imageY == null) return {};
      const x = Math.max(0, Math.min(evt.imageX, context.store.imageWidth));
      const y = Math.max(0, Math.min(evt.imageY, context.store.imageHeight));
      return {
        boxStart: { x, y },
        tempBox: { x, y, w: 0, h: 0 },
      };
    }),
    updateBox: assign(({ context, event }) => {
      const evt = event as { imageX?: number; imageY?: number };
      if (evt.imageX == null || evt.imageY == null || !context.boxStart) return {};
      const x = Math.max(0, Math.min(evt.imageX, context.store.imageWidth));
      const y = Math.max(0, Math.min(evt.imageY, context.store.imageHeight));
      return {
        tempBox: {
          x: Math.min(context.boxStart.x, x),
          y: Math.min(context.boxStart.y, y),
          w: Math.abs(x - context.boxStart.x),
          h: Math.abs(y - context.boxStart.y),
        },
      };
    }),
    commitBox: ({ context }) => {
      if (!context.tempBox) return;
      const { x, y, w, h } = context.tempBox;
      if (w > 2 && h > 2) {
        const box = {
          id: crypto.randomUUID(),
          x1: Math.round(x),
          y1: Math.round(y),
          x2: Math.round(x + w),
          y2: Math.round(y + h),
        };

        // Visual box: same flow as regular box — go through pendingAnnotation
        if (context.store.tool === 'visual_box') {
          if (!context.store.currentObjectId) {
            context.store.pendingAnnotation = {
              type: 'visual_box',
              box,
            };
            return;
          }
          // If an object is already selected, add box directly
          context.store.addBoxToObject(context.store.currentObjectId, box);
          context.tempBox = null;
          return;
        }

        if (!context.store.currentObjectId) {
          context.store.pendingAnnotation = {
            type: 'box',
            box,
          };
          return;
        }
        context.store.addBoxToObject(context.store.currentObjectId, box);
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
        MOUSE_MOVE: {
          target: 'panning',
          actions: 'startPan',
        },
      },
    },
    panning: {
      on: {
        SPACE_UP: {
          actions: 'setSpaceUp',
        },
        SPACE_DOWN: {
          actions: 'setSpaceDown',
        },
        MOUSE_MOVE: {
          actions: 'updatePan',
        },
        MOUSE_UP: {
          target: 'idle',
        },
      },
    },
    drawingBox: {
      on: {
        SPACE_UP: {
          actions: 'setSpaceUp',
        },
        SPACE_DOWN: {
          actions: 'setSpaceDown',
        },
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
        SPACE_UP: {
          actions: 'setSpaceUp',
        },
        SPACE_DOWN: {
          actions: 'setSpaceDown',
        },
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
