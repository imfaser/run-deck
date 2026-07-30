import { Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';

export function NotFoundComponent() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
      <h1 className="text-6xl font-bold">404</h1>
      <p className="text-xl text-muted-foreground">Page not found</p>
      <Button render={<Link to="/" />}>Back to Home</Button>
    </div>
  );
}
