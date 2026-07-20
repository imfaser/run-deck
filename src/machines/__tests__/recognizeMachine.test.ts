import { describe, it, expect } from 'vitest';
import { createActor, waitFor } from 'xstate';
import { fromPromise } from 'xstate';
import { recognizeMachine } from '@/machines/recognizeMachine';

function stubMachine() {
  return recognizeMachine.provide({
    actors: {
      askAdopt: fromPromise(() => Promise.resolve()),
      askCombine: fromPromise(() => Promise.resolve()),
      doRecognize: fromPromise(() => Promise.resolve()),
    },
  });
}

describe('recognizeMachine', () => {
  it('starts in idle state', () => {
    const actor = createActor(stubMachine());
    actor.start();
    expect(actor.getSnapshot().value).toBe('idle');
  });

  it('transitions to recognizing on RECOGNIZE when no conditions met', async () => {
    const actor = createActor(stubMachine());
    actor.start();
    actor.send({
      type: 'RECOGNIZE',
      sliceIndex: 0,
      hasExistingMask: false,
      hasAnnotations: false,
      hasPrevMask: false,
      volumeId: 'vol-1',
    });
    await waitFor(actor, (s) => s.value === 'done');
    expect(actor.getSnapshot().value).toBe('done');
    expect(actor.getSnapshot().context.result).toBe('success');
  });

  it('transitions to askAdopt when hasExistingMask and no combine condition', async () => {
    const machine = stubMachine();
    const actor = createActor(machine);
    actor.start();
    actor.send({
      type: 'RECOGNIZE',
      sliceIndex: 0,
      hasExistingMask: true,
      hasAnnotations: false,
      hasPrevMask: false,
      volumeId: 'vol-1',
    });
    expect(actor.getSnapshot().value).toBe('askAdopt');
  });

  it('transitions to askCombine when hasAnnotations and hasPrevMask', async () => {
    const machine = stubMachine();
    const actor = createActor(machine);
    actor.start();
    actor.send({
      type: 'RECOGNIZE',
      sliceIndex: 0,
      hasExistingMask: false,
      hasAnnotations: true,
      hasPrevMask: true,
      volumeId: 'vol-1',
    });
    expect(actor.getSnapshot().value).toBe('askCombine');
  });

  it('returns to idle on STOP from recognizing', () => {
    const machine = recognizeMachine.provide({
      actors: {
        askAdopt: fromPromise(() => Promise.resolve()),
        askCombine: fromPromise(() => Promise.resolve()),
        doRecognize: fromPromise(() => new Promise(() => {})), // never resolves
      },
    });
    const actor = createActor(machine);
    actor.start();
    actor.send({
      type: 'RECOGNIZE',
      sliceIndex: 0,
      hasExistingMask: false,
      hasAnnotations: false,
      hasPrevMask: false,
      volumeId: 'vol-1',
    });
    expect(actor.getSnapshot().value).toBe('recognizing');
    actor.send({ type: 'STOP' });
    expect(actor.getSnapshot().value).toBe('idle');
  });

  it('stays in done state after recognition (not auto-reset)', async () => {
    const machine = stubMachine();
    const actor = createActor(machine);
    actor.start();
    actor.send({
      type: 'RECOGNIZE',
      sliceIndex: 0,
      hasExistingMask: false,
      hasAnnotations: false,
      hasPrevMask: false,
      volumeId: 'vol-1',
    });
    await waitFor(actor, (s) => s.value === 'done');
    expect(actor.getSnapshot().value).toBe('done');
  });

  it('sets result to success on successful recognition', async () => {
    const machine = stubMachine();
    const actor = createActor(machine);
    actor.start();
    actor.send({
      type: 'RECOGNIZE',
      sliceIndex: 0,
      hasExistingMask: false,
      hasAnnotations: false,
      hasPrevMask: false,
      volumeId: 'vol-1',
    });
    await waitFor(actor, (s) => s.value === 'done');
    expect(actor.getSnapshot().context.result).toBe('success');
  });

  it('sets result to failed when doRecognize errors', async () => {
    const machine = recognizeMachine.provide({
      actors: {
        askAdopt: fromPromise(() => Promise.resolve()),
        askCombine: fromPromise(() => Promise.resolve()),
        doRecognize: fromPromise(() => Promise.reject(new Error('fail'))),
      },
    });
    const actor = createActor(machine);
    actor.start();
    actor.send({
      type: 'RECOGNIZE',
      sliceIndex: 0,
      hasExistingMask: false,
      hasAnnotations: false,
      hasPrevMask: false,
      volumeId: 'vol-1',
    });
    await waitFor(actor, (s) => s.value === 'done');
    expect(actor.getSnapshot().context.result).toBe('failed');
  });

  it('sets context from RECOGNIZE event', () => {
    const machine = stubMachine();
    const actor = createActor(machine);
    actor.start();
    actor.send({
      type: 'RECOGNIZE',
      sliceIndex: 5,
      hasExistingMask: true,
      hasAnnotations: true,
      hasPrevMask: false,
      volumeId: 'vol-123',
    });
    const ctx = actor.getSnapshot().context;
    expect(ctx.sliceIndex).toBe(5);
    expect(ctx.hasExistingMask).toBe(true);
    expect(ctx.hasAnnotations).toBe(true);
    expect(ctx.volumeId).toBe('vol-123');
  });
});
