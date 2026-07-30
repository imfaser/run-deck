import { useRouter } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';

export function ErrorComponent({ error }: { error: Error }) {
  const router = useRouter();

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
      <h1 className="text-6xl font-bold">Error</h1>
      <p className="text-xl text-muted-foreground">{error.message}</p>
      <Button onClick={() => router.invalidate()}>Back to Home</Button>
    </div>
  );
}
