import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/overview')({
  component: OverviewComponent,
});

function OverviewComponent() {
  return (
    <div className="flex items-center justify-center h-full">
      <p className="text-muted-foreground">导航页面</p>
    </div>
  );
}
