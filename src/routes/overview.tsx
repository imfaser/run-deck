import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Settings, Activity } from 'lucide-react';
import { useAppStore } from '@/store/app';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LABELS } from '@/constants/labels';

const FIXED_ROUTES = new Set(['/overview', '/config']);

const apps = [
  {
    id: 'config',
    title: LABELS.nav.config,
    description: LABELS.overview.configDesc,
    icon: Settings,
    route: '/config',
  },
  {
    id: 'mcp-panel',
    title: LABELS.nav.mcpPanel,
    description: LABELS.overview.mcpPanelDesc,
    icon: Activity,
    route: '/mcp-panel',
  },
] as const;

export const Route = createFileRoute('/overview')({
  component: OverviewComponent,
});

function OverviewComponent() {
  const navigate = useNavigate();
  const addTab = useAppStore((s) => s.addTab);
  const setActiveTab = useAppStore((s) => s.setActiveTab);

  function handleAppClick(app: (typeof apps)[number]) {
    if (FIXED_ROUTES.has(app.route)) {
      setActiveTab(app.route);
    } else {
      addTab({ title: app.title, closable: true, route: app.route });
      setActiveTab(app.route);
    }
    navigate({ to: app.route });
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6">
      <h1 className="text-2xl font-bold">{LABELS.overview.title}</h1>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 sm:gap-4">
        {apps.map((app) => {
          const Icon = app.icon;
          return (
            <Card
              key={app.id}
              className="cursor-pointer transition-colors hover:bg-muted/50"
              onClick={() => handleAppClick(app)}
            >
              <CardHeader className="p-3 sm:p-4">
                <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                  <Icon className="size-4 sm:size-5" />
                  {app.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="hidden p-3 pt-0 sm:block sm:p-4 sm:pt-0">
                <p className="text-xs text-muted-foreground sm:text-sm">{app.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
