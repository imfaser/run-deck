import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/config')({
  component: ConfigComponent,
});

function ConfigComponent() {
  return (
    <div className="flex items-center justify-center h-full">
      <p className="text-muted-foreground">配置页面</p>
    </div>
  );
}
