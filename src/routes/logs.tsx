import { createFileRoute } from '@tanstack/react-router';
import LogSettings from '@/components/config/LogSettings';
import { LogViewer } from '@/components/config/LogViewer';

export const Route = createFileRoute('/logs')({
  component: LogsComponent,
});

function LogsComponent() {
  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <LogSettings />
      <LogViewer />
    </div>
  );
}
