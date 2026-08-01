import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageLayoutProps {
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}

export default function PageLayout({ aside, children, className }: PageLayoutProps) {
  return (
    <div className={cn('flex h-full', className)}>
      {aside != null && (
        <aside className="w-64 shrink-0 border-r border-border overflow-y-auto">{aside}</aside>
      )}
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
