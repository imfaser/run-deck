import { setup, assign } from 'xstate';
import type { AnnotationType, LabelMode } from '@/schemas/annotation';
import type { FrontendBox } from '@/lib/annotationMapping';
import type { PendingAnnotation } from '@/store/label-3d-canvas';

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

/**
 * 机器只通过该 adapter 读取/写入 Zustand store。
 * getter 总是读实时状态；写入走对应 action。
 */
export interface CanvasStoreAdapter {
  mode: LabelMode;
  tool: AnnotationType;
  stagePos: Point;
  currentObjectId: string | null;
  pendingAnnotation: PendingAnnotation;
  imageWidth: number;
  imageHeight: number;
  addBoxToObject: (objectId: string, box: FrontendBox) => void;
  setStagePos: (pos: Point) => void;
  setPendingAnnotation: (pending: PendingAnnotation) => void;
}

interface CanvasContext {
  store: CanvasStoreAdapter;
  isSpaceDown: boolean;
  panStart: Point;
  groupStart: Point;
  boxStart: Point | null;
  tempBox: Box | null;
}

export type CanvasEvent =
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
  | { type: 'ESC' }
  | { type: 'CLEAR_TEMP_BOX' }
  | { type: 'RESET' };

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export const canvasMachine = setup({
  types: {
    context: {} as CanvasContext,
    events: {} as CanvasEvent,
  },
  guards: {
    isPrimaryButton: ({ event }) => event.type === 'MOUSE_DOWN' && event.button === 0,
    isMoveMode: ({ context, event }) =>
      context.store.mode === 'move' && event.type === 'MOUSE_DOWN' && event.button === 0,
    isCreateBoxMode: ({ context }) => {
      return (
        context.store.mode === 'create' &&
        context.store.tool === 'box' &&
        context.store.imageWidth > 0 &&
        context.store.imageHeight > 0
      );
    },
    isLargeEnough: ({ context }) => {
      if (!context.tempBox) {
        return false;
      }
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
      context.store.setStagePos({
        x: context.groupStart.x + dx,
        y: context.groupStart.y + dy,
      });
      return {};
    }),
    startBox: assign(({ event, context }) => {
      const evt = event as { imageX?: number; imageY?: number };
      if (evt.imageX == null || evt.imageY == null) {
        return {};
      }
      const x = clamp(evt.imageX, 0, context.store.imageWidth);
      const y = clamp(evt.imageY, 0, context.store.imageHeight);
      return {
        boxStart: { x, y },
        tempBox: { x, y, w: 0, h: 0 },
      };
    }),
    updateBox: assign(({ context, event }) => {
      const evt = event as { imageX?: number; imageY?: number };
      if (evt.imageX == null || evt.imageY == null || !context.boxStart) {
        return {};
      }
      const x = clamp(evt.imageX, 0, context.store.imageWidth);
      const y = clamp(evt.imageY, 0, context.store.imageHeight);
      return {
        tempBox: {
          x: Math.min(context.boxStart.x, x),
          y: Math.min(context.boxStart.y, y),
          w: Math.abs(x - context.boxStart.x),
          h: Math.abs(y - context.boxStart.y),
        },
      };
    }),
    // 修复：commitBox 改为 assign，不直接改 context.tempBox
    commitBox: assign(({ context }) => {
      if (!context.tempBox) {
        return {};
      }
      const { x, y, w, h } = context.tempBox;
      if (w <= 2 || h <= 2) {
        return {};
      }
      const box: FrontendBox = {
        id: crypto.randomUUID(),
        x1: Math.round(x),
        y1: Math.round(y),
        x2: Math.round(x + w),
        y2: Math.round(y + h),
      };
      if (!context.store.currentObjectId) {
        context.store.setPendingAnnotation({ type: 'box', box });
        return {};
      }
      context.store.addBoxToObject(context.store.currentObjectId, box);
      return {};
    }),
    resetBox: assign(({ context }) => {
      // 若已有 pending box（已 commit 待选对象），仅清 boxStart，
      // 保留 tempBox 供 ObjectSelectPopup 渲染；否则全部清空（ESC/放弃绘制场景）。
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
    store: (input as { store: CanvasStoreAdapter }).store,
    isSpaceDown: false,
    panStart: { x: 0, y: 0 },
    groupStart: { x: 0, y: 0 },
    boxStart: null,
    tempBox: null,
  }),
  states: {
    idle: {
      on: {
        RESET: { actions: 'clearTempBox' },
        MOUSE_MOVE: { target: 'idle' },
        SPACE_DOWN: {
          target: 'spaceHeld',
          actions: 'setSpaceDown',
        },
        MOUSE_DOWN: [
          {
            guard: 'isMoveMode',
            target: 'moving',
            actions: 'startPan',
          },
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
        RESET: {
          target: 'idle',
          actions: ['clearTempBox', 'setSpaceUp'],
        },
        MOUSE_MOVE: { target: 'spaceHeld' },
        SPACE_UP: {
          target: 'idle',
          actions: 'setSpaceUp',
        },
        MOUSE_DOWN: {
          target: 'panning',
          actions: 'startPan',
          guard: 'isPrimaryButton',
        },
        CLEAR_TEMP_BOX: {
          actions: 'clearTempBox',
        },
      },
    },
    moving: {
      on: {
        RESET: {
          target: 'idle',
          actions: 'clearTempBox',
        },
        MOUSE_MOVE: {
          actions: 'updatePan',
        },
        MOUSE_UP: {
          target: 'idle',
        },
        CLEAR_TEMP_BOX: {
          actions: 'clearTempBox',
        },
      },
    },
    panning: {
      on: {
        RESET: {
          target: 'idle',
          actions: ['clearTempBox', 'setSpaceUp'],
        },
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
        CLEAR_TEMP_BOX: {
          actions: 'clearTempBox',
        },
      },
    },
    drawingBox: {
      on: {
        RESET: {
          target: 'idle',
          actions: ['clearTempBox', 'setSpaceUp'],
        },
        ESC: {
          target: 'idle',
          actions: 'resetBox',
        },
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
        CLEAR_TEMP_BOX: {
          actions: 'clearTempBox',
        },
      },
    },
    boxDrawn: {
      on: {
        RESET: {
          target: 'idle',
          actions: ['clearTempBox', 'setSpaceUp'],
        },
        ESC: {
          target: 'idle',
          actions: 'resetBox',
        },
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
        CLEAR_TEMP_BOX: {
          actions: 'clearTempBox',
        },
      },
    },
  },
});
