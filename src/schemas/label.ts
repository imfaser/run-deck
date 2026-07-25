import { z } from 'zod';

export const LabelDefSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  color: z.string(),
  order: z.number().int().min(1).max(255),
});
export type LabelDef = z.infer<typeof LabelDefSchema>;

export const SubLabelSchema = z.object({
  id: z.string(),
  parentId: z.string(),
  name: z.string().min(1),
});
export type SubLabel = z.infer<typeof SubLabelSchema>;
