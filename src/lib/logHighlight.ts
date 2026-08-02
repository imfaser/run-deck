/** 多词 AND 正则：空格分词，每个词匹配 message/ts/level 任一字段 */
export function buildTerms(query: string): RegExp[] {
  return query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => new RegExp(escapeRegExp(token), 'i'));
}

export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 收集所有命中区间并按重叠合并（排序后）。纯函数，便于测试。 */
export function collectHighlightRanges(
  text: string,
  terms: RegExp[]
): Array<{ start: number; end: number }> {
  const ranges: Array<{ start: number; end: number }> = [];
  for (const re of terms) {
    const source = re.source;
    const flags = re.flags.includes('g') ? re.flags : `${re.flags}g`;
    const globalRe = new RegExp(source, flags);
    let m: RegExpExecArray | null;
    while ((m = globalRe.exec(text)) !== null) {
      ranges.push({ start: m.index, end: m.index + m[0].length });
      if (m.index === globalRe.lastIndex) {
        globalRe.lastIndex += 1;
      }
    }
  }
  if (ranges.length === 0) {
    return ranges;
  }
  ranges.sort((a, b) => a.start - b.start);
  const merged: Array<{ start: number; end: number }> = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r.start <= last.end) {
      last.end = Math.max(last.end, r.end);
    } else {
      merged.push({ ...r });
    }
  }
  return merged;
}
