import { describe, it, expect, vi, beforeAll } from 'vitest';
import { createActor } from 'xstate';
import { canvasMachine } from '@/machines/canvasMachine';

beforeAll(() => {
  if (!globalThis.crypto.randomUUID) {
    vi.stubGlobal('crypto', {
      ...globalThis.crypto,
      randomUUID: () => 'test-uuid-' + Math.random().toString(36).slice(2),
    });
  }
});

function createMockStore(overrides: Partial<{ mode: string; tool: string }> = {}) {
  return {
    mode: overrides.mode ?? 'create',
    tool: overrides.tool ?? 'p_point',
    stagePos: { x: 0, y: 0 },
    currentObjectId: 'obj-1',
    addBoxToObject: vi.fn(),
    showNameDialog: false,
    pendingAnnotation: null,
  };
}

function create(overrides?: { mode?: string; tool?: string }) {
  const actor = createActor(canvasMachine, {
    input: {
      store: createMockStore(overrides),
    },
  });
  actor.start();
  return actor;
}

describe('canvasMachine', () => {
  it('starts in idle state', () => {
    const actor = create();
    expect(actor.getSnapshot().value).toBe('idle');
  });

  it('transitions to spaceHeld on SPACE_DOWN', () => {
    const actor = create();
    actor.send({ type: 'SPACE_DOWN' });
    expect(actor.getSnapshot().value).toBe('spaceHeld');
  });

  it('returns to idle on SPACE_UP from spaceHeld', () => {
    const actor = create();
    actor.send({ type: 'SPACE_DOWN' });
    actor.send({ type: 'SPACE_UP' });
    expect(actor.getSnapshot().value).toBe('idle');
  });

  it('transitions to panning on MOUSE_DOWN from spaceHeld', () => {
    const actor = create();
    actor.send({ type: 'SPACE_DOWN' });
    actor.send({ type: 'MOUSE_DOWN', button: 0, clientX: 100, clientY: 200 });
    expect(actor.getSnapshot().value).toBe('panning');
  });

  it('returns to idle on MOUSE_UP from panning', () => {
    const actor = create();
    actor.send({ type: 'SPACE_DOWN' });
    actor.send({ type: 'MOUSE_DOWN', button: 0, clientX: 100, clientY: 200 });
    actor.send({ type: 'MOUSE_UP' });
    expect(actor.getSnapshot().value).toBe('idle');
  });

  it('transitions to drawingBox on MOUSE_DOWN from idle in box mode', () => {
    const actor = create({ mode: 'create', tool: 'box' });
    actor.send({ type: 'MOUSE_DOWN', button: 0, clientX: 0, clientY: 0, imageX: 10, imageY: 20 });
    expect(actor.getSnapshot().value).toBe('drawingBox');
  });

  it('stays in idle on MOUSE_DOWN in point mode', () => {
    const actor = create({ mode: 'create', tool: 'p_point' });
    actor.send({ type: 'MOUSE_DOWN', button: 0, clientX: 0, clientY: 0, imageX: 10, imageY: 20 });
    expect(actor.getSnapshot().value).toBe('idle');
  });

  it('transitions to boxDrawn on MOUSE_MOVE from drawingBox', () => {
    const actor = create({ mode: 'create', tool: 'box' });
    actor.send({ type: 'MOUSE_DOWN', button: 0, clientX: 0, clientY: 0, imageX: 10, imageY: 20 });
    actor.send({ type: 'MOUSE_MOVE', clientX: 50, clientY: 50, imageX: 110, imageY: 120 });
    expect(actor.getSnapshot().value).toBe('boxDrawn');
  });

  it('commits box on MOUSE_UP if large enough', () => {
    const store = createMockStore({ mode: 'create', tool: 'box' });
    const actor = createActor(canvasMachine, { input: { store } });
    actor.start();
    actor.send({ type: 'MOUSE_DOWN', button: 0, clientX: 0, clientY: 0, imageX: 10, imageY: 20 });
    actor.send({ type: 'MOUSE_MOVE', clientX: 50, clientY: 50, imageX: 110, imageY: 120 });
    expect(actor.getSnapshot().value).toBe('boxDrawn');
    expect(actor.getSnapshot().context.tempBox).toEqual({ x: 10, y: 20, w: 100, h: 100 });
    actor.send({ type: 'MOUSE_UP' });
    expect(actor.getSnapshot().value).toBe('idle');
    expect(store.addBoxToObject).toHaveBeenCalledWith(
      'obj-1',
      expect.objectContaining({ x1: 10, y1: 20, x2: 110, y2: 120 })
    );
  });

  it('does not commit box if too small', () => {
    const store = createMockStore({ mode: 'create', tool: 'box' });
    const actor = createActor(canvasMachine, { input: { store } });
    actor.start();
    actor.send({ type: 'MOUSE_DOWN', button: 0, clientX: 0, clientY: 0, imageX: 10, imageY: 20 });
    actor.send({ type: 'MOUSE_MOVE', clientX: 50, clientY: 50, imageX: 11, imageY: 21 });
    actor.send({ type: 'MOUSE_UP' });
    expect(actor.getSnapshot().value).toBe('idle');
    expect(store.addBoxToObject).not.toHaveBeenCalled();
  });

  it('resets box on MOUSE_UP from drawingBox without MOUSE_MOVE', () => {
    const store = createMockStore({ mode: 'create', tool: 'box' });
    const actor = createActor(canvasMachine, { input: { store } });
    actor.start();
    actor.send({ type: 'MOUSE_DOWN', button: 0, clientX: 0, clientY: 0, imageX: 10, imageY: 20 });
    actor.send({ type: 'MOUSE_UP' });
    expect(actor.getSnapshot().value).toBe('idle');
    expect(store.addBoxToObject).not.toHaveBeenCalled();
  });
});
