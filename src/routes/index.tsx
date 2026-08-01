import { createFileRoute, Navigate } from '@tanstack/react-router';
import { useConfig } from '@/hooks/useConfig';

export const Route = createFileRoute('/')({
  component: IndexRedirect,
});

function IndexRedirect() {
  const { config } = useConfig();
  const target = config?.frontend?.home === 'config' ? '/config' : '/overview';
  return <Navigate to={target} replace />;
}
