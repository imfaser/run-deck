import { z } from 'zod';
import { McpServerConfigSchema } from '@/schemas/config';

export const McpServerFormSchema = z
  .object({
    name: z.string().min(1, '名称不能为空'),
    config: McpServerConfigSchema,
    existingNames: z.array(z.string()),
    originalName: z.string(),
  })
  .refine((data) => data.name === data.originalName || !data.existingNames.includes(data.name), {
    message: '名称已存在',
    path: ['name'],
  })
  .superRefine((data, ctx) => {
    if (data.config.type === 'local' && data.config.command.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '启动命令不能为空',
        path: ['config'],
      });
    }
    if (data.config.type === 'remote' && !data.config.url?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'URL 不能为空',
        path: ['config'],
      });
    }
  });
