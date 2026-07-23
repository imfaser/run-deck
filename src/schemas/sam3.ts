import { z } from 'zod';

const PointTupleSchema = z.tuple([z.number(), z.number()]);
const BoxTupleSchema = z.tuple([z.number(), z.number(), z.number(), z.number()]);

export const MCPPointPromptSchema = z.object({
  coords: PointTupleSchema,
  label: z.union([z.literal(0), z.literal(1)]),
});

export const MCPBoundingBoxSchema = z.object({
  coords: BoxTupleSchema,
});

export const MCPObjectSchema = z
  .object({
    points: z.array(MCPPointPromptSchema),
    box: MCPBoundingBoxSchema.optional(),
  })
  .refine((obj) => obj.points.length > 0 || obj.box !== undefined, {
    error: '每个 object 至少需要一个提示（points 或 box）',
  });

export const MCPRequestSchema = z
  .object({
    image: z.string(),
    objects: z.array(MCPObjectSchema),
    prev_mask: z.string().optional(),
    multimask_output: z.boolean().optional(),
  })
  .refine((req) => req.objects.length > 0 || !!req.prev_mask, {
    error: '至少需要 objects 或 prev_mask 之一',
  });

export type MCPPointPrompt = z.infer<typeof MCPPointPromptSchema>;
export type MCPBoundingBox = z.infer<typeof MCPBoundingBoxSchema>;
export type MCPObject = z.infer<typeof MCPObjectSchema>;
export type MCPRequest = z.infer<typeof MCPRequestSchema>;
