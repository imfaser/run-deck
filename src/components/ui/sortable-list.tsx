import type { ReactNode } from 'react';
import { AnimatePresence, LayoutGroup, Reorder } from 'motion/react';
import { cn } from '@/lib/utils';

interface SortableListProps<T extends { id: string }> {
  items: T[];
  onReorder: (items: T[]) => void;
  renderItem: (item: T, index: number) => ReactNode;
  disabled?: boolean;
  className?: string;
}

/**
 * 基于 motion `Reorder.Group` 的拖拽排序列表。
 * `renderItem` 负责渲染单项内容；拖拽禁用时传 `disabled`。
 */
export function SortableList<T extends { id: string }>({
  items,
  onReorder,
  renderItem,
  disabled = false,
  className,
}: SortableListProps<T>) {
  return (
    <LayoutGroup>
      <Reorder.Group
        axis="y"
        values={items}
        onReorder={onReorder}
        className={cn('flex flex-col', className)}
      >
        <AnimatePresence initial={false}>
          {items.map((item, index) => (
            <Reorder.Item
              key={item.id}
              value={item}
              dragListener={!disabled}
              layout
              className="relative"
            >
              {renderItem(item, index)}
            </Reorder.Item>
          ))}
        </AnimatePresence>
      </Reorder.Group>
    </LayoutGroup>
  );
}
