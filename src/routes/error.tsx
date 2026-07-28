import { Link, useRouteError } from 'react-router';
import { getErrorMessage } from '@/lib/errors';
import { Button } from '@/components/ui/button';

export default function ErrorPage() {
  const message = getErrorMessage(useRouteError());

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
      <h1 className="text-6xl font-bold">Error</h1>
      <p className="text-xl text-muted-foreground">{message}</p>
      <Button render={<Link to="/" />}>Back to Home</Button>
    </div>
  );
}
