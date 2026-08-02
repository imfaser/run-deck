import { vi, describe, it, expect } from 'vitest';
import { cacheUrl, isCacheUrl, toRenderableUrl } from '@/lib/url';

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: vi.fn((path: string, protocol: string) => `http://${protocol}.localhost/${path}`),
}));

describe('cacheUrl', () => {
  it('converts a bare hash', () => {
    expect(cacheUrl('abc123')).toBe('http://cache.localhost/abc123');
  });

  it('strips cache:// prefix before converting', () => {
    expect(cacheUrl('cache://abc123')).toBe('http://cache.localhost/abc123');
  });
});

describe('isCacheUrl', () => {
  it('treats cache:// and bare hash as cache urls', () => {
    expect(isCacheUrl('cache://abc123')).toBe(true);
    expect(isCacheUrl('abc123')).toBe(true);
  });

  it('does not treat data / http(s) as cache urls', () => {
    expect(isCacheUrl('data:image/png;base64,xxx')).toBe(false);
    expect(isCacheUrl('http://cache.localhost/abc')).toBe(false);
    expect(isCacheUrl('https://example.com/x')).toBe(false);
  });
});

describe('toRenderableUrl', () => {
  it('passes through data urls', () => {
    expect(toRenderableUrl('data:image/png;base64,xxx')).toBe('data:image/png;base64,xxx');
  });

  it('passes through http(s) urls', () => {
    expect(toRenderableUrl('http://cache.localhost/abc')).toBe('http://cache.localhost/abc');
  });

  it('converts a bare hash via cacheUrl', () => {
    expect(toRenderableUrl('abc123')).toBe('http://cache.localhost/abc123');
  });

  it('converts cache:// prefixed hash without double-encoding', () => {
    const url = toRenderableUrl(
      'cache://535e464747d5ca1e147ecfa6ab245a01a766d46cbfd7fd19fa9169a940bfca7a'
    );
    expect(url).toBe(
      'http://cache.localhost/535e464747d5ca1e147ecfa6ab245a01a766d46cbfd7fd19fa9169a940bfca7a'
    );
    expect(url).not.toContain('cache%3A');
    expect(url).not.toContain('cache://');
  });
});
