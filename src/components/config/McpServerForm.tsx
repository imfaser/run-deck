import { useState } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useConfig } from '@/hooks/useConfig';
import {
  parseCommandText,
  parseKeyValueText,
  serializeCommandText,
  serializeKeyValueText,
} from '@/lib/mcp-parse';
import type { McpServerConfig } from '@/schemas/config';
import { LABELS } from '@/constants/labels';

const localFormSchema = z.object({
  name: z.string().min(1, LABELS.validation.nameRequired),
  commandText: z.string().min(1, LABELS.validation.commandRequired),
  envText: z.string().optional(),
  timeout: z.string().optional(),
  enabled: z.boolean(),
});

const remoteFormSchema = z.object({
  name: z.string().min(1, LABELS.validation.nameRequired),
  url: z.string().url(LABELS.validation.urlInvalid),
  headersText: z.string().optional(),
  timeout: z.string().optional(),
  enabled: z.boolean(),
});

function parseTimeout(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }
  const n = Number.parseInt(value, 10);
  return Number.isNaN(n) ? undefined : n;
}

type LocalFormValues = z.infer<typeof localFormSchema>;
type RemoteFormValues = z.infer<typeof remoteFormSchema>;

interface McpServerFormProps {
  serverName: string;
  serverConfig: McpServerConfig;
  onBack: () => void;
}

export default function McpServerForm({ serverName, serverConfig, onBack }: McpServerFormProps) {
  const { config, updateMcp } = useConfig();
  const isNew = serverName === '__new__';
  const serverType = serverConfig.type;

  const localForm = useForm<LocalFormValues>({
    resolver: zodResolver(localFormSchema),
    defaultValues: {
      name: isNew ? '' : serverName,
      commandText: serverType === 'local' ? serializeCommandText(serverConfig.command) : '',
      envText:
        serverType === 'local' && serverConfig.environment
          ? serializeKeyValueText(serverConfig.environment)
          : '',
      timeout: serverConfig.timeout?.toString() ?? '',
      enabled: serverConfig.enabled,
    },
  });

  const remoteForm = useForm<RemoteFormValues>({
    resolver: zodResolver(remoteFormSchema),
    defaultValues: {
      name: isNew ? '' : serverName,
      url: serverType === 'remote' ? serverConfig.url : '',
      headersText:
        serverType === 'remote' && serverConfig.headers
          ? serializeKeyValueText(serverConfig.headers)
          : '',
      timeout: serverConfig.timeout?.toString() ?? '',
      enabled: serverConfig.enabled,
    },
  });

  const [typeSwitch, setTypeSwitch] = useState<'local' | 'remote'>(serverType);

  function checkNameDuplicate(name: string): boolean {
    if (!config) {
      return false;
    }
    if (!isNew && name === serverName) {
      return false;
    }
    return name in config.mcp;
  }

  const handleLocalSubmit: SubmitHandler<LocalFormValues> = (data) => {
    if (checkNameDuplicate(data.name)) {
      localForm.setError('name', { message: LABELS.mcpForm.duplicateName });
      return;
    }

    const newConfig: McpServerConfig = {
      type: 'local',
      command: parseCommandText(data.commandText),
      environment: parseKeyValueText(data.envText ?? ''),
      enabled: data.enabled,
      timeout: parseTimeout(data.timeout),
    };

    saveServer(data.name, newConfig);
  };

  const handleRemoteSubmit: SubmitHandler<RemoteFormValues> = (data) => {
    if (checkNameDuplicate(data.name)) {
      remoteForm.setError('name', { message: LABELS.mcpForm.duplicateName });
      return;
    }

    const newConfig: McpServerConfig = {
      type: 'remote',
      url: data.url,
      headers: parseKeyValueText(data.headersText ?? ''),
      enabled: data.enabled,
      timeout: parseTimeout(data.timeout),
    };

    saveServer(data.name, newConfig);
  };

  function saveServer(name: string, newServerConfig: McpServerConfig) {
    if (!config) {
      return;
    }
    const newMcp = { ...config.mcp };

    // Remove old entry if renaming
    if (!isNew && name !== serverName) {
      delete newMcp[serverName];
    }

    newMcp[name] = newServerConfig;
    updateMcp(newMcp);
    toast.success(isNew ? LABELS.mcpForm.added(name) : LABELS.mcpForm.updated(name));
    onBack();
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <FieldRow>
        <Button variant="ghost" size="icon-sm" onClick={onBack}>
          <ArrowLeft />
        </Button>
        <h2 className="text-lg font-semibold">
          {isNew ? LABELS.mcpForm.addTitle : LABELS.mcpForm.editTitle(serverName)}
        </h2>
      </FieldRow>

      <FieldRow>
        <span className="text-sm text-muted-foreground">{LABELS.mcpServer.type}：</span>
        <Select
          value={typeSwitch}
          onValueChange={(v) => setTypeSwitch(v as 'local' | 'remote')}
          items={{ local: LABELS.mcpServer.typeLocal, remote: LABELS.mcpServer.typeRemote }}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>{LABELS.mcpServer.type}</SelectLabel>
              <SelectItem value="local">{LABELS.mcpServer.typeLocal}</SelectItem>
              <SelectItem value="remote">{LABELS.mcpServer.typeRemote}</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </FieldRow>

      {typeSwitch === 'local' ? (
        <form onSubmit={localForm.handleSubmit(handleLocalSubmit)} className="flex flex-col gap-4">
          <FormField label={LABELS.mcpServer.name} error={localForm.formState.errors.name?.message}>
            <Input {...localForm.register('name')} placeholder="my-server" />
          </FormField>

          <FormField
            label={LABELS.mcpServer.command}
            error={localForm.formState.errors.commandText?.message}
          >
            <Textarea
              {...localForm.register('commandText')}
              placeholder={'npx\n-y\n@modelcontextprotocol/server'}
              rows={4}
            />
          </FormField>

          <FormField label={LABELS.mcpServer.env}>
            <Textarea
              {...localForm.register('envText')}
              placeholder={'API_KEY=xxx\nSECRET=yyy'}
              rows={3}
            />
          </FormField>

          <FormField label={LABELS.mcpServer.timeout}>
            <Input {...localForm.register('timeout')} type="number" placeholder="30000" />
          </FormField>

          <EnableSwitch
            checked={localForm.watch('enabled')}
            onCheckedChange={(v) => localForm.setValue('enabled', v)}
          />

          <FormActions onBack={onBack} />
        </form>
      ) : (
        <form
          onSubmit={remoteForm.handleSubmit(handleRemoteSubmit)}
          className="flex flex-col gap-4"
        >
          <FormField
            label={LABELS.mcpServer.name}
            error={remoteForm.formState.errors.name?.message}
          >
            <Input {...remoteForm.register('name')} placeholder="my-server" />
          </FormField>

          <FormField label={LABELS.mcpServer.url} error={remoteForm.formState.errors.url?.message}>
            <Input {...remoteForm.register('url')} placeholder="https://example.com/mcp" />
          </FormField>

          <FormField label={LABELS.mcpServer.headers}>
            <Textarea
              {...remoteForm.register('headersText')}
              placeholder="Authorization=Bearer xxx"
              rows={3}
            />
          </FormField>

          <FormField label={LABELS.mcpServer.timeout}>
            <Input {...remoteForm.register('timeout')} type="number" placeholder="30000" />
          </FormField>

          <EnableSwitch
            checked={remoteForm.watch('enabled')}
            onCheckedChange={(v) => remoteForm.setValue('enabled', v)}
          />

          <FormActions onBack={onBack} />
        </form>
      )}
    </div>
  );
}

function FieldRow({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('flex items-center gap-2', className)} {...props} />;
}

function EnableSwitch({
  checked,
  onCheckedChange,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <FieldRow>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
      <span className="text-sm">{LABELS.mcpServer.enabled}</span>
    </FieldRow>
  );
}

function FormActions({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex justify-end gap-2">
      <Button type="button" variant="outline" onClick={onBack}>
        {LABELS.common.cancel}
      </Button>
      <Button type="submit">{LABELS.common.save}</Button>
    </div>
  );
}

function FormField({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium">{label}</label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
