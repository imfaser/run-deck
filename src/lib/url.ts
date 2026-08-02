import { convertFileSrc } from '@tauri-apps/api/core';

/**
 * 将 cache hash 转为 webview 可加载的 URL。
 * cache:// 协议由 register_uri_scheme_protocol 注册，必须经 convertFileSrc 转换。
 * 兼容 `cache://<hash>` 与裸 `<hash>` 两种输入，剥离前缀后再转换，
 * 避免 convertFileSrc 把 `cache://` 也编码进路径导致 404。
 */
export function cacheUrl(hash: string): string {
  const plain = hash.replace(/^cache:\/\//, '');
  return convertFileSrc(plain, 'cache');
}

/**
 * 判断 URL 是否需要经 convertFileSrc 转换。
 * data:（dataURL）、http(s) 直接可用；其余视为 cache hash 或本地路径。
 */
export function isCacheUrl(value: string): boolean {
  return !value.startsWith('data:') && !/^https?:\/\//i.test(value);
}

/**
 * 安全地把可能为 cache hash / 本地路径的 URL 转为可加载 URL。
 */
export function toRenderableUrl(value: string): string {
  if (isCacheUrl(value)) {
    return cacheUrl(value);
  }
  return value;
}
