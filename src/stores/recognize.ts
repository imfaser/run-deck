import { defineStore } from 'pinia';
import { ref } from 'vue';
import { cloneDeep } from 'es-toolkit';
import { match, P } from 'ts-pattern';
import { ElMessage } from 'element-plus/es/components/message/index.mjs';
import { ElMessageBox } from 'element-plus/es/components/message-box/index.mjs';
import { rawSlice } from '@/services/raw3d';
import { segmentImage } from '@/services/sam3';
import { mcpStoreImageBytes, logMessage } from '@/services/cmd';
import { useMaskRenderer } from '@/composables/useMaskRenderer';
import { useCanvasToBytes } from '@/composables/useCanvasToBytes';
import { getKeyframe, putKeyframe } from '@/db/keyframe-repo';
import { useLabel3dCanvasStore } from '@/stores/canvas-3d';
import { useLabel3dStore } from '@/stores/label-3d';
import { useLabel3dMaskStore } from '@/stores/mask';
import type { KeyframeRecord } from '@/schemas/keyframe';

export const useLabel3dRecognizeStore = defineStore('recognize-3d', () => {
  const canvas = useLabel3dCanvasStore();
  const label3d = useLabel3dStore();
  const mask = useLabel3dMaskStore();

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
    const volId = label3d.volumeId;
    if (!volId) return false;

    try {
      const hasObjects = kf.objects.some((o) => o.points.length > 0 || o.boxes.length > 0);
      let hasPrevMask = !!prevMaskHash;
      if (!hasPrevMask && !skipPrevMask) {
        for (let i = sliceIndex - 1; i >= 0; i--) {
          const prevKf = await getKeyframe(volId, i);
          if (prevKf?.rawMaskHash) {
            hasPrevMask = true;
            break;
          }
        }
      }
      if (!hasObjects && !hasPrevMask) {
        await logMessage('debug', `[recognize] slice=${sliceIndex} early return: no objects & no prevMask`);
        return false;
      }

      await logMessage(
        'info',
        `[recognize] slice=${sliceIndex} START: objects=${kf.objects.length} hasObjects=${hasObjects} hasPrevMask=${hasPrevMask} skipPrevMask=${skipPrevMask} prevMaskHash=${prevMaskHash ? prevMaskHash.slice(0, 40) : 'none'}`
      );

      const resp = await rawSlice(volId, sliceIndex);

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
      await logMessage('debug', `[recognize] slice=${sliceIndex} mcpUrl=${mcpUrl.slice(0, 80)}`);

      // Find prev_mask: use provided hash or search nearest previous slice
      let prevMask: string | undefined = prevMaskHash ? prevMaskHash : undefined;
      if (!prevMask && !skipPrevMask) {
        for (let i = sliceIndex - 1; i >= 0; i--) {
          const prevKf = await getKeyframe(volId, i);
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

      await logMessage(
        'debug',
        `[recognize] slice=${sliceIndex} calling segmentImage: objects=${kf.objects.length} prevMask=${prevMask ? prevMask.slice(0, 40) : 'none'}`
      );
      const result = await segmentImage(mcpUrl, kf.objects, prevMask);
      await logMessage(
        'info',
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
            mask.maskSettings.threshold,
            mask.maskSettings.color
          );
          await logMessage(
            'debug',
            `[recognize] slice=${sliceIndex} renderMask result: maskUrl=${maskUrl ? `dataURL(${maskUrl.length} chars)` : 'null'}`
          );

          await putKeyframe(volId, sliceIndex, {
            objects: kf.objects,
            rawMaskHash,
            maskUrl,
            maskVisible: kf.maskVisible,
          });

          if (sliceIndex === label3d.currentIndex) {
            mask.setCurrentMaskUrl(maskUrl);
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
    const volId = label3d.volumeId;
    if (!volId) return;

    mask.setCurrentMaskUrl(null);

    try {
      const existingKf = await getKeyframe(volId, label3d.currentIndex);
      const hasExistingMask = !!existingKf?.rawMaskHash;

      const hasObjects = canvas.objects.some((o) => o.points.length > 0 || o.boxes.length > 0);
      let hasPrevMask = false;
      for (let i = label3d.currentIndex - 1; i >= 0; i--) {
        const prevKf = await getKeyframe(volId, i);
        if (prevKf?.rawMaskHash) {
          hasPrevMask = true;
          break;
        }
      }

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
            mask.maskSettings.threshold,
            mask.maskSettings.color
          );
          await putKeyframe(volId, label3d.currentIndex, {
            maskUrl,
          });
          mask.setCurrentMaskUrl(maskUrl);
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
      let kf = await getKeyframe(volId, label3d.currentIndex);
      if (!kf) {
        kf = {
          volumeId: volId,
          sliceIndex: label3d.currentIndex,
          objects: cloneDeep(canvas.objects),
          maskUrl: null,
          maskVisible: true,
          rawMaskHash: null,
        };
        await putKeyframe(volId, label3d.currentIndex, {
          objects: kf.objects,
        });
      }

      await doRecognize(label3d.currentIndex, kf, skipPrevMask);
    } catch (e) {
      await logMessage('error', `[recognize] recognizeCurrentSlice failed: ${e}`);
    }
  }

  async function batchRecognize(start: number, end: number) {
    if (start >= end) {
      ElMessage.error('起始 slice 必须小于结束 slice');
      return;
    }

    const volId = label3d.volumeId;
    if (!volId) return;

    const startKf = await getKeyframe(volId, start);
    const startHasMask = !!startKf?.rawMaskHash;
    const startHasObjects =
      startKf?.objects.some((o) => o.points.length > 0 || o.boxes.length > 0) ?? false;
    if (!startHasMask && !startHasObjects) {
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

        let kf = await getKeyframe(volId, i);

        if (kf?.rawMaskHash) {
          await logMessage(
            'debug',
            `[batchRecognize] slice=${i} has rawMaskHash=${kf.rawMaskHash.slice(0, 40)}..., trying render`
          );
          // Has mask reference — try to render for display
          try {
            const { renderMask } = useMaskRenderer();
            const url = await renderMask(
              kf.rawMaskHash,
              mask.maskSettings.threshold,
              mask.maskSettings.color
            );
            prevMaskHash = kf.rawMaskHash;
            if (i === label3d.currentIndex) {
              mask.setCurrentMaskUrl(url);
            }
            await putKeyframe(volId, i, { maskUrl: url });
            await logMessage('debug', `[batchRecognize] slice=${i} render OK, skip`);
            continue;
          } catch (e) {
            await logMessage(
              'warn',
              `[batchRecognize] slice=${i} mask render failed (stale hash?), re-recognizing: ${e}`
            );
            // Mask data not available — fall through to re-recognize
          }
        }

        if (!kf) {
          if (!prevMaskHash) {
            await logMessage('debug', `[batchRecognize] slice=${i} no keyframe & no prevMaskHash, skip`);
            continue;
          }
          // No keyframe but has prevMask — create temp keyframe for prev-mask-only recognition
          await logMessage('debug', `[batchRecognize] slice=${i} no keyframe, using prevMask only`);
          kf = {
            volumeId: volId,
            sliceIndex: i,
            objects: [],
            maskUrl: null,
            maskVisible: true,
            rawMaskHash: null,
          };
        }

        const hasObjects = kf.objects.some((o) => o.points.length > 0 || o.boxes.length > 0);

        if (!hasObjects && !prevMaskHash) {
          await logMessage('debug', `[batchRecognize] slice=${i} no objects & no prevMaskHash, skip`);
          continue;
        }

        await logMessage(
          'info',
          `[batchRecognize] slice=${i} calling doRecognize: hasObjects=${hasObjects} prevMaskHash=${prevMaskHash ? prevMaskHash.slice(0, 40) : 'none'}`
        );
        const recognized = await doRecognize(i, kf, !prevMaskHash, prevMaskHash);
        // Re-fetch to get updated rawMaskHash after doRecognize wrote it
        const updatedKf = await getKeyframe(volId, i);
        prevMaskHash = updatedKf?.rawMaskHash ?? prevMaskHash;

        // Update currentMaskUrl for display when navigating to this slice
        if (recognized && updatedKf?.maskUrl) {
          mask.setCurrentMaskUrl(updatedKf.maskUrl);
        }

        await logMessage(
          'debug',
          `[batchRecognize] slice=${i} done, recognized=${recognized}, prevMaskHash=${prevMaskHash ? prevMaskHash.slice(0, 40) : 'none'}`
        );
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
});
