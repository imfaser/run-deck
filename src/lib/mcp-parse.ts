/**
 * Parse multi-line text into command array (each non-empty line = one arg).
 * Trims whitespace, drops empty lines.
 */
export function parseCommandText(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/**
 * Parse multi-line KEY=value text into Record.
 * Trims whitespace, drops empty lines and lines without '='.
 */
export function parseKeyValueText(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.includes('=')) {
      continue;
    }
    const eqIndex = trimmed.indexOf('=');
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (key) {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Serialize command array to multi-line text.
 */
export function serializeCommandText(command: string[]): string {
  return command.join('\n');
}

/**
 * Serialize KEY=value Record to multi-line text.
 */
export function serializeKeyValueText(env: Record<string, string>): string {
  return Object.entries(env)
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
}
