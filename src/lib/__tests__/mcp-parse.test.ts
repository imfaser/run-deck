import { describe, it, expect } from 'vitest';
import {
  parseCommandText,
  parseKeyValueText,
  serializeCommandText,
  serializeKeyValueText,
} from '@/lib/mcp-parse';

describe('parseCommandText', () => {
  it('parses multi-line commands', () => {
    expect(parseCommandText('npx\n-y\n@modelcontextprotocol/server')).toEqual([
      'npx',
      '-y',
      '@modelcontextprotocol/server',
    ]);
  });

  it('trims whitespace', () => {
    expect(parseCommandText('  npx  \n  -y  ')).toEqual(['npx', '-y']);
  });

  it('drops empty lines', () => {
    expect(parseCommandText('npx\n\n\n-y')).toEqual(['npx', '-y']);
  });

  it('returns empty array for empty input', () => {
    expect(parseCommandText('')).toEqual([]);
  });
});

describe('parseKeyValueText', () => {
  it('parses KEY=value pairs', () => {
    expect(parseKeyValueText('API_KEY=abc123\nSECRET=xyz')).toEqual({
      API_KEY: 'abc123',
      SECRET: 'xyz',
    });
  });

  it('handles values with = sign', () => {
    expect(parseKeyValueText('URL=http://example.com?a=1')).toEqual({
      URL: 'http://example.com?a=1',
    });
  });

  it('drops lines without = sign', () => {
    expect(parseKeyValueText('API_KEY=abc\ninvalid_line\nSECRET=xyz')).toEqual({
      API_KEY: 'abc',
      SECRET: 'xyz',
    });
  });

  it('returns empty object for empty input', () => {
    expect(parseKeyValueText('')).toEqual({});
  });
});

describe('serializeCommandText', () => {
  it('joins command array', () => {
    expect(serializeCommandText(['npx', '-y', 'server'])).toBe('npx\n-y\nserver');
  });
});

describe('serializeKeyValueText', () => {
  it('joins Record entries', () => {
    expect(serializeKeyValueText({ API_KEY: 'abc', SECRET: 'xyz' })).toBe(
      'API_KEY=abc\nSECRET=xyz'
    );
  });
});
