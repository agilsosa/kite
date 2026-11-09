import { Button as BaseButton } from '@base-ui/react/button';
import type { ComponentProps } from 'react';
import type { ButtonVariant } from '../../shared/types';

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'border-ink bg-ink text-paper shadow-kite-sm hover:bg-ink-soft active:translate-x-0.5 active:translate-y-0.5 active:shadow-none',
  secondary:
    'border-ink bg-paper text-ink shadow-kite-sm hover:bg-marigold/40 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none',
  danger:
    'border-ink bg-coral text-white shadow-kite-sm hover:bg-[#c84520] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none',
  ghost:
    'border-transparent bg-transparent text-ink hover:bg-ink/10 active:translate-x-0.5 active:translate-y-0.5',
};

interface ButtonProps extends Omit<
  ComponentProps<typeof BaseButton>,
  'className'
> {
  variant?: ButtonVariant;
  className?: string;
}

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonProps) {
  return (
    <BaseButton
      className={`inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 px-5 py-3 text-base font-extrabold transition disabled:cursor-not-allowed disabled:opacity-50 ${variantClasses[variant]} ${className}`.trim()}
      {...props}
    />
  );
}
