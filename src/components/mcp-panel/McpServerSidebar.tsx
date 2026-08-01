import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useMcpServerStatus, type McpServerConfigEntry } from '@/hooks/useMcpServers';
import { getStatusKind, type ServerStatus } from '@/schemas/config';

interface McpServerSidebarProps {
  servers: McpServerConfigEntry[];
  selectedName: string | null;
  onSelect: (name: string) => void;
}

function getStatusLabel(status: ServerStatus | null): string {
  const kind = getStatusKind(status);
  switch (kind) {
    case 'Starting':
      return '启动中';
    case 'Running':
      return '运行中';
    case 'Stopped':
      return '已停止';
    case 'Failed':
      return '失败';
    default:
      return '未知';
  }
}

function getStatusVariant(
  status: ServerStatus | null
): 'default' | 'secondary' | 'destructive' | 'outline' {
  const kind = getStatusKind(status);
  switch (kind) {
    case 'Running':
      return 'default';
    case 'Starting':
      return 'secondary';
    case 'Failed':
      return 'destructive';
    case 'Stopped':
      return 'outline';
    default:
      return 'outline';
  }
}

function ServerEntry({
  name,
  entry,
  isSelected,
  onSelect,
}: {
  name: string;
  entry: McpServerConfigEntry;
  isSelected: boolean;
  onSelect: (name: string) => void;
}) {
  const { status } = useMcpServerStatus(name, entry.config.enabled);

  return (
    <button
      className={cn(
        'flex flex-col gap-0.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted',
        isSelected && 'bg-muted text-foreground'
      )}
      onClick={() => onSelect(name)}
    >
      <div className="flex items-center gap-2">
        <span className="truncate font-medium">{name}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <Badge variant="secondary" className="px-1 py-0 text-[10px]">
          {entry.config.type === 'local' ? 'STDIO' : 'HTTP'}
        </Badge>
        {!entry.config.enabled ? (
          <Badge variant="outline" className="px-1 py-0 text-[10px]">
            已禁用
          </Badge>
        ) : (
          <Badge variant={getStatusVariant(status)} className="px-1 py-0 text-[10px]">
            {getStatusLabel(status)}
          </Badge>
        )}
      </div>
    </button>
  );
}

export default function McpServerSidebar({
  servers,
  selectedName,
  onSelect,
}: McpServerSidebarProps) {
  return (
    <nav className="flex flex-col gap-1 p-2">
      {servers.map((entry) => (
        <ServerEntry
          key={entry.name}
          name={entry.name}
          entry={entry}
          isSelected={selectedName === entry.name}
          onSelect={onSelect}
        />
      ))}
    </nav>
  );
}
