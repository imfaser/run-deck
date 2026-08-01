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
import { LABELS } from '@/constants/labels';

const LOG_LEVEL_ITEMS: Record<LogLevel, string> = {
  error: LABELS.logLevel.error,
  warn: LABELS.logLevel.warn,
  info: LABELS.logLevel.info,
  debug: LABELS.logLevel.debug,
  trace: LABELS.logLevel.trace,
};

const HOME_ITEMS: Record<Config['frontend']['home'], string> = {
  overview: LABELS.nav.overview,
  config: LABELS.nav.config,
};

const MODE_ITEMS: Record<Config['frontend']['mode'], string> = {
  dark: LABELS.theme.dark,
  light: LABELS.theme.light,
};

const SHELL_ITEMS: Record<ShellType, string> = {
  auto: LABELS.shell.auto,
  cmd: 'CMD',
  powershell: 'PowerShell',
  bash: 'Bash',
};

export default function GeneralSettings() {
  const { config, updateLogLevel, updateHome, updateMode, updateShell } = useConfig();

  if (!config) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle>{LABELS.settings.title}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <SettingRow label={LABELS.settings.logLevel}>
            <Select
              value={config.log_level}
              onValueChange={(v) => updateLogLevel(v as LogLevel)}
              items={LOG_LEVEL_ITEMS}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>{LABELS.settings.logLevel}</SelectLabel>
                  {Object.entries(LOG_LEVEL_ITEMS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </SettingRow>

          <SettingRow label={LABELS.settings.homeRoute}>
            <Select
              value={config.frontend.home}
              onValueChange={(v) => updateHome(v as Config['frontend']['home'])}
              items={HOME_ITEMS}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>{LABELS.settings.homeRoute}</SelectLabel>
                  {Object.entries(HOME_ITEMS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </SettingRow>

          <SettingRow label={LABELS.theme.mode}>
            <Select
              value={config.frontend.mode}
              onValueChange={(v) => updateMode(v as Config['frontend']['mode'])}
              items={MODE_ITEMS}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>{LABELS.theme.mode}</SelectLabel>
                  {Object.entries(MODE_ITEMS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </SettingRow>

          <SettingRow label={LABELS.settings.shellType}>
            <Select
              value={config.shell}
              onValueChange={(v) => updateShell(v as ShellType)}
              items={SHELL_ITEMS}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>{LABELS.settings.shellType}</SelectLabel>
                  {Object.entries(SHELL_ITEMS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
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
