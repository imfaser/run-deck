import { setup, assign, fromPromise } from 'xstate';

interface RecognizeContext {
  sliceIndex: number;
  hasExistingMask: boolean;
  hasAnnotations: boolean;
  hasPrevMask: boolean;
  skipPrevMask: boolean;
  result: 'success' | 'failed' | null;
  volumeId: string | null;
}

type RecognizeEvent =
  | {
      type: 'RECOGNIZE';
      sliceIndex: number;
      hasExistingMask: boolean;
      hasAnnotations: boolean;
      hasPrevMask: boolean;
      volumeId: string;
    }
  | { type: 'ADOPT' }
  | { type: 'RE_RECOGNIZE' }
  | { type: 'COMBINE' }
  | { type: 'ANNOTATIONS_ONLY' }
  | { type: 'STOP' };

export const recognizeMachine = setup({
  types: {
    context: {} as RecognizeContext,
    events: {} as RecognizeEvent,
  },
  actors: {
    askAdopt: fromPromise(() => Promise.resolve()),
    askCombine: fromPromise(() => Promise.resolve()),
    doRecognize: fromPromise(() => Promise.resolve()),
  },
  actions: {
    initContext: assign(({ event }) => {
      if (event.type !== 'RECOGNIZE') return {};
      return {
        sliceIndex: event.sliceIndex,
        hasExistingMask: event.hasExistingMask,
        hasAnnotations: event.hasAnnotations,
        hasPrevMask: event.hasPrevMask,
        volumeId: event.volumeId,
        skipPrevMask: false,
        result: null,
      };
    }),
    setSkipPrevMask: assign({ skipPrevMask: true }),
    setResultSuccess: assign({ result: 'success' as const }),
    setResultFailed: assign({ result: 'failed' as const }),
    reset: assign({
      result: null,
      skipPrevMask: false,
      hasExistingMask: false,
      hasAnnotations: false,
      hasPrevMask: false,
    }),
  },
  guards: {
    hasExistingMaskNoCombine: ({ context }) => {
      return context.hasExistingMask && !(context.hasAnnotations && context.hasPrevMask);
    },
    hasAnnotationsAndPrevMask: ({ context }) => {
      return context.hasAnnotations && context.hasPrevMask;
    },
  },
}).createMachine({
  id: 'recognize',
  initial: 'idle',
  context: {
    sliceIndex: 0,
    hasExistingMask: false,
    hasAnnotations: false,
    hasPrevMask: false,
    skipPrevMask: false,
    result: null,
    volumeId: null,
  },
  states: {
    idle: {
      on: {
        RECOGNIZE: {
          target: 'checking',
          actions: 'initContext',
        },
      },
    },
    checking: {
      always: [
        {
          guard: 'hasExistingMaskNoCombine',
          target: 'askAdopt',
        },
        {
          guard: 'hasAnnotationsAndPrevMask',
          target: 'askCombine',
        },
        {
          target: 'recognizing',
        },
      ],
    },
    askAdopt: {
      invoke: {
        src: 'askAdopt',
        onDone: {
          target: 'done',
          actions: 'setResultSuccess',
        },
        onError: {
          target: 'recognizing',
        },
      },
    },
    askCombine: {
      invoke: {
        src: 'askCombine',
        onDone: {
          target: 'recognizing',
        },
        onError: {
          target: 'recognizing',
          actions: 'setSkipPrevMask',
        },
      },
    },
    recognizing: {
      invoke: {
        src: 'doRecognize',
        onDone: {
          target: 'done',
          actions: 'setResultSuccess',
        },
        onError: {
          target: 'done',
          actions: 'setResultFailed',
        },
      },
      on: {
        STOP: {
          target: 'idle',
          actions: 'reset',
        },
      },
    },
    done: {
      on: {
        RECOGNIZE: {
          target: 'checking',
          actions: 'initContext',
        },
      },
    },
  },
});
