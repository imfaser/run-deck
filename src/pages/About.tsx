import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function About() {
  return (
    <div className="mx-auto max-w-3xl space-y-8 p-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight">About</h1>
        <p className="mt-2 text-muted-foreground">React migration from Vue 3</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Migration Status</CardTitle>
          <CardDescription>Vue to React migration progress</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            This project is migrating from Vue 3 to React 19. The skeleton structure is in place.
            Migrate your components, stores, and services from the Vue codebase.
          </p>
        </CardContent>
      </Card>

      <div className="flex justify-center gap-4">
        <Button render={<Link to="/" />}>Home</Button>
      </div>
    </div>
  );
}
