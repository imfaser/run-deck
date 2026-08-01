import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Settings, Activity } from 'lucide-react';
import { useAppStore } from '@/store/app';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const apps = [
  {
    id: 'config',
    title: '配置',
    description: '日志级别、首页、主题、MCP 服务器管理',
    icon: Settings,
    route: '/config',
  },
  {
    id: 'mcp-panel',
    title: 'MCP 面板',
    description: '查看 MCP 服务器工具、提示、资源',
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
    addTab({ title: app.title, closable: true, route: app.route });
    setActiveTab(app.route);
    navigate({ to: app.route });
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-2xl font-bold">导航</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {apps.map((app) => {
          const Icon = app.icon;
          return (
            <Card
              key={app.id}
              className="cursor-pointer transition-colors hover:bg-muted/50"
              onClick={() => handleAppClick(app)}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Icon className="size-5" />
                  {app.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{app.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
