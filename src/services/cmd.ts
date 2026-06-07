import { invoke } from '@tauri-apps/api/core';

export async function greet(name: string): Promise<string> {
  return invoke<string>('greet', { name });
}

type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'trace';

export async function logMessage(level: LogLevel, message: string): Promise<void> {
  return invoke<void>('log_message', { level, message });
}
