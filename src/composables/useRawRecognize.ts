import { ref, type Ref } from 'vue';
import { cloneDeep } from 'es-toolkit';
import { match, P } from 'ts-pattern';
import { rawSlice } from '@/services/raw3d';
import { segmentImage } from '@/services/sam3';
import { mcpStoreImageBytes, logMessage } from '@/services/cmd';
import { useMaskRenderer } from '@/composables/useMaskRenderer';
import { useCanvasToBytes } from '@/composables/useCanvasToBytes';
import type { AnnotationObject } from '@/schemas/annotation';
import type { KeyframeRecord } from '@/db/label-raw-db';

export interface UseRawRecognizeOpts {
  volumeId: Ref<string | null>;
  getKeyframe: (volId: string, idx: number) => Promise<KeyframeRecord | undefined>;
  putKeyframe: (volId: string, sliceIndex: number, data: Partial<KeyframeRecord>) => Promise<void>;
  objects: Ref<AnnotationObject[]>;
  currentIndex: Ref<number>;
  totalSlices: Ref<number>;
  currentMaskUrl: Ref<string | null>;
  confidenceThreshold: Ref<number>;
  maskColor: Ref<string>;
}

export function useRawRecognize(opts: UseRawRecognizeOpts) {
  const isRecognizing = ref(false);
  const progress = ref({ current: 0, total: 0 });

  function stopRecognition() {
    isRecognizing.value = false;
  }

  async function doRecognize(
    sliceIndex: number,
    kf: KeyframeRecord,
    skipPrevMask = false,
    prevMaskHash?: string
  ): Promise<boolean> {
    if (!opts.volumeId.value) return false;

    try {
      const hasObjects = kf.objects.some((o) => o.points.length > 0 || o.boxes.length > 0);
      let hasPrevMask = !!prevMaskHash;
      if (!hasPrevMask && !skipPrevMask) {
        for (let i = sliceIndex - 1; i >= 0; i--) {
          const prevKf = await opts.getKeyframe(opts.volumeId.value, i);
          if (prevKf?.rawMaskHash) {
            hasPrevMask = true;
            break;
          }
        }
      }
      if (!hasObjects && !hasPrevMask) return false;

      await logMessage(
        'debug',
        `[recognize] slice=${sliceIndex} prompts=${hasObjects ? 'objects' : ''} ${hasPrevMask ? 'prevMask' : ''}`
      );

      const resp = await rawSlice(opts.volumeId.value, sliceIndex);

      const { canvasToPngBytes } = useCanvasToBytes();
      const bytes = await canvasToPngBytes(resp.data, resp.width, resp.height);

      const isPng =
        bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
      await logMessage(
        'debug',
        `[recognize] slice=${sliceIndex} canvas→bytes: ${bytes.length} bytes, isPng=${isPng}, header=${bytes
          .slice(0, 8)
          .map((b) => b.toString(16).padStart(2, '0'))
          .join(' ')}`
      );

      const mcpUrl = await mcpStoreImageBytes(bytes, 'image/png');

      // Find prev_mask: use provided hash or search nearest previous slice
      let prevMask: string | undefined = prevMaskHash ? prevMaskHash : undefined;
      if (!prevMask && !skipPrevMask) {
        for (let i = sliceIndex - 1; i >= 0; i--) {
          const prevKf = await opts.getKeyframe(opts.volumeId.value, i);
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
        `[recognize] slice=${sliceIndex} SAM3 returned: isError=${result.isError}, content=[${result.content.map((b) => b.type).join(',')}]`
      );

      const imgBlock = result.content.find((b) => b.type === 'image');
      const textBlock = result.content.find((b) => b.type === 'text');
      await logMessage(
        'debug',
        `[recognize] slice=${sliceIndex} imgBlock=${imgBlock ? 'found' : 'null'} data=${imgBlock && 'data' in imgBlock ? String(imgBlock.data).slice(0, 60) : 'N/A'}`
      );

      return match(imgBlock)
        .with({ type: 'image', data: P.select() }, async (rawMaskHash) => {
          await logMessage(
            'debug',
            `[recognize] slice=${sliceIndex} rawMaskHash=${rawMaskHash.slice(0, 80)}`
          );
          const { renderMask } = useMaskRenderer();
          const maskUrl = await renderMask(
            rawMaskHash,
            opts.confidenceThreshold.value,
            opts.maskColor.value
          );
          await logMessage(
            'debug',
            `[recognize] slice=${sliceIndex} renderMask result: maskUrl=${maskUrl ? `dataURL(${maskUrl.length} chars)` : 'null'}`
          );

          await opts.putKeyframe(opts.volumeId.value!, sliceIndex, {
            objects: kf.objects,
            rawMaskHash,
            maskUrl,
            maskVisible: kf.maskVisible,
          });

          if (sliceIndex === opts.currentIndex.value) {
            opts.currentMaskUrl.value = maskUrl;
            await logMessage(
              'debug',
              `[recognize] slice=${sliceIndex} set currentMaskUrl: ${maskUrl ? 'has url' : 'null'}`
            );
          }
          await logMessage('info', `[recognize] slice=${sliceIndex} done`);
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
    } catch (e) {
      await logMessage('error', `[recognize] slice=${sliceIndex} unexpected error: ${e}`);
      return false;
    }
  }

  async function recognizeCurrentSlice() {
    if (!opts.volumeId.value) return;

    opts.currentMaskUrl.value = null;

    try {
      const existingKf = await opts.getKeyframe(opts.volumeId.value, opts.currentIndex.value);
      const hasExistingMask = !!existingKf?.rawMaskHash;

      const hasObjects = opts.objects.value.some((o) => o.points.length > 0 || o.boxes.length > 0);
      let hasPrevMask = false;
      for (let i = opts.currentIndex.value - 1; i >= 0; i--) {
        const prevKf = await opts.getKeyframe(opts.volumeId.value, i);
        if (prevKf?.rawMaskHash) {
          hasPrevMask = true;
          break;
        }
      }

      const { ElMessageBox } = await import('element-plus');

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
          await opts.putKeyframe(opts.volumeId.value!, opts.currentIndex.value, {
            maskUrl,
          });
          opts.currentMaskUrl.value = maskUrl;
          return;
        } catch {
          // User chose to re-recognize — fall through
        }
      }

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

      // Get or create keyframe
      let kf = await opts.getKeyframe(opts.volumeId.value, opts.currentIndex.value);
      if (!kf) {
        kf = {
          volumeId: opts.volumeId.value,
          sliceIndex: opts.currentIndex.value,
          objects: cloneDeep(opts.objects.value),
          maskUrl: null,
          maskVisible: true,
          rawMaskHash: null,
        };
        await opts.putKeyframe(opts.volumeId.value, opts.currentIndex.value, {
          objects: kf.objects,
        });
      }

      await doRecognize(opts.currentIndex.value, kf, skipPrevMask);
    } catch (e) {
      await logMessage('error', `[recognize] recognizeCurrentSlice failed: ${e}`);
    }
  }

  async function batchRecognize(start: number, end: number) {
    if (start >= end) {
      const { ElMessage } = await import('element-plus');
      ElMessage.error('起始 slice 必须小于结束 slice');
      return;
    }

    const volId = opts.volumeId.value;
    if (!volId) return;

    const startKf = await opts.getKeyframe(volId, start);
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

        progress.value = { current: i - start + 1, total: end - start + 1 };

        let kf = await opts.getKeyframe(volId, i);

        if (kf?.rawMaskHash) {
          // Already has mask — update local tracking
          prevMaskHash = kf.rawMaskHash;

          // If this is the current slice, render its mask for display
          if (i === opts.currentIndex.value) {
            try {
              const { renderMask } = useMaskRenderer();
              opts.currentMaskUrl.value = await renderMask(
                kf.rawMaskHash,
                opts.confidenceThreshold.value,
                opts.maskColor.value
              );
            } catch (e) {
              await logMessage(
                'warn',
                `[batchRecognize] slice=${i} failed to render existing mask: ${e}`
              );
            }
          }
          continue;
        }

        if (!kf) {
          kf = {
            volumeId: volId,
            sliceIndex: i,
            objects: [],
            maskUrl: null,
            maskVisible: true,
            rawMaskHash: null,
          };
          // Write to IDB so doRecognize can find it as prevMask for next slices
          await opts.putKeyframe(volId, i, { objects: [] });
        }

        const hasObjects = kf.objects.some((o) => o.points.length > 0 || o.boxes.length > 0);

        if (!hasObjects && !prevMaskHash) {
          continue;
        }

        await doRecognize(i, kf, !prevMaskHash, prevMaskHash);
        // Re-fetch to get updated rawMaskHash after doRecognize wrote it
        const updatedKf = await opts.getKeyframe(volId, i);
        prevMaskHash = updatedKf?.rawMaskHash ?? prevMaskHash;
      }
    } finally {
      isRecognizing.value = false;
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
