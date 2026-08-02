import { describe, it, expect, vi } from 'vitest';
import { canvasMachine, type CanvasStoreAdapter } from '@/machines/canvasMachine';
import { createActor } from 'xstate';

function createMockStore(overrides?: Partial<CanvasStoreAdapter>): CanvasStoreAdapter {
  return {
    mode: 'create',
    tool: 'p_point',
    stagePos: { x: 0, y: 0 },
    currentObjectId: null,
    pendingAnnotation: null,
    imageWidth: 512,
    imageHeight: 512,
    addBoxToObject: vi.fn(),
    setStagePos: vi.fn(),
    setPendingAnnotation: vi.fn(),
    ...overrides,
  };
}

function startMachine(store?: CanvasStoreAdapter) {
  const s = store ?? createMockStore();
  return createActor(canvasMachine, { input: { store: s } });
}

describe('canvasMachine', () => {
  // ─── idle state ──────────────────────────────────────────────────

  describe('idle state', () => {
    it('starts in idle', () => {
      const actor = startMachine();
      actor.start();
      expect(actor.getSnapshot().value).toBe('idle');
    });

    it('RESET in idle clears tempBox', () => {
      const actor = startMachine();
      actor.start();
      actor.send({ type: 'RESET' });
      expect(actor.getSnapshot().value).toBe('idle');
      expect(actor.getSnapshot().context.tempBox).toBeNull();
    });

    it('CLEAR_TEMP_BOX in idle clears tempBox', () => {
      const actor = startMachine();
      actor.start();
      actor.send({ type: 'CLEAR_TEMP_BOX' });
      expect(actor.getSnapshot().context.tempBox).toBeNull();
    });
  });

  // ─── spaceHeld state ─────────────────────────────────────────────

  describe('spaceHeld state', () => {
    it('transitions to spaceHeld on SPACE_DOWN', () => {
      const actor = startMachine();
      actor.start();
      actor.send({ type: 'SPACE_DOWN' });
      expect(actor.getSnapshot().value).toBe('spaceHeld');
      expect(actor.getSnapshot().context.isSpaceDown).toBe(true);
    });

    it('transitions back to idle on SPACE_UP from spaceHeld', () => {
      const actor = startMachine();
      actor.start();
      actor.send({ type: 'SPACE_DOWN' });
      actor.send({ type: 'SPACE_UP' });
      expect(actor.getSnapshot().value).toBe('idle');
      expect(actor.getSnapshot().context.isSpaceDown).toBe(false);
    });

    it('RESET from spaceHeld goes to idle and clears tempBox', () => {
      const actor = startMachine();
      actor.start();
      actor.send({ type: 'SPACE_DOWN' });
      actor.send({ type: 'RESET' });
      expect(actor.getSnapshot().value).toBe('idle');
      expect(actor.getSnapshot().context.isSpaceDown).toBe(false);
    });

    it('MOUSE_DOWN with primary button transitions to panning', () => {
      const actor = startMachine();
      actor.start();
      actor.send({ type: 'SPACE_DOWN' });
      actor.send({ type: 'MOUSE_DOWN', button: 0, clientX: 100, clientY: 100 });
      expect(actor.getSnapshot().value).toBe('panning');
    });

    it('MOUSE_DOWN with non-primary button stays in spaceHeld', () => {
      const actor = startMachine();
      actor.start();
      actor.send({ type: 'SPACE_DOWN' });
      actor.send({ type: 'MOUSE_DOWN', button: 2, clientX: 100, clientY: 100 });
      expect(actor.getSnapshot().value).toBe('spaceHeld');
    });

    it('MOUSE_MOVE without button press stays in spaceHeld', () => {
      const actor = startMachine();
      actor.start();
      actor.send({ type: 'SPACE_DOWN' });
      actor.send({ type: 'MOUSE_MOVE', clientX: 100, clientY: 100 });
      expect(actor.getSnapshot().value).toBe('spaceHeld');
    });

    it('MOUSE_DOWN with primary button transitions to panning', () => {
      const actor = startMachine();
      actor.start();
      actor.send({ type: 'SPACE_DOWN' });
      actor.send({ type: 'MOUSE_DOWN', button: 0, clientX: 100, clientY: 100 });
      expect(actor.getSnapshot().value).toBe('panning');
    });
  });

  // ─── panning state ───────────────────────────────────────────────

  describe('panning state', () => {
    it('MOUSE_MOVE calls setStagePos', () => {
      const store = createMockStore();
      const actor = startMachine(store);
      actor.start();

      actor.send({ type: 'SPACE_DOWN' });
      actor.send({ type: 'MOUSE_DOWN', button: 0, clientX: 100, clientY: 100 });
      expect(actor.getSnapshot().value).toBe('panning');

      actor.send({ type: 'MOUSE_MOVE', clientX: 150, clientY: 120 });
      expect(store.setStagePos).toHaveBeenCalled();
    });

    it('MOUSE_UP transitions to idle', () => {
      const actor = startMachine();
      actor.start();
      actor.send({ type: 'SPACE_DOWN' });
      actor.send({ type: 'MOUSE_DOWN', button: 0, clientX: 100, clientY: 100 });
      actor.send({ type: 'MOUSE_UP' });
      expect(actor.getSnapshot().value).toBe('idle');
    });

    it('SPACE_UP updates isSpaceDown but stays in panning', () => {
      const actor = startMachine();
      actor.start();
      actor.send({ type: 'SPACE_DOWN' });
      actor.send({ type: 'MOUSE_DOWN', button: 0, clientX: 100, clientY: 100 });
      actor.send({ type: 'SPACE_UP' });
      expect(actor.getSnapshot().value).toBe('panning');
      expect(actor.getSnapshot().context.isSpaceDown).toBe(false);
    });

    it('RESET from panning goes to idle', () => {
      const actor = startMachine();
      actor.start();
      actor.send({ type: 'SPACE_DOWN' });
      actor.send({ type: 'MOUSE_DOWN', button: 0, clientX: 100, clientY: 100 });
      actor.send({ type: 'RESET' });
      expect(actor.getSnapshot().value).toBe('idle');
      expect(actor.getSnapshot().context.isSpaceDown).toBe(false);
    });
  });

  // ─── drawingBox state ────────────────────────────────────────────

  describe('drawingBox state', () => {
    it('transitions to drawingBox on MOUSE_DOWN in create+box mode', () => {
      const store = createMockStore({
        mode: 'create',
        tool: 'box',
        imageWidth: 512,
        imageHeight: 512,
      });
      const actor = startMachine(store);
      actor.start();
      actor.send({
        type: 'MOUSE_DOWN',
        button: 0,
        clientX: 10,
        clientY: 10,
        imageX: 50,
        imageY: 50,
      });
      expect(actor.getSnapshot().value).toBe('drawingBox');
    });

    it('does not transition to drawingBox if not in create mode', () => {
      const store = createMockStore({ mode: 'select' });
      const actor = startMachine(store);
      actor.start();
      actor.send({
        type: 'MOUSE_DOWN',
        button: 0,
        clientX: 10,
        clientY: 10,
        imageX: 50,
        imageY: 50,
      });
      expect(actor.getSnapshot().value).toBe('idle');
    });

    it('does not transition to drawingBox if tool is not box', () => {
      const store = createMockStore({ mode: 'create', tool: 'p_point' });
      const actor = startMachine(store);
      actor.start();
      actor.send({
        type: 'MOUSE_DOWN',
        button: 0,
        clientX: 10,
        clientY: 10,
        imageX: 50,
        imageY: 50,
      });
      expect(actor.getSnapshot().value).toBe('idle');
    });

    it('does not transition to drawingBox if imageWidth is 0', () => {
      const store = createMockStore({
        mode: 'create',
        tool: 'box',
        imageWidth: 0,
        imageHeight: 512,
      });
      const actor = startMachine(store);
      actor.start();
      actor.send({
        type: 'MOUSE_DOWN',
        button: 0,
        clientX: 10,
        clientY: 10,
        imageX: 50,
        imageY: 50,
      });
      expect(actor.getSnapshot().value).toBe('idle');
    });

    it('MOUSE_MOVE transitions to boxDrawn', () => {
      const store = createMockStore({ mode: 'create', tool: 'box' });
      const actor = startMachine(store);
      actor.start();
      actor.send({
        type: 'MOUSE_DOWN',
        button: 0,
        clientX: 10,
        clientY: 10,
        imageX: 50,
        imageY: 50,
      });
      actor.send({ type: 'MOUSE_MOVE', clientX: 20, clientY: 20, imageX: 100, imageY: 100 });
      expect(actor.getSnapshot().value).toBe('boxDrawn');
    });

    it('MOUSE_UP from drawingBox goes to idle (no box created)', () => {
      const store = createMockStore({ mode: 'create', tool: 'box' });
      const actor = startMachine(store);
      actor.start();
      actor.send({
        type: 'MOUSE_DOWN',
        button: 0,
        clientX: 10,
        clientY: 10,
        imageX: 50,
        imageY: 50,
      });
      actor.send({ type: 'MOUSE_UP' });
      expect(actor.getSnapshot().value).toBe('idle');
      expect(actor.getSnapshot().context.tempBox).toBeNull();
    });

    it('startBox sets boxStart and tempBox from image coordinates', () => {
      const store = createMockStore({
        mode: 'create',
        tool: 'box',
        imageWidth: 512,
        imageHeight: 512,
      });
      const actor = startMachine(store);
      actor.start();
      actor.send({
        type: 'MOUSE_DOWN',
        button: 0,
        clientX: 10,
        clientY: 10,
        imageX: 50,
        imageY: 60,
      });
      const ctx = actor.getSnapshot().context;
      expect(ctx.boxStart).toEqual({ x: 50, y: 60 });
      expect(ctx.tempBox).toEqual({ x: 50, y: 60, w: 0, h: 0 });
    });

    it('startBox clamps coordinates to image bounds', () => {
      const store = createMockStore({
        mode: 'create',
        tool: 'box',
        imageWidth: 100,
        imageHeight: 100,
      });
      const actor = startMachine(store);
      actor.start();
      actor.send({
        type: 'MOUSE_DOWN',
        button: 0,
        clientX: 10,
        clientY: 10,
        imageX: 200,
        imageY: -10,
      });
      const ctx = actor.getSnapshot().context;
      expect(ctx.boxStart).toEqual({ x: 100, y: 0 });
    });

    it('startBox ignores event without imageX/imageY', () => {
      const store = createMockStore({ mode: 'create', tool: 'box' });
      const actor = startMachine(store);
      actor.start();
      actor.send({ type: 'MOUSE_DOWN', button: 0, clientX: 10, clientY: 10 });
      const ctx = actor.getSnapshot().context;
      expect(ctx.boxStart).toBeNull();
      expect(ctx.tempBox).toBeNull();
    });
  });

  // ─── boxDrawn state ──────────────────────────────────────────────

  describe('boxDrawn state', () => {
    function drawBox(store?: CanvasStoreAdapter) {
      const s =
        store ??
        createMockStore({ mode: 'create', tool: 'box', imageWidth: 512, imageHeight: 512 });
      const actor = startMachine(s);
      actor.start();
      actor.send({
        type: 'MOUSE_DOWN',
        button: 0,
        clientX: 10,
        clientY: 10,
        imageX: 50,
        imageY: 50,
      });
      actor.send({ type: 'MOUSE_MOVE', clientX: 20, clientY: 20, imageX: 150, imageY: 150 });
      return actor;
    }

    it('MOUSE_MOVE updates tempBox', () => {
      const actor = drawBox();
      actor.send({ type: 'MOUSE_MOVE', clientX: 30, clientY: 30, imageX: 200, imageY: 200 });
      const tempBox = actor.getSnapshot().context.tempBox;
      expect(tempBox).not.toBeNull();
      expect(tempBox!.x).toBe(50);
      expect(tempBox!.y).toBe(50);
      expect(tempBox!.w).toBe(150);
      expect(tempBox!.h).toBe(150);
    });

    it('MOUSE_UP with large enough box goes to idle', () => {
      const store = createMockStore({
        mode: 'create',
        tool: 'box',
        imageWidth: 512,
        imageHeight: 512,
      });
      const actor = drawBox(store);
      actor.send({ type: 'MOUSE_UP' });
      expect(actor.getSnapshot().value).toBe('idle');
      expect(actor.getSnapshot().context.tempBox).toBeNull();
    });

    it('commitBox with pendingAnnotation keeps tempBox, CLEAR_TEMP_BOX then clears it', () => {
      const store = createMockStore({
        mode: 'create',
        tool: 'box',
        imageWidth: 512,
        imageHeight: 512,
        pendingAnnotation: { type: 'box', box: { id: 'b1', x1: 50, y1: 50, x2: 150, y2: 150 } },
      });
      const actor = startMachine(store);
      actor.start();
      actor.send({
        type: 'MOUSE_DOWN',
        button: 0,
        clientX: 10,
        clientY: 10,
        imageX: 50,
        imageY: 50,
      });
      actor.send({ type: 'MOUSE_MOVE', clientX: 20, clientY: 20, imageX: 150, imageY: 150 });
      actor.send({ type: 'MOUSE_UP' });
      // 残留场景：pending box 保留 tempBox 供 popup 渲染
      expect(actor.getSnapshot().context.tempBox).not.toBeNull();
      // popup 关闭后 CLEAR_TEMP_BOX 清理残留
      actor.send({ type: 'CLEAR_TEMP_BOX' });
      expect(actor.getSnapshot().context.tempBox).toBeNull();
    });

    it('MOUSE_UP with too small box does not commit', () => {
      const store = createMockStore({
        mode: 'create',
        tool: 'box',
        imageWidth: 512,
        imageHeight: 512,
      });
      const actor = startMachine(store);
      actor.start();
      actor.send({
        type: 'MOUSE_DOWN',
        button: 0,
        clientX: 10,
        clientY: 10,
        imageX: 50,
        imageY: 50,
      });
      actor.send({ type: 'MOUSE_MOVE', clientX: 11, clientY: 11, imageX: 51, imageY: 51 });
      actor.send({ type: 'MOUSE_UP' });
      expect(actor.getSnapshot().value).toBe('idle');
      expect(store.addBoxToObject).not.toHaveBeenCalled();
    });

    it('commitBox with currentObjectId calls addBoxToObject', () => {
      const store = createMockStore({
        mode: 'create',
        tool: 'box',
        imageWidth: 512,
        imageHeight: 512,
        currentObjectId: 'obj-1',
      });
      const actor = drawBox(store);
      actor.send({ type: 'MOUSE_UP' });
      expect(store.addBoxToObject).toHaveBeenCalledWith(
        'obj-1',
        expect.objectContaining({
          x1: 50,
          y1: 50,
          x2: 150,
          y2: 150,
        })
      );
    });

    it('commitBox without currentObjectId calls setPendingAnnotation', () => {
      const store = createMockStore({
        mode: 'create',
        tool: 'box',
        imageWidth: 512,
        imageHeight: 512,
        currentObjectId: null,
      });
      const actor = drawBox(store);
      actor.send({ type: 'MOUSE_UP' });
      expect(store.setPendingAnnotation).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'box' })
      );
    });

    it('commitBox does nothing if tempBox is null', () => {
      const store = createMockStore({ mode: 'create', tool: 'box' });
      const actor = startMachine(store);
      actor.start();
      // Send a largeEnough MOUSE_UP without having drawn a box
      actor.send({ type: 'MOUSE_UP' });
      expect(store.addBoxToObject).not.toHaveBeenCalled();
      expect(store.setPendingAnnotation).not.toHaveBeenCalled();
    });

    it('RESET from boxDrawn goes to idle and clears', () => {
      const actor = drawBox();
      actor.send({ type: 'RESET' });
      expect(actor.getSnapshot().value).toBe('idle');
      expect(actor.getSnapshot().context.tempBox).toBeNull();
    });
  });

  // ─── guards ──────────────────────────────────────────────────────

  describe('guards', () => {
    it('isPrimaryButton rejects non-primary buttons', () => {
      const actor = startMachine();
      actor.start();
      actor.send({ type: 'SPACE_DOWN' });
      // Right click
      actor.send({ type: 'MOUSE_DOWN', button: 1, clientX: 100, clientY: 100 });
      expect(actor.getSnapshot().value).toBe('spaceHeld');
    });

    it('isCreateBoxMode requires mode=create AND tool=box AND image loaded', () => {
      // Wrong mode
      const s1 = createMockStore({
        mode: 'select',
        tool: 'box',
        imageWidth: 512,
        imageHeight: 512,
      });
      const a1 = startMachine(s1);
      a1.start();
      a1.send({ type: 'MOUSE_DOWN', button: 0, clientX: 0, clientY: 0, imageX: 0, imageY: 0 });
      expect(a1.getSnapshot().value).toBe('idle');

      // Wrong tool
      const s2 = createMockStore({
        mode: 'create',
        tool: 'p_point',
        imageWidth: 512,
        imageHeight: 512,
      });
      const a2 = startMachine(s2);
      a2.start();
      a2.send({ type: 'MOUSE_DOWN', button: 0, clientX: 0, clientY: 0, imageX: 0, imageY: 0 });
      expect(a2.getSnapshot().value).toBe('idle');

      // No image
      const s3 = createMockStore({ mode: 'create', tool: 'box', imageWidth: 0, imageHeight: 0 });
      const a3 = startMachine(s3);
      a3.start();
      a3.send({ type: 'MOUSE_DOWN', button: 0, clientX: 0, clientY: 0, imageX: 0, imageY: 0 });
      expect(a3.getSnapshot().value).toBe('idle');
    });

    it('isLargeEnough requires tempBox.w > 2 AND tempBox.h > 2', () => {
      const store = createMockStore({
        mode: 'create',
        tool: 'box',
        imageWidth: 512,
        imageHeight: 512,
      });
      const actor = startMachine(store);
      actor.start();
      // Draw a 1x1 box
      actor.send({
        type: 'MOUSE_DOWN',
        button: 0,
        clientX: 10,
        clientY: 10,
        imageX: 50,
        imageY: 50,
      });
      actor.send({ type: 'MOUSE_MOVE', clientX: 11, clientY: 11, imageX: 51, imageY: 51 });
      actor.send({ type: 'MOUSE_UP' });
      // Box too small, should not commit
      expect(store.addBoxToObject).not.toHaveBeenCalled();
    });
  });

  // ─── edge cases ──────────────────────────────────────────────────

  describe('edge cases', () => {
    it('can handle full drawing lifecycle: mouse down → move → mouse up', () => {
      const store = createMockStore({
        mode: 'create',
        tool: 'box',
        imageWidth: 512,
        imageHeight: 512,
        currentObjectId: 'obj-1',
      });
      const actor = startMachine(store);
      actor.start();

      actor.send({
        type: 'MOUSE_DOWN',
        button: 0,
        clientX: 10,
        clientY: 10,
        imageX: 50,
        imageY: 50,
      });
      expect(actor.getSnapshot().value).toBe('drawingBox');

      actor.send({ type: 'MOUSE_MOVE', clientX: 100, clientY: 100, imageX: 200, imageY: 200 });
      expect(actor.getSnapshot().value).toBe('boxDrawn');

      actor.send({ type: 'MOUSE_UP' });
      expect(actor.getSnapshot().value).toBe('idle');
      expect(store.addBoxToObject).toHaveBeenCalledTimes(1);
    });

    it('can handle: space held → pan → space up → draw box', () => {
      const store = createMockStore({
        mode: 'create',
        tool: 'box',
        imageWidth: 512,
        imageHeight: 512,
        currentObjectId: 'obj-1',
      });
      const actor = startMachine(store);
      actor.start();

      // Pan
      actor.send({ type: 'SPACE_DOWN' });
      actor.send({ type: 'MOUSE_DOWN', button: 0, clientX: 100, clientY: 100 });
      expect(actor.getSnapshot().value).toBe('panning');
      actor.send({ type: 'MOUSE_UP' });
      expect(actor.getSnapshot().value).toBe('idle');

      // Draw box
      actor.send({
        type: 'MOUSE_DOWN',
        button: 0,
        clientX: 10,
        clientY: 10,
        imageX: 50,
        imageY: 50,
      });
      expect(actor.getSnapshot().value).toBe('drawingBox');
    });

    it('MOUSE_DOWN with non-primary button in idle does nothing', () => {
      const actor = startMachine();
      actor.start();
      actor.send({ type: 'MOUSE_DOWN', button: 2, clientX: 100, clientY: 100 });
      expect(actor.getSnapshot().value).toBe('idle');
    });

    it('RESET is available in all states', () => {
      const store = createMockStore({
        mode: 'create',
        tool: 'box',
        imageWidth: 512,
        imageHeight: 512,
        currentObjectId: 'obj-1',
      });

      // From spaceHeld
      const a1 = startMachine(store);
      a1.start();
      a1.send({ type: 'SPACE_DOWN' });
      a1.send({ type: 'RESET' });
      expect(a1.getSnapshot().value).toBe('idle');

      // From panning
      const a2 = startMachine(store);
      a2.start();
      a2.send({ type: 'SPACE_DOWN' });
      a2.send({ type: 'MOUSE_DOWN', button: 0, clientX: 100, clientY: 100 });
      a2.send({ type: 'RESET' });
      expect(a2.getSnapshot().value).toBe('idle');

      // From drawingBox
      const a3 = startMachine(store);
      a3.start();
      a3.send({ type: 'MOUSE_DOWN', button: 0, clientX: 10, clientY: 10, imageX: 50, imageY: 50 });
      a3.send({ type: 'RESET' });
      expect(a3.getSnapshot().value).toBe('idle');

      // From boxDrawn
      const a4 = startMachine(store);
      a4.start();
      a4.send({ type: 'MOUSE_DOWN', button: 0, clientX: 10, clientY: 10, imageX: 50, imageY: 50 });
      a4.send({ type: 'MOUSE_MOVE', clientX: 20, clientY: 20, imageX: 100, imageY: 100 });
      a4.send({ type: 'RESET' });
      expect(a4.getSnapshot().value).toBe('idle');
    });
  });

  // ─── moving state (move mode) ────────────────────────────────────

  describe('moving state (move mode)', () => {
    function startInMove(store?: CanvasStoreAdapter) {
      const s = store ?? createMockStore({ mode: 'move' });
      const actor = startMachine(s);
      actor.start();
      return { s, actor };
    }

    it('idle → MOUSE_DOWN in move mode → moving', () => {
      const { actor } = startInMove();
      actor.send({ type: 'MOUSE_DOWN', button: 0, clientX: 100, clientY: 100 });
      expect(actor.getSnapshot().value).toBe('moving');
    });

    it('MOUSE_MOVE in moving calls setStagePos', () => {
      const s = createMockStore({ mode: 'move' });
      const actor = startMachine(s);
      actor.start();
      actor.send({ type: 'MOUSE_DOWN', button: 0, clientX: 100, clientY: 100 });
      actor.send({ type: 'MOUSE_MOVE', clientX: 150, clientY: 120 });
      expect(s.setStagePos).toHaveBeenCalled();
    });

    it('MOUSE_UP from moving goes to idle', () => {
      const { actor } = startInMove();
      actor.send({ type: 'MOUSE_DOWN', button: 0, clientX: 100, clientY: 100 });
      actor.send({ type: 'MOUSE_UP' });
      expect(actor.getSnapshot().value).toBe('idle');
    });

    it('RESET from moving goes to idle', () => {
      const { actor } = startInMove();
      actor.send({ type: 'MOUSE_DOWN', button: 0, clientX: 100, clientY: 100 });
      actor.send({ type: 'RESET' });
      expect(actor.getSnapshot().value).toBe('idle');
    });

    it('move mode + tool=box → isMoveMode guard wins over isCreateBoxMode', () => {
      const s = createMockStore({ mode: 'move', tool: 'box', imageWidth: 512, imageHeight: 512 });
      const actor = startMachine(s);
      actor.start();
      actor.send({
        type: 'MOUSE_DOWN',
        button: 0,
        clientX: 10,
        clientY: 10,
        imageX: 50,
        imageY: 50,
      });
      expect(actor.getSnapshot().value).toBe('moving');
    });

    it('MOUSE_DOWN with non-primary button in move mode stays idle', () => {
      const { actor } = startInMove();
      actor.send({ type: 'MOUSE_DOWN', button: 2, clientX: 100, clientY: 100 });
      expect(actor.getSnapshot().value).toBe('idle');
    });

    it('CLEAR_TEMP_BOX in moving clears tempBox', () => {
      const s = createMockStore({ mode: 'move' });
      const actor = startMachine(s);
      actor.start();
      actor.send({ type: 'MOUSE_DOWN', button: 0, clientX: 100, clientY: 100 });
      expect(actor.getSnapshot().value).toBe('moving');
      actor.send({ type: 'CLEAR_TEMP_BOX' });
      expect(actor.getSnapshot().context.tempBox).toBeNull();
    });
  });

  // ─── ESC event ───────────────────────────────────────────────────

  describe('ESC event', () => {
    it('ESC from drawingBox goes to idle and clears tempBox', () => {
      const store = createMockStore({
        mode: 'create',
        tool: 'box',
        imageWidth: 512,
        imageHeight: 512,
      });
      const actor = startMachine(store);
      actor.start();
      actor.send({
        type: 'MOUSE_DOWN',
        button: 0,
        clientX: 10,
        clientY: 10,
        imageX: 50,
        imageY: 50,
      });
      expect(actor.getSnapshot().value).toBe('drawingBox');
      actor.send({ type: 'ESC' });
      expect(actor.getSnapshot().value).toBe('idle');
      expect(actor.getSnapshot().context.tempBox).toBeNull();
      expect(actor.getSnapshot().context.boxStart).toBeNull();
    });

    it('ESC from boxDrawn goes to idle and clears tempBox', () => {
      const store = createMockStore({
        mode: 'create',
        tool: 'box',
        imageWidth: 512,
        imageHeight: 512,
      });
      const actor = startMachine(store);
      actor.start();
      actor.send({
        type: 'MOUSE_DOWN',
        button: 0,
        clientX: 10,
        clientY: 10,
        imageX: 50,
        imageY: 50,
      });
      actor.send({ type: 'MOUSE_MOVE', clientX: 20, clientY: 20, imageX: 150, imageY: 150 });
      expect(actor.getSnapshot().value).toBe('boxDrawn');
      actor.send({ type: 'ESC' });
      expect(actor.getSnapshot().value).toBe('idle');
      expect(actor.getSnapshot().context.tempBox).toBeNull();
    });

    it('ESC in idle does nothing', () => {
      const actor = startMachine();
      actor.start();
      actor.send({ type: 'ESC' });
      expect(actor.getSnapshot().value).toBe('idle');
    });

    it('ESC in moving does not exit unexpectedly', () => {
      const actor = startMachine(createMockStore({ mode: 'move' }));
      actor.start();
      actor.send({ type: 'MOUSE_DOWN', button: 0, clientX: 100, clientY: 100 });
      actor.send({ type: 'ESC' });
      // moving 状态无 ESC handler，保持在 moving
      expect(actor.getSnapshot().value).toBe('moving');
    });
  });

  // ─── updateBox coordinate clamping ───────────────────────────────

  describe('updateBox coordinate clamping', () => {
    it('clamps coordinates to image bounds', () => {
      const store = createMockStore({
        mode: 'create',
        tool: 'box',
        imageWidth: 100,
        imageHeight: 100,
      });
      const actor = startMachine(store);
      actor.start();
      actor.send({
        type: 'MOUSE_DOWN',
        button: 0,
        clientX: 10,
        clientY: 10,
        imageX: 50,
        imageY: 50,
      });
      actor.send({ type: 'MOUSE_MOVE', clientX: 20, clientY: 20, imageX: 200, imageY: -10 });
      const tempBox = actor.getSnapshot().context.tempBox;
      expect(tempBox).not.toBeNull();
      expect(tempBox!.x).toBe(50);
      expect(tempBox!.y).toBe(0); // clamped from -10 to 0
      expect(tempBox!.w).toBe(50); // 100 - 50
      expect(tempBox!.h).toBe(50); // 50 - 0
    });

    it('handles reverse direction (drawing from right to left)', () => {
      const store = createMockStore({
        mode: 'create',
        tool: 'box',
        imageWidth: 512,
        imageHeight: 512,
      });
      const actor = startMachine(store);
      actor.start();
      actor.send({
        type: 'MOUSE_DOWN',
        button: 0,
        clientX: 10,
        clientY: 10,
        imageX: 200,
        imageY: 200,
      });
      actor.send({ type: 'MOUSE_MOVE', clientX: 20, clientY: 20, imageX: 100, imageY: 100 });
      const tempBox = actor.getSnapshot().context.tempBox;
      expect(tempBox).not.toBeNull();
      expect(tempBox!.x).toBe(100);
      expect(tempBox!.y).toBe(100);
      expect(tempBox!.w).toBe(100);
      expect(tempBox!.h).toBe(100);
    });
  });
});
