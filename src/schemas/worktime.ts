import { z } from 'zod';

export const TimeHHmmSchema = z.string().regex(/^\d{2}:\d{2}$/, '时间格式必须为 HH:mm');
export type TimeHHmm = z.infer<typeof TimeHHmmSchema>;

export const WorkRecordSchema = z.object({
  id: z.string(),
  date: z.string(),
  clockIn: TimeHHmmSchema,
  clockOut: TimeHHmmSchema,
  isPredicted: z.boolean(),
  workHours: z.number(),
});
export type WorkRecord = z.infer<typeof WorkRecordSchema>;

export const WorktimeSettingsSchema = z.object({
  workPeriod1Start: TimeHHmmSchema,
  workPeriod1End: TimeHHmmSchema,
  breakPeriod1Start: TimeHHmmSchema,
  breakPeriod1End: TimeHHmmSchema,
  workPeriod2Start: TimeHHmmSchema,
  workPeriod2End: TimeHHmmSchema,
  breakPeriod2Start: TimeHHmmSchema,
  breakPeriod2End: TimeHHmmSchema,
  dailyTarget: z.number().positive(),
  autoSync: z.boolean(),
  lastSyncTime: z.string(),
});
export type WorktimeSettings = z.infer<typeof WorktimeSettingsSchema>;
