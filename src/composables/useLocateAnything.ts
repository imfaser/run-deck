import { type Ref } from 'vue';
import {
  detectObjects,
  detectVisual,
  cropImageRegion,
  type BoundingBox,
} from '@/services/locate-anything';
import { logMessage } from '@/services/cmd';
import type { AnnotationObject, BoxAnnotation } from '@/schemas/annotation';
import type { SubLabel } from '@/schemas/label';
import type { LocateConfig, DetectProgress } from '@/schemas/locate';

export interface LabelDefStoreLike {
  labels: { id: string; name: string }[];
  labelById: (id: string) => { id: string; name: string } | undefined;
  subLabelsByParent: (parentId: string) => SubLabel[];
  getLocateConfig: (labelId: string) => LocateConfig | undefined;
  getDetectProgress: (labelId: string) => DetectProgress | undefined;
  updateDetectProgress: (labelId: string, patch: Partial<Omit<DetectProgress, 'labelId'>>) => void;
}

export interface UseLocateAnythingOpts {
  volumeId: Ref<string | null>;
  currentIndex: Ref<number>;
  imageWidth: Ref<number>;
  imageHeight: Ref<number>;
  getKeyframe: (volId: string, idx: number) => Promise<{ objects: AnnotationObject[] } | undefined>;
  putKeyframe: (
    volId: string,
    sliceIndex: number,
    data: Partial<{ objects: AnnotationObject[] }>
  ) => Promise<void>;
  imagePath: Ref<string | null>;
  objects: Ref<AnnotationObject[]>;
  labelDefStore: LabelDefStoreLike;
}

export function boxesToAnnotationObjects(
  boxes: BoundingBox[],
  parentLabelName: string,
  sublabels: SubLabel[],
  labelDefStore: LabelDefStoreLike,
  imageWidth: number,
  imageHeight: number
): AnnotationObject[] {
  const grouped = new Map<string, BoundingBox[]>();
  for (const box of boxes) {
    const list = grouped.get(box.name) ?? [];
    list.push(box);
    grouped.set(box.name, list);
  }

  const result: AnnotationObject[] = [];

  for (const [name, boxList] of grouped) {
    const subLabel = sublabels.find((sl) => sl.name === name);
    const parentLabel = subLabel
      ? labelDefStore.labelById(subLabel.parentId)
      : labelDefStore.labels.find((l) => l.name === parentLabelName);

    const boxAnnotations: BoxAnnotation[] = boxList.map((b) => ({
      id: crypto.randomUUID(),
      x1: (b.x1 / 1000) * imageWidth,
      y1: (b.y1 / 1000) * imageHeight,
      x2: (b.x2 / 1000) * imageWidth,
      y2: (b.y2 / 1000) * imageHeight,
    }));

    result.push({
      id: crypto.randomUUID(),
      labelId: parentLabel?.id ?? '',
      subLabelId: subLabel?.id,
      points: [],
      boxes: boxAnnotations,
    });
  }

  return result;
}

export function useLocateAnything(opts: UseLocateAnythingOpts) {
  const { labelDefStore } = opts;

  async function runDetectForImage(
    imagePath: string,
    labelId: string,
    imageWidth: number,
    imageHeight: number
  ): Promise<AnnotationObject[]> {
    await logMessage(
      'info',
      `[locate] runDetectForImage start: labelId=${labelId} imagePath=${imagePath.substring(0, 50)}...`
    );

    const config = labelDefStore.getLocateConfig(labelId);
    if (!config) {
      await logMessage('error', `[locate] No locate config for label ${labelId}`);
      throw new Error(`No locate config for label ${labelId}`);
    }
    await logMessage(
      'info',
      `[locate] config: mode=${config.mode} visualType=${config.visualType} range=[${config.rangeStart},${config.rangeEnd}]`
    );

    const parentSubLabels = labelDefStore.subLabelsByParent(labelId);
    const parentLabel = labelDefStore.labelById(labelId);
    await logMessage(
      'info',
      `[locate] sublabels count=${parentSubLabels.length} parentLabel=${parentLabel?.name ?? 'null'}`
    );

    let boxes: BoundingBox[];

    if (config.mode === 'detect') {
      const categories = parentSubLabels.map((sl) => sl.name);
      if (categories.length === 0) {
        // No sublabels - use parent label name as category
        if (parentLabel) {
          await logMessage(
            'info',
            `[locate] no sublabels, using parent label "${parentLabel.name}" as category`
          );
          categories.push(parentLabel.name);
        } else {
          await logMessage('warn', `[locate] no sublabels and no parent label for ${labelId}`);
          return [];
        }
      }
      await logMessage(
        'info',
        `[locate] calling detectObjects with categories: ${JSON.stringify(categories)}`
      );
      boxes = await detectObjects(imagePath, categories);
      await logMessage('info', `[locate] detectObjects returned ${boxes.length} boxes`);
    } else {
      if (!config.visualRefObjectId && !config.visualRefImagePath) {
        await logMessage('error', `[locate] detect_visual needs visual reference`);
        throw new Error('detect_visual 需要视觉参考，请先设置');
      }

      if (config.visualType === 'external_image' && config.visualRefImagePath) {
        await logMessage(
          'info',
          `[locate] detect_visual with external image: ${config.visualRefImagePath}`
        );
        const croppedMcpUrl = await cropImageRegion(config.visualRefImagePath, {
          x1: 0,
          y1: 0,
          x2: 10000,
          y2: 10000,
        });
        await logMessage(
          'info',
          `[locate] cropped external image to: ${croppedMcpUrl.substring(0, 50)}...`
        );
        boxes = await detectVisual(imagePath, [0, 0, 1000, 1000], croppedMcpUrl);
      } else if (config.visualRefObjectId) {
        await logMessage(
          'info',
          `[locate] detect_visual with visual ref object: ${config.visualRefObjectId}`
        );
        const refBox = findVisualBoxInCurrentObjects(config.visualRefObjectId);
        if (!refBox) {
          await logMessage(
            'error',
            `[locate] visual ref box not found for ${config.visualRefObjectId}`
          );
          throw new Error('找不到视觉参考框，请重新设置');
        }
        await logMessage(
          'info',
          `[locate] refBox: x1=${refBox.x1} y1=${refBox.y1} x2=${refBox.x2} y2=${refBox.y2}`
        );
        const croppedMcpUrl = await cropImageRegion(imagePath, refBox);
        await logMessage(
          'info',
          `[locate] cropped visual ref to: ${croppedMcpUrl.substring(0, 50)}...`
        );
        const normalizedBox: [number, number, number, number] = [
          (refBox.x1 / imageWidth) * 1000,
          (refBox.y1 / imageHeight) * 1000,
          (refBox.x2 / imageWidth) * 1000,
          (refBox.y2 / imageHeight) * 1000,
        ];
        boxes = await detectVisual(imagePath, normalizedBox, croppedMcpUrl);
      } else {
        await logMessage('error', `[locate] detect_visual config incomplete`);
        throw new Error('detect_visual 配置不完整');
      }
      await logMessage('info', `[locate] detectVisual returned ${boxes.length} boxes`);
    }

    const annotationObjects = boxesToAnnotationObjects(
      boxes,
      parentLabel?.name ?? '',
      parentSubLabels,
      labelDefStore,
      imageWidth,
      imageHeight
    );
    await logMessage(
      'info',
      `[locate] converted to ${annotationObjects.length} annotation objects`
    );
    return annotationObjects;
  }

  function findVisualBoxInCurrentObjects(objectId: string): BoxAnnotation | undefined {
    for (const obj of opts.objects.value) {
      if (obj.id === objectId && obj.boxes.length > 0) {
        return obj.boxes[0];
      }
    }
    return undefined;
  }

  async function runDetectForCurrentImage(labelId: string): Promise<AnnotationObject[]> {
    const imagePath = opts.imagePath.value;
    if (!imagePath) {
      await logMessage('error', `[locate] runDetectForCurrentImage: no image path`);
      throw new Error('未打开图片');
    }
    await logMessage(
      'info',
      `[locate] runDetectForCurrentImage: labelId=${labelId} imagePath=${imagePath.substring(0, 50)}...`
    );
    return runDetectForImage(imagePath, labelId, opts.imageWidth.value, opts.imageHeight.value);
  }

  async function batchDetect(
    labelId: string,
    onProgress?: (current: number, total: number) => void
  ): Promise<void> {
    const volId = opts.volumeId.value;
    if (!volId) {
      await logMessage('error', `[locate] batchDetect: no volume id`);
      throw new Error('未打开 volume');
    }

    const config = labelDefStore.getLocateConfig(labelId);
    if (!config) {
      await logMessage('error', `[locate] batchDetect: no config for label ${labelId}`);
      throw new Error(`No locate config for label ${labelId}`);
    }

    const { rangeStart, rangeEnd } = config;
    // Fix: allow rangeStart === rangeEnd for single slice detection
    if (rangeStart < 0 || rangeEnd < 0) {
      await logMessage('error', `[locate] batchDetect: invalid range [${rangeStart},${rangeEnd}]`);
      throw new Error('作用范围无效');
    }

    const total = Math.max(rangeEnd - rangeStart + 1, 1);
    await logMessage(
      'info',
      `[locate] batchDetect start: labelId=${labelId} range=[${rangeStart},${rangeEnd}] total=${total}`
    );

    labelDefStore.updateDetectProgress(labelId, {
      current: 0,
      total,
      status: 'running',
    });

    try {
      for (let i = rangeStart; i <= rangeEnd; i++) {
        const progress = labelDefStore.getDetectProgress(labelId);
        if (progress?.status !== 'running') {
          await logMessage('info', `[locate] batchDetect cancelled at slice ${i}`);
          break;
        }

        const currentProgress = i - rangeStart + 1;
        labelDefStore.updateDetectProgress(labelId, { current: currentProgress });
        onProgress?.(currentProgress, total);

        await logMessage('info', `[locate] processing slice ${i} (${currentProgress}/${total})`);

        try {
          const sliceResp = await import('@/services/raw3d').then((m) => m.rawSlice(volId, i));
          await logMessage(
            'info',
            `[locate] rawSlice loaded: width=${sliceResp.width} height=${sliceResp.height}`
          );

          const canvas = document.createElement('canvas');
          canvas.width = sliceResp.width;
          canvas.height = sliceResp.height;
          const ctx = canvas.getContext('2d')!;
          const imageData = ctx.createImageData(sliceResp.width, sliceResp.height);
          for (let j = 0; j < sliceResp.data.length; j++) {
            const idx = j * 4;
            imageData.data[idx] = sliceResp.data[j];
            imageData.data[idx + 1] = sliceResp.data[j];
            imageData.data[idx + 2] = sliceResp.data[j];
            imageData.data[idx + 3] = 255;
          }
          ctx.putImageData(imageData, 0, 0);
          const sliceDataUrl = canvas.toDataURL();

          const { mcpStoreImageBytes } = await import('@/services/cmd');
          const bytes = await fetch(sliceDataUrl).then((r) => r.arrayBuffer());
          const mcpUrl = await mcpStoreImageBytes(Array.from(new Uint8Array(bytes)), 'image/png');
          await logMessage(
            'info',
            `[locate] slice ${i} stored to MCP: ${mcpUrl.substring(0, 50)}...`
          );

          const annotationObjects = await runDetectForImage(
            mcpUrl,
            labelId,
            sliceResp.width,
            sliceResp.height
          );

          if (annotationObjects.length > 0) {
            const existingKf = await opts.getKeyframe(volId, i);
            const existingObjects = existingKf?.objects ?? [];
            await opts.putKeyframe(volId, i, {
              objects: [...existingObjects, ...annotationObjects],
            });
            await logMessage(
              'info',
              `[locate] slice=${i} detected ${annotationObjects.length} objects, saved to keyframe`
            );
          } else {
            await logMessage('info', `[locate] slice=${i} no objects detected`);
          }
        } catch (e) {
          await logMessage('error', `[locate] slice=${i} detect failed: ${e}`);
        }
      }

      labelDefStore.updateDetectProgress(labelId, { status: 'done' });
      await logMessage('info', `[locate] batchDetect completed for label ${labelId}`);
    } catch (e) {
      labelDefStore.updateDetectProgress(labelId, {
        status: 'error',
        error: e instanceof Error ? e.message : String(e),
      });
      await logMessage('error', `[locate] batchDetect failed: ${e}`);
      throw e;
    }
  }

  return {
    runDetectForCurrentImage,
    batchDetect,
    boxesToAnnotationObjects: (boxes: BoundingBox[], imageWidth: number, imageHeight: number) =>
      boxesToAnnotationObjects(
        boxes,
        '',
        labelDefStore.subLabelsByParent(''),
        labelDefStore,
        imageWidth,
        imageHeight
      ),
  };
}
