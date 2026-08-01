import { describe, it, expect } from 'vitest';
import {
  ConfigSchema,
  parseConfig,
  McpServerConfigSchema,
  McpLocalServerConfigSchema,
  McpRemoteServerConfigSchema,
  FrontendConfigSchema,
  LogLevelSchema,
  ShellTypeSchema,
  ServerStatusSchema,
  getStatusKind,
  getStatusError,
} from '@/schemas/config';
import { LABELS } from '@/constants/labels';

describe('LogLevelSchema', () => {
  it('accepts valid log levels', () => {
    expect(LogLevelSchema.parse('error')).toBe('error');
    expect(LogLevelSchema.parse('warn')).toBe('warn');
    expect(LogLevelSchema.parse('info')).toBe('info');
    expect(LogLevelSchema.parse('debug')).toBe('debug');
    expect(LogLevelSchema.parse('trace')).toBe('trace');
  });

  it('rejects invalid log levels', () => {
    expect(() => LogLevelSchema.parse('verbose')).toThrow();
    expect(() => LogLevelSchema.parse('')).toThrow();
  });
});

describe('ShellTypeSchema', () => {
  it('accepts valid shell types', () => {
    expect(ShellTypeSchema.parse('auto')).toBe('auto');
    expect(ShellTypeSchema.parse('cmd')).toBe('cmd');
    expect(ShellTypeSchema.parse('powershell')).toBe('powershell');
    expect(ShellTypeSchema.parse('bash')).toBe('bash');
  });

  it('rejects invalid shell types', () => {
    expect(() => ShellTypeSchema.parse('zsh')).toThrow();
  });
});

describe('FrontendConfigSchema', () => {
  it('accepts valid home route', () => {
    expect(FrontendConfigSchema.parse({ home: 'overview', mode: 'dark' })).toEqual({
      home: 'overview',
      mode: 'dark',
    });
  });

  it('defaults when empty object', () => {
    const result = FrontendConfigSchema.parse({});
    expect(result.home).toBe('overview');
    expect(result.mode).toBe('dark');
  });

  it('rejects invalid home route', () => {
    expect(() => FrontendConfigSchema.parse({ home: 'invalid' })).toThrow();
  });

  it('rejects invalid mode', () => {
    expect(() => FrontendConfigSchema.parse({ mode: 'blue' })).toThrow();
  });
});

describe('McpLocalServerConfigSchema', () => {
  it('accepts valid local config', () => {
    const result = McpLocalServerConfigSchema.parse({
      type: 'local',
      command: ['npx', '-y', '@modelcontextprotocol/server'],
    });
    expect(result.type).toBe('local');
    expect(result.command).toEqual(['npx', '-y', '@modelcontextprotocol/server']);
    expect(result.enabled).toBe(true);
  });

  it('rejects empty command array', () => {
    expect(() =>
      McpLocalServerConfigSchema.parse({
        type: 'local',
        command: [],
      })
    ).toThrow(LABELS.validation.commandRequired);
  });
});

describe('McpRemoteServerConfigSchema', () => {
  it('accepts valid remote config', () => {
    const result = McpRemoteServerConfigSchema.parse({
      type: 'remote',
      url: 'https://example.com/mcp',
    });
    expect(result.type).toBe('remote');
    expect(result.url).toBe('https://example.com/mcp');
  });

  it('rejects invalid URL format', () => {
    expect(() =>
      McpRemoteServerConfigSchema.parse({
        type: 'remote',
        url: 'not-a-url',
      })
    ).toThrow(LABELS.validation.urlInvalid);
  });
});

describe('McpServerConfigSchema (discriminated union)', () => {
  it('accepts local server config', () => {
    const result = McpServerConfigSchema.parse({
      type: 'local',
      command: ['node', 'server.js'],
    });
    expect(result.type).toBe('local');
  });

  it('accepts remote server config', () => {
    const result = McpServerConfigSchema.parse({
      type: 'remote',
      url: 'https://api.example.com/mcp',
      enabled: false,
    });
    expect(result.type).toBe('remote');
    expect(result.enabled).toBe(false);
  });

  it('rejects unknown type', () => {
    expect(() =>
      McpServerConfigSchema.parse({
        type: 'unknown',
      })
    ).toThrow();
  });
});

describe('ConfigSchema', () => {
  it('accepts full config', () => {
    const result = ConfigSchema.parse({
      log_level: 'info',
      log_retention_days: 30,
      shell: 'powershell',
      frontend: { home: 'overview', mode: 'dark' },
      mcp: {
        testServer: {
          type: 'local',
          command: ['node', 'server.js'],
          enabled: true,
        },
      },
    });
    expect(result.log_level).toBe('info');
    expect(result.shell).toBe('powershell');
    expect(result.mcp.testServer.type).toBe('local');
  });

  it('defaults all fields when empty', () => {
    const result = parseConfig({});
    expect(result.log_level).toBe('info');
    expect(result.shell).toBe('auto');
    expect(result.frontend.home).toBe('overview');
    expect(result.frontend.mode).toBe('dark');
    expect(result.mcp).toEqual({});
  });

  it('defaults nested fields in frontend', () => {
    const result = parseConfig({ frontend: {} });
    expect(result.frontend.home).toBe('overview');
    expect(result.frontend.mode).toBe('dark');
  });
});

describe('ServerStatusSchema', () => {
  it('accepts string statuses', () => {
    expect(ServerStatusSchema.parse('Starting')).toBe('Starting');
    expect(ServerStatusSchema.parse('Running')).toBe('Running');
    expect(ServerStatusSchema.parse('Stopped')).toBe('Stopped');
  });

  it('accepts Failed with error', () => {
    const result = ServerStatusSchema.parse({ Failed: { error: 'connection refused' } });
    expect(result).toEqual({ Failed: { error: 'connection refused' } });
  });
});

describe('getStatusKind', () => {
  it('returns kind for string status', () => {
    expect(getStatusKind('Running')).toBe('Running');
    expect(getStatusKind('Starting')).toBe('Starting');
    expect(getStatusKind('Stopped')).toBe('Stopped');
  });

  it('returns Failed for Failed object', () => {
    expect(getStatusKind({ Failed: { error: 'err' } })).toBe('Failed');
  });

  it('returns Stopped for null', () => {
    expect(getStatusKind(null)).toBe('Stopped');
  });
});

describe('getStatusError', () => {
  it('extracts error from Failed status', () => {
    expect(getStatusError({ Failed: { error: 'boom' } })).toBe('boom');
  });

  it('returns undefined for non-Failed status', () => {
    expect(getStatusError('Running')).toBeUndefined();
    expect(getStatusError(null)).toBeUndefined();
  });
});
