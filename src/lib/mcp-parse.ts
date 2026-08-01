import { compact } from 'es-toolkit';
import { fromPairs } from 'es-toolkit/compat';

/**
 * Parse multi-line text into command array (each non-empty line = one arg).
 * Trims whitespace, drops empty lines.
 */
export function parseCommandText(text: string): string[] {
  return compact(text.split('\n').map((line) => line.trim()));
}

/**
 * Parse multi-line KEY=value text into Record.
 * Trims whitespace, drops empty lines and lines without '='.
 */
export function parseKeyValueText(text: string): Record<string, string> {
  return fromPairs(
    text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.includes('='))
      .map((line): [string, string] => {
        const eqIndex = line.indexOf('=');
        return [line.slice(0, eqIndex).trim(), line.slice(eqIndex + 1).trim()];
      })
      .filter(([key]) => key.length > 0)
  );
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
