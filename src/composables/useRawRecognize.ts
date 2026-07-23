import { ref, type Ref } from 'vue';
import { cloneDeep } from 'es-toolkit';
import { match, P } from 'ts-pattern';
import { convertFileSrc } from '@tauri-apps/api/core';
import { rawSlice } from '@/services/raw3d';
import { segmentImage } from '@/services/sam3';
import { mcpStoreImageBytes, logMessage } from '@/services/cmd';
import { useMaskRenderer } from '@/composables/useMaskRenderer';
import { useCanvasToBytes } from '@/composables/useCanvasToBytes';
import type { AnnotationObject } from '@/schemas/annotation';
import type { Keyframe } from '@/stores/label-raw';

export interface UseRawRecognizeOpts {
  volumeId: Ref<string | null>;
  keyframes: Ref<Map<number, Keyframe>>;
  objects: Ref<AnnotationObject[]>;
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

    // Check if we have any prompt: objects or prev_mask
    const hasObjects = kf.objects.some((o) => o.points.length > 0 || o.boxes.length > 0);
    let hasPrevMask = false;
    for (let i = sliceIndex - 1; i >= 0; i--) {
      const prevKf = opts.keyframes.value.get(i);
      if (prevKf?.rawMaskHash) {
        hasPrevMask = true;
        break;
      }
    }
    if (!hasObjects && !hasPrevMask) return false;

    await logMessage(
      'debug',
      `[recognize] slice=${sliceIndex} prompts=${hasObjects ? 'objects' : ''} ${hasPrevMask ? 'prevMask' : ''}`
    );

    // Get the slice image as canvas data
    const resp = await rawSlice(opts.volumeId.value, sliceIndex);

    // Convert to PNG bytes via offscreen canvas
    const { canvasToPngBytes } = useCanvasToBytes();
    const bytes = await canvasToPngBytes(resp.data, resp.width, resp.height);

    // Validate PNG header
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

    const result = await segmentImage(mcpUrl, kf.objects, prevMask);

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

    // Check if both objects and prev_mask exist
    const hasObjects = opts.objects.value.some((o) => o.points.length > 0 || o.boxes.length > 0);
    let hasPrevMask = false;
    for (let i = opts.currentIndex.value - 1; i >= 0; i--) {
      const prevKf = opts.keyframes.value.get(i);
      if (prevKf?.rawMaskHash) {
        hasPrevMask = true;
        break;
      }
    }

    const { ElMessageBox } = await import('element-plus');

    // Case 1: has existing mask, no objects+prev_mask → ask adopt or re-recognize
    if (hasExistingMask && !(hasObjects && hasPrevMask)) {
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

    // Case 2: has objects + prev_mask → single prompt
    let skipPrevMask = false;
    if (hasObjects && hasPrevMask) {
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
        objects: cloneDeep(opts.objects.value),
        maskUrl: null,
        maskVisible: true,
        rawMaskHash: null,
      };
      opts.keyframes.value.set(opts.currentIndex.value, kf);
      opts.cloneKeyframes();
    }

    await doRecognize(opts.currentIndex.value, kf, skipPrevMask);
  }

  async function batchRecognize(start: number, end: number) {
    // Foolproofing: invalid range
    if (start >= end) {
      const { ElMessage } = await import('element-plus');
      ElMessage.error('起始 slice 必须小于结束 slice');
      return;
    }

    // Foolproofing: start slice has no seed
    const startKf = opts.keyframes.value.get(start);
    const startHasMask = !!startKf?.rawMaskHash;
    const startHasObjects =
      startKf?.objects.some((o) => o.points.length > 0 || o.boxes.length > 0) ?? false;
    if (!startHasMask && !startHasObjects) {
      const { ElMessageBox } = await import('element-plus');
      try {
        await ElMessageBox.confirm(
          '起点 slice 无标注也无 mask，传播效果可能差。是否继续？',
          '提示',
          { confirmButtonText: '继续', cancelButtonText: '取消', type: 'warning' }
        );
      } catch {
        return;
      }
    }

    await logMessage('info', `[batchRecognize] start=${start} end=${end}`);
    isRecognizing.value = true;
    progress.value = { current: 0, total: end - start + 1 };

    try {
      let prevMaskHash: string | undefined;

      for (let i = start; i <= end; i++) {
        if (!isRecognizing.value) break;

        progress.value = { current: i - start, total: end - start + 1 };

        let kf = opts.keyframes.value.get(i);

        // Skip if already has mask
        if (kf?.rawMaskHash) {
          prevMaskHash = kf.rawMaskHash;
          continue;
        }

        // Create keyframe if none exists
        if (!kf) {
          kf = {
            objects: [],
            maskUrl: null,
            maskVisible: true,
            rawMaskHash: null,
          };
          opts.keyframes.value.set(i, kf);
        }

        const hasObjects = kf.objects.some((o) => o.points.length > 0 || o.boxes.length > 0);

        // Skip if no objects and no prev_mask
        if (!hasObjects && !prevMaskHash) {
          continue;
        }

        await doRecognize(i, kf, !prevMaskHash);
        prevMaskHash = kf.rawMaskHash ?? prevMaskHash;
      }
    } finally {
      isRecognizing.value = false;
      opts.cloneKeyframes();
      await logMessage(
        'info',
        `[batchRecognize] finished, progress=${progress.value.current}/${progress.value.total}`
      );
    }
  }

  return {
    isRecognizing,
    progress,
    stopRecognition,
    recognizeCurrentSlice,
    batchRecognize,
  };
}
