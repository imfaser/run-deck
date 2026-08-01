import { AlertTriangle } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Empty, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { getStatusKind, getStatusError, type McpServerConfig } from '@/schemas/config';
import {
  useMcpServerStatus,
  useMcpTools,
  useMcpPrompts,
  useMcpResources,
} from '@/hooks/useMcpServers';

interface McpServerDetailProps {
  selectedServerName: string | null;
  servers: Array<{ name: string; config: McpServerConfig }>;
}

function ToolParams({ inputSchema }: { inputSchema: Record<string, unknown> }) {
  const properties = inputSchema.properties as Record<string, { type?: string }> | undefined;
  const required = inputSchema.required as string[] | undefined;
  if (!properties) {
    return <>-</>;
  }
  return (
    <>
      {Object.entries(properties)
        .map(
          ([key, prop]) => `${key}(${prop.type ?? 'unknown'}${required?.includes(key) ? '*' : ''})`
        )
        .join(', ')}
    </>
  );
}

function StatusAlert({
  variant = 'default',
  title,
  description,
}: {
  variant?: 'default' | 'destructive';
  title: string;
  description: string;
}) {
  return (
    <div className="p-4">
      <Alert variant={variant}>
        <AlertTriangle className="size-4" />
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription>{description}</AlertDescription>
      </Alert>
    </div>
  );
}

export default function McpServerDetail({ selectedServerName, servers }: McpServerDetailProps) {
  const selectedEntry = servers.find((s) => s.name === selectedServerName);
  const { status } = useMcpServerStatus(
    selectedServerName ?? '',
    selectedEntry?.config.enabled ?? false
  );

  const { data: allTools, error: toolsError } = useMcpTools();
  const { data: allPrompts, error: promptsError } = useMcpPrompts();
  const { data: allResources, error: resourcesError } = useMcpResources();

  if (!selectedServerName) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>请选择一个 MCP 服务器查看详情</EmptyTitle>
        </EmptyHeader>
      </Empty>
    );
  }

  if (!selectedEntry) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>服务器不存在</EmptyTitle>
        </EmptyHeader>
      </Empty>
    );
  }

  const statusKind = getStatusKind(status);

  if (!selectedEntry.config.enabled) {
    return <StatusAlert title="服务器已禁用" description="该服务器已在配置中禁用" />;
  }

  if (statusKind === 'Failed') {
    return (
      <StatusAlert
        variant="destructive"
        title="服务器启动失败"
        description={getStatusError(status) ?? '未知错误'}
      />
    );
  }

  if (statusKind !== 'Running') {
    return (
      <StatusAlert variant="destructive" title="服务器未运行" description={`状态：${statusKind}`} />
    );
  }

  const tools = (allTools ?? []).filter((t) => t.server_name === selectedServerName);
  const prompts = (allPrompts ?? []).filter((p) => p.server_name === selectedServerName);
  const resources = (allResources ?? []).filter((r) => r.server_name === selectedServerName);
  const hasError = toolsError || promptsError || resourcesError;

  return (
    <div className="flex flex-col gap-4 p-4">
      <h2 className="text-lg font-semibold">{selectedServerName}</h2>

      {hasError && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>获取服务器数据失败</AlertTitle>
          <AlertDescription>
            {(toolsError ?? promptsError ?? resourcesError)?.message ?? '未知错误'}
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="tools">
        <TabsList>
          <TabsTrigger value="tools">工具 ({tools.length})</TabsTrigger>
          <TabsTrigger value="prompts">提示 ({prompts.length})</TabsTrigger>
          <TabsTrigger value="resources">资源 ({resources.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="tools">
          {tools.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>暂无工具</EmptyTitle>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名称</TableHead>
                  <TableHead>描述</TableHead>
                  <TableHead>参数</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tools.map((t) => (
                  <TableRow key={`${t.server_name}-${String(t.tool.name)}`}>
                    <TableCell className="font-medium">{String(t.tool.name ?? '-')}</TableCell>
                    <TableCell className="max-w-xs truncate text-muted-foreground">
                      {String(t.tool.description ?? '-')}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {t.tool.inputSchema ? (
                        <ToolParams inputSchema={t.tool.inputSchema as Record<string, unknown>} />
                      ) : (
                        '-'
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        <TabsContent value="prompts">
          {prompts.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>暂无提示</EmptyTitle>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名称</TableHead>
                  <TableHead>描述</TableHead>
                  <TableHead>参数</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {prompts.map((p) => (
                  <TableRow key={`${p.server_name}-${String(p.prompt.name)}`}>
                    <TableCell className="font-medium">{String(p.prompt.name ?? '-')}</TableCell>
                    <TableCell className="max-w-xs truncate text-muted-foreground">
                      {String(p.prompt.description ?? '-')}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {Array.isArray(p.prompt.arguments)
                        ? (p.prompt.arguments as Array<Record<string, unknown>>)
                            .map((a) => String(a.name ?? ''))
                            .join(', ')
                        : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        <TabsContent value="resources">
          {resources.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>暂无资源</EmptyTitle>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名称</TableHead>
                  <TableHead>URI</TableHead>
                  <TableHead>MIME 类型</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resources.map((r) => (
                  <TableRow key={`${r.server_name}-${String(r.resource.uri)}`}>
                    <TableCell className="font-medium">{String(r.resource.name ?? '-')}</TableCell>
                    <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                      {String(r.resource.uri ?? '-')}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {String(r.resource.mimeType ?? '-')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
