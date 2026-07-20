import { z } from 'zod';

const PointTupleSchema = z.tuple([z.number(), z.number()]);
const BoxTupleSchema = z.tuple([z.number(), z.number(), z.number(), z.number()]);

export const SegmentOptionsSchema = z
  .object({
    p_point: z.array(PointTupleSchema).optional(),
    n_point: z.array(PointTupleSchema).optional(),
    boxes: z.array(BoxTupleSchema).optional(),
    prev_mask: z.string().optional(),
    multimask_output: z.boolean().optional(),
  })
  .refine(
    (opts) =>
      (opts.p_point && opts.p_point.length > 0) ||
      (opts.n_point && opts.n_point.length > 0) ||
      (opts.boxes && opts.boxes.length > 0) ||
      !!opts.prev_mask,
    { message: '至少需要一种提示：p_point, n_point, boxes, 或 prev_mask' }
  );
export type SegmentOptions = z.infer<typeof SegmentOptionsSchema>;
