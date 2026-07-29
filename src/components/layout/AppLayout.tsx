import { Outlet } from 'react-router';
import TitleBar from './TitleBar';

export default function AppLayout() {
  return (
    <div className="h-screen bg-background text-foreground overflow-hidden">
      <TitleBar />
      <main className="pt-10 h-full overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
