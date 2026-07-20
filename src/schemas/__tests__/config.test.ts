import { describe, it, expect } from 'vitest';
import {
  ShellTypeSchema,
  FrontendConfigSchema,
  McpLocalServerConfigSchema,
  McpRemoteServerConfigSchema,
  McpServerConfigSchema,
  ConfigSchema,
} from '@/schemas/config';

describe('ShellTypeSchema', () => {
  it('accepts valid values', () => {
    expect(ShellTypeSchema.parse('auto')).toBe('auto');
    expect(ShellTypeSchema.parse('cmd')).toBe('cmd');
    expect(ShellTypeSchema.parse('powershell')).toBe('powershell');
    expect(ShellTypeSchema.parse('bash')).toBe('bash');
  });

  it('rejects invalid values', () => {
    expect(() => ShellTypeSchema.parse('zsh')).toThrow();
    expect(() => ShellTypeSchema.parse('')).toThrow();
  });
});

describe('FrontendConfigSchema', () => {
  it('parses valid config', () => {
    const result = FrontendConfigSchema.parse({ home: 'overview', mode: 'dark' });
    expect(result.home).toBe('overview');
    expect(result.mode).toBe('dark');
  });

  it('rejects invalid mode', () => {
    expect(() => FrontendConfigSchema.parse({ home: 'overview', mode: 'blue' })).toThrow();
  });
});

describe('McpLocalServerConfigSchema', () => {
  it('parses minimal local config', () => {
    const result = McpLocalServerConfigSchema.parse({
      type: 'local',
      command: ['uvx', 'echo-mcp'],
      enabled: true,
    });
    expect(result.type).toBe('local');
    expect(result.command).toEqual(['uvx', 'echo-mcp']);
  });

  it('accepts optional environment and timeout', () => {
    const result = McpLocalServerConfigSchema.parse({
      type: 'local',
      command: ['node'],
      environment: { NODE_ENV: 'production' },
      enabled: false,
      timeout: 5000,
    });
    expect(result.environment).toEqual({ NODE_ENV: 'production' });
    expect(result.timeout).toBe(5000);
  });
});

describe('McpRemoteServerConfigSchema', () => {
  it('parses valid remote config', () => {
    const result = McpRemoteServerConfigSchema.parse({
      type: 'remote',
      url: 'https://example.com/mcp',
      enabled: true,
    });
    expect(result.type).toBe('remote');
    expect(result.url).toBe('https://example.com/mcp');
  });

  it('rejects invalid url format', () => {
    expect(() =>
      McpRemoteServerConfigSchema.parse({
        type: 'remote',
        url: 'not-a-url',
        enabled: true,
      })
    ).toThrow();
  });
});

describe('McpServerConfigSchema', () => {
  it('discriminates on type field', () => {
    const local = McpServerConfigSchema.parse({
      type: 'local',
      command: ['node'],
      enabled: true,
    });
    expect(local.type).toBe('local');

    const remote = McpServerConfigSchema.parse({
      type: 'remote',
      url: 'https://example.com',
      enabled: true,
    });
    expect(remote.type).toBe('remote');
  });

  it('rejects unknown type', () => {
    expect(() => McpServerConfigSchema.parse({ type: 'unknown', enabled: true })).toThrow();
  });
});

describe('ConfigSchema', () => {
  it('parses full config', () => {
    const result = ConfigSchema.parse({
      log_level: 'info',
      shell: 'auto',
      frontend: { home: 'overview', mode: 'dark' },
      mcp: {
        'test-server': {
          type: 'local',
          command: ['uvx', 'test'],
          enabled: true,
        },
      },
    });
    expect(result.log_level).toBe('info');
    expect(Object.keys(result.mcp)).toContain('test-server');
  });
});
