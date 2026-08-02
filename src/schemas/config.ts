import { z } from 'zod';
import { match, P } from 'ts-pattern';
import { LABELS } from '@/constants/labels';

// --- Enums / Primitives ---

export const LogLevelSchema = z.enum(['error', 'warn', 'info', 'debug', 'trace']);
export type LogLevel = z.infer<typeof LogLevelSchema>;

export const ShellTypeSchema = z.enum(['auto', 'cmd', 'powershell', 'bash']);
export type ShellType = z.infer<typeof ShellTypeSchema>;

// --- MCP Server Config (discriminated union) ---

export const McpLocalServerConfigSchema = z.object({
  type: z.literal('local'),
  command: z.array(z.string()).min(1, LABELS.validation.commandRequired),
  environment: z.record(z.string(), z.string()).nullable().optional(),
  enabled: z.boolean().default(true),
  timeout: z.number().int().positive().nullable().optional(),
});

export const McpRemoteServerConfigSchema = z.object({
  type: z.literal('remote'),
  url: z.string().url(LABELS.validation.urlInvalid),
  headers: z.record(z.string(), z.string()).nullable().optional(),
  enabled: z.boolean().default(true),
  timeout: z.number().int().positive().nullable().optional(),
});

export const McpServerConfigSchema = z.discriminatedUnion('type', [
  McpLocalServerConfigSchema,
  McpRemoteServerConfigSchema,
]);
export type McpServerConfig = z.infer<typeof McpServerConfigSchema>;

// --- Frontend Config ---

export const FrontendConfigSchema = z.object({
  home: z.enum(['overview', 'config']).default('overview'),
  mode: z.enum(['dark', 'light']).default('dark'),
});
export type FrontendConfig = z.infer<typeof FrontendConfigSchema>;

// --- Root Config ---

export const ConfigSchema = z.object({
  log_level: LogLevelSchema.default('info'),
  log_retention_days: z.number().int().positive().default(30),
  log_max_size_mb: z.number().int().positive().default(1),
  log_keep_files: z.number().int().positive().default(8),
  shell: ShellTypeSchema.default('auto'),
  frontend: FrontendConfigSchema.default(() => ({
    home: 'overview' as const,
    mode: 'dark' as const,
  })),
  mcp: z.record(z.string(), McpServerConfigSchema).default({}),
});
export type Config = z.infer<typeof ConfigSchema>;

/**
 * Parse config with all nested defaults applied.
 * Two-pass approach: first parse applies top-level defaults (producing empty objects),
 * second parse applies nested field defaults.
 */
export function parseConfig(raw: unknown): Config {
  const pass1 = ConfigSchema.parse(raw);
  return ConfigSchema.parse(pass1);
}

// --- MCP Response Types (from Rust) ---

export const ServerStatusSchema = z.union([
  z.literal('Starting'),
  z.literal('Running'),
  z.literal('Stopped'),
  z.object({ Failed: z.object({ error: z.string() }) }),
]);
export type ServerStatus = z.infer<typeof ServerStatusSchema>;

export type ServerStatusKind = 'Starting' | 'Running' | 'Stopped' | 'Failed';

export function getStatusKind(status: ServerStatus | null): ServerStatusKind {
  return match(status)
    .with(null, () => 'Stopped' as const)
    .with('Starting', 'Running', 'Stopped', (s) => s)
    .with({ Failed: P._ }, () => 'Failed' as const)
    .exhaustive();
}

export function getStatusError(status: ServerStatus | null): string | undefined {
  return match(status)
    .with({ Failed: { error: P.select() } }, (error) => error)
    .otherwise(() => undefined);
}

export const ServerInfoSchema = z.object({
  name: z.string(),
  version: z.string(),
  has_tools: z.boolean(),
  has_prompts: z.boolean(),
  has_resources: z.boolean(),
});
export type ServerInfo = z.infer<typeof ServerInfoSchema>;

export const ToolInfoSchema = z.object({
  server_name: z.string(),
  tool: z.record(z.string(), z.unknown()),
});
export type ToolInfo = z.infer<typeof ToolInfoSchema>;

export const PromptInfoSchema = z.object({
  server_name: z.string(),
  prompt: z.record(z.string(), z.unknown()),
});
export type PromptInfo = z.infer<typeof PromptInfoSchema>;

export const ResourceInfoSchema = z.object({
  server_name: z.string(),
  resource: z.record(z.string(), z.unknown()),
});
export type ResourceInfo = z.infer<typeof ResourceInfoSchema>;
