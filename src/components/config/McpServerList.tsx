import { useState } from 'react';
import { useMemoizedFn } from 'ahooks';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from '@/components/ui/empty';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useConfig } from '@/hooks/useConfig';
import type { McpServerConfig } from '@/schemas/config';
import { LABELS } from '@/constants/labels';

interface McpServerListProps {
  onEdit: (name: string, config: McpServerConfig) => void;
}

export default function McpServerList({ onEdit }: McpServerListProps) {
  const { config, updateMcp } = useConfig();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const servers = Object.entries(config?.mcp ?? {});

  const handleToggle = useMemoizedFn((name: string, enabled: boolean) => {
    if (!config) {
      return;
    }
    const newMcp = { ...config.mcp };
    const server = newMcp[name];
    if (!server) {
      return;
    }
    newMcp[name] = { ...server, enabled };
    updateMcp(newMcp);
  });

  const handleDelete = useMemoizedFn((name: string) => {
    if (!config) {
      return;
    }
    const newMcp = { ...config.mcp };
    delete newMcp[name];
    updateMcp(newMcp);
    setDeleteTarget(null);
    toast.success(LABELS.mcpForm.deleted(name));
  });

  const handleAddType = useMemoizedFn((type: 'local' | 'remote') => {
    setAddDialogOpen(false);
    const serverConfig: McpServerConfig =
      type === 'local'
        ? { type: 'local', command: [], enabled: true }
        : { type: 'remote', url: '', enabled: true };
    onEdit('__new__', serverConfig);
  });

  if (servers.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>{LABELS.mcpList.emptyTitle}</EmptyTitle>
          <EmptyDescription>{LABELS.mcpList.emptyDesc}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button onClick={() => setAddDialogOpen(true)}>
            <Plus data-icon="inline-start" />
            {LABELS.mcpList.addServer}
          </Button>
        </EmptyContent>
        <AddTypeDialog
          open={addDialogOpen}
          onOpenChange={setAddDialogOpen}
          onSelect={handleAddType}
        />
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{LABELS.mcpList.title}</h2>
        <Button size="sm" onClick={() => setAddDialogOpen(true)}>
          <Plus data-icon="inline-start" />
          {LABELS.mcpList.add}
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        {servers.map(([name, server]) => (
          <Card key={name}>
            <CardContent className="flex items-center justify-between gap-3 py-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate font-medium">{name}</span>
                <Badge variant="secondary" className="shrink-0">
                  {server.type === 'local' ? 'STDIO' : 'HTTP'}
                </Badge>
                {!server.enabled && (
                  <Badge variant="outline" className="shrink-0 text-muted-foreground">
                    {LABELS.mcpServer.disabled}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Switch
                  checked={server.enabled}
                  onCheckedChange={(checked) => handleToggle(name, checked)}
                />
                <Button variant="ghost" size="icon-sm" onClick={() => onEdit(name, server)}>
                  <Pencil />
                </Button>
                <Button variant="ghost" size="icon-sm" onClick={() => setDeleteTarget(name)}>
                  <Trash2 />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <AddTypeDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onSelect={handleAddType}
      />

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{LABELS.mcpList.deleteTitle}</DialogTitle>
            <DialogDescription>
              {deleteTarget ? LABELS.mcpList.deleteDesc(deleteTarget) : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              {LABELS.common.cancel}
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
            >
              {LABELS.common.delete}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AddTypeDialog({
  open,
  onOpenChange,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (type: 'local' | 'remote') => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{LABELS.mcpList.selectTypeTitle}</DialogTitle>
          <DialogDescription>{LABELS.mcpList.selectTypeDesc}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Button variant="outline" onClick={() => onSelect('local')}>
            {LABELS.mcpServer.typeLocalFull}
          </Button>
          <Button variant="outline" onClick={() => onSelect('remote')}>
            {LABELS.mcpServer.typeRemoteFull}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
