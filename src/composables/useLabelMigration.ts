import type { AnnotationObject } from '@/schemas/annotation';
import { useLabel3dDefStore } from '@/stores/label-def-3d';
import { objectColor } from '@/utils/objectColor';
import { logMessage } from '@/services/cmd';

/**
 * Migrate old-format AnnotationObjects (with `name` field, no `labelId`)
 * to new format (with `labelId` referencing global LabelDef).
 *
 * Returns true if any migration was performed.
 */
export async function migrateObjects(objects: AnnotationObject[]): Promise<boolean> {
  const hasOldFormat = objects.some((o) => 'name' in o && !('labelId' in o));
  if (!hasOldFormat) return false;

  const labelDefStore = useLabel3dDefStore();
  let migrated = 0;

  for (const obj of objects) {
    if ('labelId' in obj && !('name' in obj)) continue;

    const oldObj = obj as AnnotationObject & { name: string; color?: string };
    const name = oldObj.name;

    // Find or create LabelDef
    let labelDef = labelDefStore.labelByName(name);
    if (!labelDef) {
      labelDef = await labelDefStore.addLabel(name, oldObj.color ?? objectColor(name));
    }

    // Convert to new format
    delete (oldObj as Record<string, unknown>).name;
    delete (oldObj as Record<string, unknown>).color;
    (oldObj as AnnotationObject).labelId = labelDef.id;
    migrated++;
  }

  if (migrated > 0) {
    await logMessage('debug', `[migration] migrated ${migrated} objects to new labelId format`);
  }

  return migrated > 0;
}
