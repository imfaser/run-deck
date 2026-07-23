import { z } from 'zod';

export const ShellTypeSchema = z.enum(['auto', 'cmd', 'powershell', 'bash']);
export type ShellType = z.infer<typeof ShellTypeSchema>;

export const FrontendConfigSchema = z.object({
  home: z.string(),
  mode: z.enum(['dark', 'light']),
});
export type FrontendConfig = z.infer<typeof FrontendConfigSchema>;

export const McpLocalServerConfigSchema = z.object({
  type: z.literal('local'),
  command: z.array(z.string()),
  environment: z.record(z.string(), z.string()).nullish(),
  enabled: z.boolean(),
  timeout: z.number().nullish(),
});

export const McpRemoteServerConfigSchema = z.object({
  type: z.literal('remote'),
  url: z.string().refine((v) => !v || /^https?:\/\/.+/.test(v), { error: 'URL 格式不正确' }),
  headers: z.record(z.string(), z.string()).nullish(),
  enabled: z.boolean(),
  timeout: z.number().nullish(),
});

export type McpServerConfig =
  | z.infer<typeof McpLocalServerConfigSchema>
  | z.infer<typeof McpRemoteServerConfigSchema>;

export const McpServerConfigSchema = z.discriminatedUnion('type', [
  McpLocalServerConfigSchema,
  McpRemoteServerConfigSchema,
]);

export const LogLevelSchema = z.enum(['error', 'warn', 'info', 'debug', 'trace']);
export type LogLevel = z.infer<typeof LogLevelSchema>;

export const ConfigSchema = z.object({
  log_level: LogLevelSchema,
  log_retention_days: z.number().int().positive().default(30),
  shell: ShellTypeSchema,
  frontend: FrontendConfigSchema,
  mcp: z.record(z.string(), McpServerConfigSchema),
});
export type Config = z.infer<typeof ConfigSchema>;
