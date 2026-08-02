import { useEffect, useMemo } from 'react';
import { useMachine } from '@xstate/react';
import { useMemoizedFn } from 'ahooks';
import { match } from 'ts-pattern';
import { canvasMachine, type CanvasStoreAdapter, type CanvasEvent } from '@/machines/canvasMachine';
import { useLabel3DCanvasStore } from '@/store/label-3d-canvas';
import { logMessage } from '@/services/cmds';
import { canvasRefs } from './useCanvasRefs';

/** 构造供状态机读取/写入 Zustand store 的 adapter。getter 永远读实时状态。 */
function buildStoreAdapter(): CanvasStoreAdapter {
  const s = () => useLabel3DCanvasStore.getState();
  return {
    get mode() {
      return s().mode;
    },
    get tool() {
      return s().tool;
    },
    get stagePos() {
      return s().stagePos;
    },
    get currentObjectId() {
      return s().currentObjectId;
    },
    get pendingAnnotation() {
      return s().pendingAnnotation;
    },
    get imageWidth() {
      return s().imageWidth;
    },
    get imageHeight() {
      return s().imageHeight;
    },
    addBoxToObject: (objectId, box) => s().addBoxToObject(objectId, box),
    setStagePos: (pos) => s().setStagePos(pos),
    setPendingAnnotation: (pending) => s().setPendingAnnotation(pending),
  };
}

function getCursorStyle(stateValue: unknown, mode: string): string {
  return match(stateValue)
    .with('panning', () => 'grabbing')
    .with('moving', () => 'grabbing')
    .with('spaceHeld', () => 'grab')
    .otherwise(() =>
      match(mode)
        .with('create', () => 'crosshair')
        .with('delete', () => 'not-allowed')
        .with('move', () => 'grab')
        .otherwise(() => 'default')
    );
}

/**
 * 状态机交互 hook：
 * - safeSend：`snapshot.can(event)` 拦截非法事件并 logMessage('warn')
 * - actor.subscribe：记录状态转移
 * - 全局 mouseup 兜底：state ∈ {panning, boxDrawn} 时补发 MOUSE_UP
 * - 光标样式
 */
export function useCanvasInteraction() {
  const storeAdapter = useMemo(() => buildStoreAdapter(), []);

  const [snapshot, send, actor] = useMachine(canvasMachine, {
    input: { store: storeAdapter },
  });

  const safeSend = useMemoizedFn((event: CanvasEvent) => {
    if (actor.getSnapshot().can(event)) {
      send(event);
      return;
    }
    logMessage(
      'warn',
      `[canvas-machine] illegal event ${event.type} in state ${JSON.stringify(actor.getSnapshot().value)}`
    ).catch(() => {});
  });

  useEffect(() => {
    let prev: unknown = null;
    const sub = actor.subscribe((snap) => {
      const cur = snap.value;
      if (prev !== null && JSON.stringify(prev) !== JSON.stringify(cur)) {
        logMessage(
          'debug',
          `[canvas-machine] transition ${JSON.stringify(prev)} → ${JSON.stringify(cur)}`
        ).catch(() => {});
      }
      prev = cur;
    });
    return () => sub.unsubscribe();
  }, [actor]);

  // 全局 mouseup 兜底：防止在 Stage 外松手导致状态机卡死
  useEffect(() => {
    const onWindowMouseUp = () => {
      const stateValue = actor.getSnapshot().value as string;
      if (stateValue === 'panning' || stateValue === 'boxDrawn' || stateValue === 'moving') {
        safeSend({ type: 'MOUSE_UP' });
      }
    };
    window.addEventListener('mouseup', onWindowMouseUp);
    return () => window.removeEventListener('mouseup', onWindowMouseUp);
  }, [actor, safeSend]);

  const mode = useLabel3DCanvasStore((s) => s.mode);
  const cursorStyle = getCursorStyle(snapshot.value, mode);

  // 对象选择弹层关闭后清掉残留 tempBox，避免"选择"模式拖动时黄色虚框仍在
  const showObjectSelectPopup = useLabel3DCanvasStore((s) => s.showObjectSelectPopup);
  useEffect(() => {
    if (!showObjectSelectPopup && actor.getSnapshot().context.tempBox) {
      safeSend({ type: 'CLEAR_TEMP_BOX' });
    }
  }, [showObjectSelectPopup, actor, safeSend]);

  function handleStageMouseDown(e: { evt: { button: number; clientX: number; clientY: number } }) {
    const evt = e.evt;
    const imgPos = canvasRefs.getPointerImagePos(canvasRefs.getStage(), canvasRefs.getGroup());
    safeSend({
      type: 'MOUSE_DOWN',
      button: evt.button,
      clientX: evt.clientX,
      clientY: evt.clientY,
      imageX: imgPos?.x,
      imageY: imgPos?.y,
    });
  }

  function handleStageMouseMove(e: { evt: { clientX: number; clientY: number } }) {
    const imgPos = canvasRefs.getPointerImagePos(canvasRefs.getStage(), canvasRefs.getGroup());
    const s = useLabel3DCanvasStore.getState();
    s.setCursorImagePos(imgPos);
    s.setCursorScreenPos({ x: e.evt.clientX, y: e.evt.clientY });
    safeSend({
      type: 'MOUSE_MOVE',
      clientX: e.evt.clientX,
      clientY: e.evt.clientY,
      imageX: imgPos?.x,
      imageY: imgPos?.y,
    });
  }

  function handleStageMouseUp() {
    safeSend({ type: 'MOUSE_UP' });
  }

  function spaceDown() {
    if (!actor.getSnapshot().context.isSpaceDown) {
      safeSend({ type: 'SPACE_DOWN' });
    }
  }

  function spaceUp() {
    safeSend({ type: 'SPACE_UP' });
  }

  function handleReset() {
    safeSend({ type: 'RESET' });
  }

  function handleEscape() {
    safeSend({ type: 'ESC' });
  }

  const handleStageMouseDownMemo = useMemoizedFn(handleStageMouseDown);
  const handleStageMouseMoveMemo = useMemoizedFn(handleStageMouseMove);
  const handleStageMouseUpMemo = useMemoizedFn(handleStageMouseUp);
  const spaceDownMemo = useMemoizedFn(spaceDown);
  const spaceUpMemo = useMemoizedFn(spaceUp);
  const handleResetMemo = useMemoizedFn(handleReset);
  const handleEscapeMemo = useMemoizedFn(handleEscape);

  return {
    snapshot,
    actor,
    safeSend,
    cursorStyle,
    handleStageMouseDown: handleStageMouseDownMemo,
    handleStageMouseMove: handleStageMouseMoveMemo,
    handleStageMouseUp: handleStageMouseUpMemo,
    spaceDown: spaceDownMemo,
    spaceUp: spaceUpMemo,
    handleReset: handleResetMemo,
    handleEscape: handleEscapeMemo,
  };
}

export type CanvasInteractionApi = ReturnType<typeof useCanvasInteraction>;
