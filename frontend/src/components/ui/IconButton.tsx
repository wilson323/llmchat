import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from './Button';
import type { ButtonProps } from './ui.types';
import type { IconButtonProps } from './ui.types';

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, variant = 'ghost', radius = 'md', ...props }: IconButtonProps, ref) => {
    const isGlass = variant === 'glass';
    const baseGlass =
      'bg-gradient-to-br from-white/15 to-white/5 backdrop-blur-md border border-white/30 hover:from-white/25 hover:to-white/10 text-foreground shadow-xl hover:shadow-2xl';

    // glass 走 secondary 基底以获得一致的焦点环和禁用态
    const mappedVariant: ButtonProps['variant'] = isGlass ? 'secondary' : (variant as ButtonProps['variant']);

    return (
      <Button
        ref={ref}
        size="icon"
        radius={radius}
        variant={mappedVariant}
        className={cn(isGlass ? baseGlass : '', className)}
        {...props}
      />
    );
  },
);
IconButton.displayName = 'IconButton';
