import { ref, type Ref } from 'vue';
import { cloneDeep } from 'es-toolkit';
import { match, P } from 'ts-pattern';
import { convertFileSrc } from '@tauri-apps/api/core';
import { rawSlice } from '@/services/raw3d';
import { segmentImage } from '@/services/sam3';
import { mcpStoreImageBytes, logMessage } from '@/services/cmd';
import { useMaskRenderer } from '@/composables/useMaskRenderer';
import { useCanvasToBytes } from '@/composables/useCanvasToBytes';
import type { Annotation, PointAnnotation, BoxAnnotation } from '@/types/annotation';
import type { Keyframe } from '@/stores/label-raw';

export interface UseRawRecognizeOpts {
  volumeId: Ref<string | null>;
  keyframes: Ref<Map<number, Keyframe>>;
  annotations: Ref<Annotation[]>;
  currentIndex: Ref<number>;
  totalSlices: Ref<number>;
  currentMaskUrl: Ref<string | null>;
  confidenceThreshold: Ref<number>;
  maskColor: Ref<string>;
  cloneKeyframes: () => void;
}

export function useRawRecognize(opts: UseRawRecognizeOpts) {
  const isRecognizing = ref(false);
  const progress = ref({ current: 0, total: 0 });

  function stopRecognition() {
    isRecognizing.value = false;
  }

  async function doRecognize(
    sliceIndex: number,
    kf: Keyframe,
    skipPrevMask = false
  ): Promise<boolean> {
    if (!opts.volumeId.value) return false;

    // Check if we have any prompt: annotations or prev_mask
    const hasAnnotations = kf.annotations.length > 0;
    let hasPrevMask = false;
    for (let i = sliceIndex - 1; i >= 0; i--) {
      const prevKf = opts.keyframes.value.get(i);
      if (prevKf?.rawMaskHash) {
        hasPrevMask = true;
        break;
      }
    }
    if (!hasAnnotations && !hasPrevMask) return false;

    await logMessage(
      'debug',
      `[recognize] slice=${sliceIndex} prompts=${hasAnnotations ? 'annotations' : ''} ${hasPrevMask ? 'prevMask' : ''}`
    );

    // Get the slice image as canvas data
    const resp = await rawSlice(opts.volumeId.value, sliceIndex);

    // Convert to PNG bytes via offscreen canvas
    const { canvasToPngBytes } = useCanvasToBytes();
    const bytes = await canvasToPngBytes(resp.data, resp.width, resp.height);

    // Validate PNG header: first 8 bytes should be PNG magic number
    const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
    await logMessage(
      'debug',
      `[recognize] slice=${sliceIndex} canvas→bytes: ${bytes.length} bytes, isPng=${isPng}, header=${bytes
        .slice(0, 8)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join(' ')}`
    );

    // Store in MCP content store
    const mcpUrl = await mcpStoreImageBytes(bytes, 'image/png');

    // Call SAM3
    const pPoints = kf.annotations
      .filter((a): a is PointAnnotation => a.type === 'p_point')
      .map((p) => [p.x, p.y] as [number, number]);
    const nPoints = kf.annotations
      .filter((a): a is PointAnnotation => a.type === 'n_point')
      .map((p) => [p.x, p.y] as [number, number]);
    const boxList = kf.annotations
      .filter((a): a is BoxAnnotation => a.type === 'box')
      .map((b) => [b.x1, b.y1, b.x2, b.y2] as [number, number, number, number]);

    // Find prev_mask: nearest previous slice that has a mask
    let prevMask: string | undefined;
    if (!skipPrevMask) {
      for (let i = sliceIndex - 1; i >= 0; i--) {
        const prevKf = opts.keyframes.value.get(i);
        if (prevKf?.rawMaskHash) {
          prevMask = prevKf.rawMaskHash;
          await logMessage(
            'debug',
            `[recognize] slice=${sliceIndex} using prev_mask from slice=${i}, hash=${prevMask}`
          );
          break;
        }
      }
    }

    const result = await segmentImage(mcpUrl, {
      p_point: pPoints.length > 0 ? pPoints : undefined,
      n_point: nPoints.length > 0 ? nPoints : undefined,
      boxes: boxList.length > 0 ? boxList : undefined,
      prev_mask: prevMask,
    });

    await logMessage(
      'debug',
      `[recognize] slice=${sliceIndex} SAM3 result: isError=${result.isError}, contentCount=${result.content.length}, types=[${result.content.map((b) => b.type).join(',')}]`
    );

    const imgBlock = result.content.find((b) => b.type === 'image');
    const textBlock = result.content.find((b) => b.type === 'text');

    return match(imgBlock)
      .with({ type: 'image', data: P.select() }, async (hash) => {
        kf.rawMaskHash = convertFileSrc(hash, 'mcp');
        const { renderMask } = useMaskRenderer();
        const maskUrl = await renderMask(
          kf.rawMaskHash,
          opts.confidenceThreshold.value,
          opts.maskColor.value
        );
        kf.maskUrl = maskUrl;
        if (sliceIndex === opts.currentIndex.value) {
          opts.currentMaskUrl.value = maskUrl;
        }
        await logMessage(
          'debug',
          `[recognize] slice=${sliceIndex} done, maskHash=${hash.slice(0, 16)}...`
        );
        return true;
      })
      .otherwise(async () => {
        const contentSummary = result.content.map((b) => b.type).join(', ');
        await logMessage(
          'warn',
          `[recognize] slice=${sliceIndex} no image in SAM3 result, got: [${contentSummary}]`
        );
        if (result.isError) {
          await logMessage(
            'error',
            `[recognize] slice=${sliceIndex} SAM3 error: ${textBlock && 'text' in textBlock ? textBlock.text : 'unknown'}`
          );
        }
        return false;
      });
  }

  async function recognizeCurrentSlice() {
    if (!opts.volumeId.value) return;

    // Clear mask display before showing any prompts
    opts.currentMaskUrl.value = null;

    // Check if current slice already has a mask
    const existingKf = opts.keyframes.value.get(opts.currentIndex.value);
    const hasExistingMask = !!existingKf?.rawMaskHash;

    // Check if both annotations and prev_mask exist
    const hasAnnotations = opts.annotations.value.length > 0;
    let hasPrevMask = false;
    for (let i = opts.currentIndex.value - 1; i >= 0; i--) {
      const prevKf = opts.keyframes.value.get(i);
      if (prevKf?.rawMaskHash) {
        hasPrevMask = true;
        break;
      }
    }

    const { ElMessageBox } = await import('element-plus');

    // Case 1: has existing mask, no annotation+prev_mask → ask adopt or re-recognize
    if (hasExistingMask && !(hasAnnotations && hasPrevMask)) {
      try {
        await ElMessageBox.confirm('已有 pred_mask，是否采用？', '提示', {
          confirmButtonText: '采用已有',
          cancelButtonText: '重新识别',
          type: 'info',
        });
        const { renderMask } = useMaskRenderer();
        const maskUrl = await renderMask(
          existingKf!.rawMaskHash!,
          opts.confidenceThreshold.value,
          opts.maskColor.value
        );
        existingKf!.maskUrl = maskUrl;
        opts.currentMaskUrl.value = maskUrl;
        return;
      } catch {
        // User chose to re-recognize — fall through
      }
    }

    // Case 2: has annotations + prev_mask → single prompt
    let skipPrevMask = false;
    if (hasAnnotations && hasPrevMask) {
      try {
        await ElMessageBox.confirm(
          '当前 slice 有标注且存在 prev_mask，是否结合 prev_mask 一同识别？',
          '提示',
          {
            confirmButtonText: '结合 prev_mask',
            cancelButtonText: '仅用标注',
            type: 'info',
          }
        );
      } catch {
        skipPrevMask = true;
      }
    }

    // Create or get keyframe
    let kf = opts.keyframes.value.get(opts.currentIndex.value);
    if (!kf) {
      kf = {
        annotations: cloneDeep(opts.annotations.value),
        maskUrl: null,
        maskVisible: true,
        rawMaskHash: null,
        manual: false,
      };
      opts.keyframes.value.set(opts.currentIndex.value, kf);
      opts.cloneKeyframes();
    }

    await doRecognize(opts.currentIndex.value, kf, skipPrevMask);
  }

  async function batchProcessKeyframes() {
    for (const [idx, kf] of opts.keyframes.value) {
      if (!kf.rawMaskHash && kf.annotations.length > 0) {
        await doRecognize(idx, kf);
      }
    }
  }

  async function recognizeAllSlices(endSlice?: number) {
    // Pre-check: need at least one keyframe with mask or annotations
    const hasAnyKeyframe = Array.from(opts.keyframes.value.values()).some(
      (kf) => kf.rawMaskHash !== null || kf.annotations.length > 0
    );
    if (!hasAnyKeyframe) {
      const { ElMessage } = await import('element-plus');
      ElMessage.warning('无关键帧，无法识别全部');
      await logMessage('warn', '[recognizeAll] refused: no keyframes with mask or annotations');
      return;
    }

    const effectiveEnd = endSlice ?? opts.totalSlices.value - 1;
    await logMessage('info', `[recognizeAll] start endSlice=${effectiveEnd}`);
    isRecognizing.value = true;
    progress.value = { current: 0, total: effectiveEnd + 1 };

    try {
      // Find starting point: first keyframe with mask, or first with annotations
      let startIdx = -1;
      for (const [idx, kf] of opts.keyframes.value) {
        if (kf.rawMaskHash) {
          startIdx = idx;
          break;
        }
      }
      if (startIdx === -1) {
        // No keyframe has mask yet — recognize first keyframe with annotations
        for (const [idx, kf] of opts.keyframes.value) {
          if (kf.annotations.length > 0) {
            const success = await doRecognize(idx, kf);
            if (success) {
              startIdx = idx;
            }
            break;
          }
        }
      }

      if (startIdx === -1) return;

      // Propagate prev_mask chain from startIdx
      let prevMaskHash: string | undefined =
        opts.keyframes.value.get(startIdx)?.rawMaskHash ?? undefined;

      for (let i = startIdx + 1; i <= effectiveEnd; i++) {
        if (!isRecognizing.value) break;

        progress.value = { current: i, total: effectiveEnd + 1 };

        const kf = opts.keyframes.value.get(i);
        if (kf) {
          if (kf.rawMaskHash) {
            // Keyframe has mask — use it as new prev_mask source
            prevMaskHash = kf.rawMaskHash;
          } else if (kf.annotations.length > 0) {
            // Keyframe has annotations but no mask — recognize it
            await doRecognize(i, kf);
            prevMaskHash = kf.rawMaskHash ?? undefined;
          }
          // else: keyframe has neither — skip (theoretically shouldn't happen)
        } else {
          // No keyframe — create temp keyframe and recognize with prev_mask
          if (prevMaskHash) {
            const tempKf: Keyframe = {
              annotations: [],
              maskUrl: null,
              maskVisible: true,
              rawMaskHash: null,
              manual: false,
            };
            opts.keyframes.value.set(i, tempKf);
            await doRecognize(i, tempKf);
            prevMaskHash = tempKf.rawMaskHash ?? undefined;
          }
        }
      }
    } finally {
      isRecognizing.value = false;
      await logMessage(
        'info',
        `[recognizeAll] finished, progress=${progress.value.current}/${progress.value.total}`
      );
    }
  }

  return {
    isRecognizing,
    progress,
    stopRecognition,
    recognizeCurrentSlice,
    batchProcessKeyframes,
    recognizeAllSlices,
  };
}
