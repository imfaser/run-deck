import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import PageLayout from '@/components/layout/PageLayout';
import McpServerSidebar from '@/components/mcp-panel/McpServerSidebar';
import McpServerDetail from '@/components/mcp-panel/McpServerDetail';
import { useMcpServerConfigs } from '@/hooks/useMcpServers';

export const Route = createFileRoute('/mcp-panel')({
  component: McpPanelComponent,
});

function McpPanelComponent() {
  const servers = useMcpServerConfigs();
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const effectiveSelected = selectedName ?? servers[0]?.name ?? null;

  return (
    <PageLayout
      aside={
        <McpServerSidebar
          servers={servers}
          selectedName={effectiveSelected}
          onSelect={setSelectedName}
        />
      }
    >
      <McpServerDetail selectedServerName={effectiveSelected} servers={servers} />
    </PageLayout>
  );
}
