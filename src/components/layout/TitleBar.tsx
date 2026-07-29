import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Home, Settings, Sun, Moon, Minus, Square, Copy, X } from 'lucide-react';
import { useMount, useMemoizedFn } from 'ahooks';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useAppStore } from '@/store/app';
import { useTheme } from '@/hooks/useTheme';

const appWindow = getCurrentWindow();

interface FixedTab {
  id: string;
  title: string;
  icon: typeof Home;
  route: string;
}

const fixedTabs: FixedTab[] = [
  { id: 'overview', title: '导航', icon: Home, route: '/overview' },
  { id: 'config', title: '配置', icon: Settings, route: '/config' },
];

const routeTitles: Record<string, string> = {
  '/label': '标注',
  '/mcp-panel': 'MCP 面板',
};

function FixedTabs({
  activeTab,
  location,
  onTabClick,
}: {
  activeTab: string;
  location: ReturnType<typeof useLocation>;
  onTabClick: (id: string, route: string) => void;
}) {
  return (
    <>
      {fixedTabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id || location.pathname === tab.route;
        return (
          <Button
            key={tab.id}
            variant="ghost"
            size="xs"
            className={cn(isActive && 'bg-muted text-foreground')}
            onClick={() => onTabClick(tab.id, tab.route)}
          >
            <Icon data-icon="inline-start" />
            {tab.title}
          </Button>
        );
      })}
    </>
  );
}

function DynamicTabs({
  tabs,
  activeTab,
  location,
  onTabClick,
  onCloseTab,
}: {
  tabs: Array<{ id: string; route: string }>;
  activeTab: string;
  location: ReturnType<typeof useLocation>;
  onTabClick: (id: string, route: string) => void;
  onCloseTab: (id: string) => void;
}) {
  if (tabs.length === 0) {
    return null;
  }

  return (
    <>
      <Separator orientation="vertical" className="h-5 shrink-0" />
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id || location.pathname === tab.route;
        return (
          <Button
            key={tab.id}
            variant="ghost"
            size="xs"
            className={cn('pr-1', isActive && 'bg-muted text-foreground')}
            onClick={() => onTabClick(tab.id, tab.route)}
          >
            <span className="truncate max-w-[120px]">{routeTitles[tab.route] ?? tab.id}</span>
            <span
              className="flex items-center justify-center size-4 rounded-sm ml-1 hover:bg-muted transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                onCloseTab(tab.id);
              }}
            >
              <X />
            </span>
          </Button>
        );
      })}
    </>
  );
}

function WindowControls({
  isMaximized,
  theme,
  onToggleTheme,
}: {
  isMaximized: boolean;
  theme: string;
  onToggleTheme: () => void;
}) {
  return (
    <div className="flex items-center h-full shrink-0 gap-0.5 pr-1">
      <Button variant="ghost" size="icon-sm" onClick={onToggleTheme} data-tauri-drag-region={false}>
        {theme === 'dark' ? <Sun /> : <Moon />}
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => appWindow.minimize()}
        data-tauri-drag-region={false}
      >
        <Minus />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => appWindow.toggleMaximize()}
        data-tauri-drag-region={false}
      >
        {isMaximized ? <Copy /> : <Square />}
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        className="hover:bg-destructive hover:text-destructive-foreground"
        onClick={() => appWindow.close()}
        data-tauri-drag-region={false}
      >
        <X />
      </Button>
    </div>
  );
}

export default function TitleBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { tabs, activeTab, setActiveTab, removeTab } = useAppStore();
  const { theme, toggleTheme } = useTheme();
  const [isMaximized, setIsMaximized] = useState(false);

  useMount(async () => {
    setIsMaximized(await appWindow.isMaximized());
    await appWindow.onResized(async () => {
      setIsMaximized(await appWindow.isMaximized());
    });
  });

  const handleTabClick = useMemoizedFn((tabId: string, tabRoute: string) => {
    setActiveTab(tabId);
    navigate(tabRoute);
  });

  const handleCloseTab = useMemoizedFn((tabId: string) => {
    removeTab(tabId);
    const { tabs: currentTabs, activeTab: newActive } = useAppStore.getState();
    const target = currentTabs.find((t) => t.id === newActive);
    navigate(target?.route ?? '/overview');
  });

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[999] h-10 flex items-center justify-between border-b border-border bg-background select-none"
      data-tauri-drag-region
    >
      <div className="flex items-center h-full pl-3 gap-1 overflow-x-auto max-w-[calc(100vw-150px)] [&::-webkit-scrollbar]:hidden">
        <FixedTabs activeTab={activeTab} location={location} onTabClick={handleTabClick} />
        <DynamicTabs
          tabs={tabs}
          activeTab={activeTab}
          location={location}
          onTabClick={handleTabClick}
          onCloseTab={handleCloseTab}
        />
      </div>
      <WindowControls isMaximized={isMaximized} theme={theme} onToggleTheme={toggleTheme} />
    </div>
  );
}
