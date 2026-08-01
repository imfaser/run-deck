import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { Settings, Server } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import PageLayout from '@/components/layout/PageLayout';
import GeneralSettings from '@/components/config/GeneralSettings';
import McpServerList from '@/components/config/McpServerList';
import McpServerForm from '@/components/config/McpServerForm';
import type { McpServerConfig } from '@/schemas/config';
import { LABELS } from '@/constants/labels';

const configSearchSchema = z.object({
  section: z.enum(['general', 'mcp']).default('general'),
});

export const Route = createFileRoute('/config')({
  validateSearch: (search: Record<string, unknown>) => {
    const result = configSearchSchema.safeParse(search);
    if (result.success) {
      return result.data;
    }
    return { section: 'general' as const };
  },
  component: ConfigComponent,
});

type ConfigSearch = z.infer<typeof configSearchSchema>;

function ConfigComponent() {
  const { section } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [editingServer, setEditingServer] = useState<{
    name: string;
    config: McpServerConfig;
  } | null>(null);

  function handleEdit(name: string, config: McpServerConfig) {
    setEditingServer({ name, config });
    if (section !== 'mcp') {
      navigate({ search: (): ConfigSearch => ({ section: 'mcp' }), replace: true });
    }
  }

  function handleBack() {
    setEditingServer(null);
  }

  const aside = (
    <nav className="flex flex-col gap-1 p-2">
      <Button
        variant="ghost"
        className={cn('justify-start', section === 'general' && 'bg-muted text-foreground')}
        onClick={() => {
          setEditingServer(null);
          navigate({ search: (): ConfigSearch => ({ section: 'general' }), replace: true });
        }}
      >
        <Settings data-icon="inline-start" />
        {LABELS.nav.general}
      </Button>
      <Separator className="my-1" />
      <Button
        variant="ghost"
        className={cn(
          'justify-start',
          section === 'mcp' && !editingServer && 'bg-muted text-foreground'
        )}
        onClick={() => {
          setEditingServer(null);
          navigate({ search: (): ConfigSearch => ({ section: 'mcp' }), replace: true });
        }}
      >
        <Server data-icon="inline-start" />
        {LABELS.nav.mcpServers}
      </Button>
    </nav>
  );

  return (
    <PageLayout aside={aside}>
      {section === 'general' && <GeneralSettings />}
      {section === 'mcp' && !editingServer && <McpServerList onEdit={handleEdit} />}
      {section === 'mcp' && editingServer && (
        <McpServerForm
          serverName={editingServer.name}
          serverConfig={editingServer.config}
          onBack={handleBack}
        />
      )}
    </PageLayout>
  );
}
