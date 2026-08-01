import { z } from 'zod';

export const LabelSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
  order: z.number(),
  sub_labels: z.array(z.string()),
});
export type Label = z.infer<typeof LabelSchema>;

export const LabelOrderInputSchema = z.object({
  id: z.string(),
  order: z.number(),
});
export type LabelOrderInput = z.infer<typeof LabelOrderInputSchema>;

export const LabelCreateInputSchema = z.object({
  name: z.string().min(1),
  color: z.string(),
  order: z.number(),
  sub_labels: z.array(z.string()).optional(),
});
export type LabelCreateInput = z.infer<typeof LabelCreateInputSchema>;

export const LabelUpdateInputSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  color: z.string().optional(),
  order: z.number().optional(),
  sub_labels: z.array(z.string()).optional(),
});
export type LabelUpdateInput = z.infer<typeof LabelUpdateInputSchema>;
