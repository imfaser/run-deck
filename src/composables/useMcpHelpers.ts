import { match, P } from 'ts-pattern';
import type { McpServerConfig, ServerStatus } from '@/services/cmd';

export function getStatusType(status: ServerStatus): 'success' | 'warning' | 'info' | 'danger' {
  return match(status)
    .with('Running', () => 'success' as const)
    .with('Starting', () => 'warning' as const)
    .otherwise(() => 'info' as const);
}

export function getStatusLabel(status: ServerStatus): string {
  return match(status)
    .with('Running', () => '运行中')
    .with('Starting', () => '启动中')
    .with('Stopped', () => '已停止')
    .with(
      P.when((s) => typeof s === 'object' && 'Failed' in s),
      () => '失败'
    )
    .otherwise(() => status as string);
}

export function getServerTypeLabel(cfg: McpServerConfig): string {
  return cfg.type === 'local' ? 'STDIO' : 'HTTP';
}

export function getSchemaProperties(
  schema: Record<string, unknown> | undefined | null
): Array<{ name: string; type: string; required: boolean; description: string }> {
  if (!schema) return [];
  const properties = schema.properties as Record<string, Record<string, unknown>> | undefined;
  const required = (schema.required as string[] | undefined) ?? [];

  if (!properties) return [];

  return Object.entries(properties).map(([name, prop]) => ({
    name,
    type: (prop?.type as string) ?? 'unknown',
    required: required.includes(name),
    description: (prop?.description as string) ?? '',
  }));
}
