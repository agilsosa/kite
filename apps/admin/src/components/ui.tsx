import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
type ButtonSize = 'default' | 'icon';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'border-ink bg-ink text-paper shadow-kite-sm hover:bg-ink-soft active:translate-x-0.5 active:translate-y-0.5 active:shadow-none',
  secondary:
    'border-ink bg-paper text-ink shadow-kite-sm hover:bg-marigold/40 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none',
  danger:
    'border-ink bg-coral text-white shadow-kite-sm hover:bg-[#c84520] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none',
  ghost:
    'border-transparent bg-transparent text-ink hover:bg-ink/10 active:translate-x-0.5 active:translate-y-0.5',
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  default: 'min-h-11 px-4 py-2.5 text-sm',
  icon: 'h-11 w-11 p-0',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({
  variant = 'primary',
  size = 'default',
  className = '',
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 font-extrabold whitespace-nowrap transition disabled:cursor-not-allowed disabled:opacity-45 ${BUTTON_SIZES[size]} ${BUTTON_VARIANTS[variant]} ${className}`.trim()}
      type={type}
      {...props}
    />
  );
}

export const inputClass =
  'min-h-12 w-full rounded-xl border-2 border-ink/20 bg-white/70 px-3 font-semibold text-ink placeholder:text-ink-soft/55';

interface SectionCardProps {
  id?: string;
  title: string;
  description?: string;
  icon: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function SectionCard({
  id,
  title,
  description,
  icon,
  action,
  children,
  className = '',
}: SectionCardProps) {
  return (
    <section
      className={`rounded-[2rem] border-4 border-ink bg-paper/90 p-5 shadow-kite sm:p-6 ${className}`.trim()}
      id={id}
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border-2 border-ink bg-marigold shadow-kite-sm">
            {icon}
          </span>
          <div className="min-w-0">
            <h2 className="text-xl leading-tight font-black tracking-tight sm:text-2xl">
              {title}
            </h2>
            {description ? (
              <p className="mt-1 max-w-xl text-sm font-semibold text-ink-soft">
                {description}
              </p>
            ) : null}
          </div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </header>

      <div className="mt-5">{children}</div>
    </section>
  );
}

interface FieldProps {
  label: string;
  hint?: string;
  htmlFor?: string;
  className?: string;
  children: ReactNode;
}

export function Field({
  label,
  hint,
  htmlFor,
  className = '',
  children,
}: FieldProps) {
  return (
    <label
      className={`flex flex-col gap-1.5 text-sm font-extrabold ${className}`.trim()}
      htmlFor={htmlFor}
    >
      <span>{label}</span>
      {children}
      {hint ? (
        <span className="text-xs font-semibold text-ink-soft">{hint}</span>
      ) : null}
    </label>
  );
}

export function CountBadge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border-2 border-ink/20 bg-white/70 px-3 py-1 text-xs font-black text-ink-soft">
      {children}
    </span>
  );
}
