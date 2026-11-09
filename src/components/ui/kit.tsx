import { useEffect, type ReactNode } from 'react';
import { ChevronLeft, Minus, Plus, X } from 'lucide-react';
import { cn, haptic } from '@/lib/utils';
import { goBack } from '@/lib/router';

/** Full-height page with sticky header and optional sticky footer. */
export function Page({ title, back, actions, footer, children, className }: {
    title: ReactNode;
    back?: boolean | (() => void);
    actions?: ReactNode;
    footer?: ReactNode;
    children: ReactNode;
    className?: string;
}) {
    return (
        <div className="flex h-[100dvh] flex-col">
            <header className="pt-safe flex-none border-b bg-background/95 backdrop-blur">
                <div className="mx-auto flex h-14 w-full max-w-2xl items-center gap-1 px-2">
                    {back ? (
                        <button
                            aria-label="Zurück"
                            className="flex h-11 w-11 items-center justify-center rounded-full active:bg-accent"
                            onClick={typeof back === 'function' ? back : () => goBack()}
                        >
                            <ChevronLeft className="h-6 w-6" />
                        </button>
                    ) : <div className="w-2" />}
                    <h1 className="flex-1 truncate text-lg font-semibold">{title}</h1>
                    {actions}
                </div>
            </header>
            <main className={cn('mx-auto w-full max-w-2xl flex-1 overflow-y-auto px-4 py-4', className)}>{children}</main>
            {footer && <footer className="pb-safe flex-none border-t bg-background px-4 pt-3"><div className="mx-auto max-w-2xl">{footer}</div></footer>}
        </div>
    );
}

export function Section({ title, children, right }: { title?: ReactNode; children: ReactNode; right?: ReactNode }) {
    return (
        <section className="mb-6">
            {(title || right) && (
                <div className="mb-2 flex items-center justify-between px-1">
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
                    {right}
                </div>
            )}
            {children}
        </section>
    );
}

export function Segmented<T extends string | number>({ value, options, onChange, className }: {
    value: T;
    options: { value: T; label: ReactNode }[];
    onChange: (v: T) => void;
    className?: string;
}) {
    return (
        <div className={cn('grid gap-1 rounded-xl bg-muted p-1', className)} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
            {options.map(o => (
                <button
                    key={String(o.value)}
                    onClick={() => { haptic(); onChange(o.value); }}
                    className={cn(
                        'h-10 rounded-lg text-sm font-semibold transition-colors',
                        o.value === value ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground active:bg-accent',
                    )}
                >
                    {o.label}
                </button>
            ))}
        </div>
    );
}

export function Stepper({ value, onChange, min = 0, max = 99, format }: {
    value: number; onChange: (v: number) => void; min?: number; max?: number; format?: (v: number) => ReactNode;
}) {
    const btn = 'flex h-10 w-10 items-center justify-center rounded-full bg-secondary active:bg-accent disabled:opacity-30';
    return (
        <div className="flex items-center gap-3">
            <button className={btn} disabled={value <= min} onClick={() => { haptic(); onChange(value - 1); }} aria-label="weniger"><Minus className="h-5 w-5" /></button>
            <span className="w-12 text-center text-xl font-bold tabular-nums">{format ? format(value) : value}</span>
            <button className={btn} disabled={value >= max} onClick={() => { haptic(); onChange(value + 1); }} aria-label="mehr"><Plus className="h-5 w-5" /></button>
        </div>
    );
}

export function Row({ label, children, hint }: { label: ReactNode; children: ReactNode; hint?: ReactNode }) {
    return (
        <div className="flex min-h-14 items-center justify-between gap-3 border-b px-1 py-2 last:border-0">
            <div>
                <div className="font-medium">{label}</div>
                {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
            </div>
            {children}
        </div>
    );
}

export function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
    return (
        <button
            role="switch"
            aria-checked={checked}
            onClick={() => { haptic(); onChange(!checked); }}
            className={cn('relative h-7 w-12 rounded-full transition-colors', checked ? 'bg-primary' : 'bg-secondary')}
        >
            <span className={cn('absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all', checked ? 'left-6' : 'left-1')} />
        </button>
    );
}

/** Bottom sheet dialog (comfortable to reach with the thumb). */
export function Sheet({ open, onClose, title, children, dismissable = true }: {
    open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; dismissable?: boolean;
}) {
    useEffect(() => {
        if (!open || !dismissable) return;
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose, dismissable]);

    if (!open) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
            <div className="absolute inset-0 bg-black/60 animate-in fade-in" onClick={dismissable ? onClose : undefined} />
            <div className="pb-safe relative max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border bg-popover px-4 pt-3 shadow-2xl animate-in slide-in-from-bottom-10 sm:rounded-3xl sm:pb-4">
                <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-muted sm:hidden" />
                {(title || dismissable) && (
                    <div className="mb-3 flex items-center justify-between">
                        <h2 className="text-lg font-semibold">{title}</h2>
                        {dismissable && (
                            <button className="flex h-9 w-9 items-center justify-center rounded-full bg-muted" onClick={onClose} aria-label="Schließen">
                                <X className="h-5 w-5" />
                            </button>
                        )}
                    </div>
                )}
                {children}
            </div>
        </div>
    );
}

export function Card({ children, className, onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
    const Comp = onClick ? 'button' : 'div';
    return (
        <Comp onClick={onClick} className={cn('w-full rounded-2xl border bg-card p-4 text-left', onClick && 'active:bg-accent', className)}>
            {children}
        </Comp>
    );
}

export function Empty({ children }: { children: ReactNode }) {
    return <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">{children}</div>;
}

export function Toast({ message, onClose }: { message: string | null; onClose: () => void }) {
    useEffect(() => {
        if (!message) return;
        const t = setTimeout(onClose, 3500);
        return () => clearTimeout(t);
    }, [message, onClose]);
    if (!message) return null;
    return (
        <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex justify-center px-4 pt-safe">
            <div className="pointer-events-auto mt-3 rounded-xl border bg-popover px-4 py-3 text-sm shadow-xl animate-in fade-in slide-in-from-top-4" onClick={onClose}>
                {message}
            </div>
        </div>
    );
}

export function Field(props: React.InputHTMLAttributes<HTMLInputElement>) {
    return (
        <input
            {...props}
            className={cn('h-12 w-full rounded-xl border bg-card px-4 text-base outline-none focus:border-primary', props.className)}
        />
    );
}
