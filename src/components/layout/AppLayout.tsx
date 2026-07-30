import type { ReactNode } from 'react';
import TitleBar from './TitleBar';

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="h-screen bg-background text-foreground overflow-hidden">
      <TitleBar />
      <main className="pt-10 h-full overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
