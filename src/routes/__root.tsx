import { Outlet, createRootRoute, useLocation } from '@tanstack/react-router';
import AppLayout from '@/components/layout/AppLayout';

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  const location = useLocation();
  // label-settings 窗口使用自己的迷你标题栏，不走主布局
  if (location.pathname === '/label-settings') {
    return <Outlet />;
  }
  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
}
