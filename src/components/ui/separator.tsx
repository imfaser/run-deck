import * as React from 'react';
import { Separator } from '@base-ui/react/separator';

import { cn } from '@/lib/utils';

const SeparatorRoot = React.forwardRef<
  React.ComponentRef<typeof Separator>,
  React.ComponentPropsWithoutRef<typeof Separator>
>(({ className, orientation = 'horizontal', ...props }, ref) => (
  <Separator
    ref={ref}
    orientation={orientation}
    className={cn(
      'shrink-0 bg-border',
      orientation === 'horizontal' ? 'h-[1px] w-full' : 'h-full w-[1px]',
      className
    )}
    {...props}
  />
));
SeparatorRoot.displayName = 'Separator';

export { SeparatorRoot as Separator };
