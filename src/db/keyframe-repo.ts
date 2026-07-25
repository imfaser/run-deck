import { logMessage } from '@/services/cmd';
import { db } from '@/db/label-raw-db';
import type { KeyframeRecord, Keyframe } from '@/schemas/keyframe';

export async function getKeyframe(volId: string, idx: number): Promise<KeyframeRecord | undefined> {
  try {
    return await db.keyframes.where('[volumeId+sliceIndex]').equals([volId, idx]).first();
  } catch (e) {
    await logMessage('error', `[keyframe-db] getKeyframe failed volId=${volId} slice=${idx}: ${e}`);
    return undefined;
  }
}

export async function putKeyframe(
  volId: string,
  sliceIndex: number,
  data: Partial<Keyframe>
): Promise<void> {
  try {
    const existing = await getKeyframe(volId, sliceIndex);
    if (existing?.id) {
      await db.keyframes.update(existing.id, data);
      await logMessage(
        'debug',
        `[keyframe-db] updated slice=${sliceIndex} fields=${Object.keys(data).join(',')}`
      );
    } else {
      await db.keyframes.put({
        volumeId: volId,
        sliceIndex,
        objects: data.objects ?? [],
        maskUrl: data.maskUrl ?? null,
        maskVisible: data.maskVisible ?? true,
        rawMaskHash: data.rawMaskHash ?? null,
      });
      await logMessage('debug', `[keyframe-db] created slice=${sliceIndex}`);
    }
  } catch (e) {
    await logMessage('error', `[keyframe-db] putKeyframe failed slice=${sliceIndex}: ${e}`);
    throw e;
  }
}

export async function deleteKeyframe(volId: string, sliceIndex: number): Promise<void> {
  try {
    const kf = await getKeyframe(volId, sliceIndex);
    if (kf?.id) {
      await db.keyframes.delete(kf.id);
      await logMessage('debug', `[keyframe-db] deleted slice=${sliceIndex}`);
    }
  } catch (e) {
    await logMessage('error', `[keyframe-db] deleteKeyframe failed slice=${sliceIndex}: ${e}`);
    throw e;
  }
}

export async function getKeyframesByVolume(volId: string): Promise<KeyframeRecord[]> {
  try {
    return await db.keyframes.where('volumeId').equals(volId).toArray();
  } catch (e) {
    await logMessage('error', `[keyframe-db] getKeyframesByVolume failed volId=${volId}: ${e}`);
    return [];
  }
}

export async function deleteKeyframesByVolume(volId: string): Promise<void> {
  try {
    await db.keyframes.where('volumeId').equals(volId).delete();
    await logMessage('debug', `[keyframe-db] deleted all keyframes for volume=${volId}`);
  } catch (e) {
    await logMessage('error', `[keyframe-db] deleteKeyframesByVolume failed volId=${volId}: ${e}`);
    throw e;
  }
}

export async function toggleMaskVisible(volId: string, sliceIndex: number): Promise<void> {
  try {
    const kf = await getKeyframe(volId, sliceIndex);
    if (kf?.id) {
      await db.keyframes.update(kf.id, { maskVisible: !kf.maskVisible });
      await logMessage(
        'debug',
        `[keyframe-db] toggleMaskVisible slice=${sliceIndex} -> ${!kf.maskVisible}`
      );
    }
  } catch (e) {
    await logMessage('error', `[keyframe-db] toggleMaskVisible failed slice=${sliceIndex}: ${e}`);
    throw e;
  }
}
