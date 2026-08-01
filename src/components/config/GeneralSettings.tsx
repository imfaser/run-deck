import { cn } from '@/lib/utils';
import { useConfig } from '@/hooks/useConfig';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Config, LogLevel, ShellType } from '@/schemas/config';

const LOG_LEVEL_OPTIONS: { value: LogLevel; label: string }[] = [
  { value: 'error', label: 'Error' },
  { value: 'warn', label: 'Warn' },
  { value: 'info', label: 'Info' },
  { value: 'debug', label: 'Debug' },
  { value: 'trace', label: 'Trace' },
];

const HOME_OPTIONS: { value: Config['frontend']['home']; label: string }[] = [
  { value: 'overview', label: '导航' },
  { value: 'config', label: '配置' },
];

const MODE_OPTIONS: { value: Config['frontend']['mode']; label: string }[] = [
  { value: 'dark', label: '深色' },
  { value: 'light', label: '浅色' },
];

const SHELL_OPTIONS: { value: ShellType; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'cmd', label: 'CMD' },
  { value: 'powershell', label: 'PowerShell' },
  { value: 'bash', label: 'Bash' },
];

export default function GeneralSettings() {
  const { config, updateLogLevel, updateHome, updateMode, updateShell } = useConfig();

  if (!config) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle>通用设置</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <SettingRow label="日志级别">
            <Select value={config.log_level} onValueChange={(v) => updateLogLevel(v as LogLevel)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>日志级别</SelectLabel>
                  {LOG_LEVEL_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </SettingRow>

          <SettingRow label="首页路由">
            <Select
              value={config.frontend.home}
              onValueChange={(v) => updateHome(v as Config['frontend']['home'])}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>首页路由</SelectLabel>
                  {HOME_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </SettingRow>

          <SettingRow label="主题模式">
            <Select
              value={config.frontend.mode}
              onValueChange={(v) => updateMode(v as Config['frontend']['mode'])}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>主题模式</SelectLabel>
                  {MODE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </SettingRow>

          <SettingRow label="Shell 类型">
            <Select value={config.shell} onValueChange={(v) => updateShell(v as ShellType)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Shell 类型</SelectLabel>
                  {SHELL_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </SettingRow>
        </CardContent>
      </Card>
    </div>
  );
}

function SettingRow({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('flex items-center justify-between', className)}>
      <span className="text-sm text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}
