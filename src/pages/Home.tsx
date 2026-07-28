import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function Home() {
  return (
    <div className="mx-auto max-w-3xl space-y-8 p-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight">React + Tailwind + shadcn/ui</h1>
        <p className="mt-2 text-muted-foreground">Tauri 2 Desktop Application with React 19</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Getting Started</CardTitle>
            <CardDescription>Welcome to the React migration</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              This is a skeleton React application. Migrate your Vue components to React here.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Technology Stack</CardTitle>
            <CardDescription>Modern React development</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>React 19</li>
              <li>TypeScript 7</li>
              <li>Tailwind CSS 4</li>
              <li>shadcn/ui</li>
              <li>Zustand</li>
              <li>React Router 8</li>
            </ul>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-center gap-4">
        <Button render={<Link to="/about" />}>About Page</Button>
      </div>
    </div>
  );
}
