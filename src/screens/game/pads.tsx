import { useState, type ReactNode } from 'react';
import { ChevronRight, Delete, Undo2 } from 'lucide-react';
import { cn, haptic } from '@/lib/utils';
import type { Multiplier } from '@/game/types';

function Key({ children, onClick, className, disabled }: { children: ReactNode; onClick: () => void; className?: string; disabled?: boolean }) {
    return (
        <button
            disabled={disabled}
            onClick={() => { haptic(); onClick(); }}
            className={cn(
                'flex min-h-[44px] [@media(max-height:700px)]:min-h-[38px] landscape:max-lg:min-h-[32px] items-center justify-center rounded-xl bg-secondary text-xl font-bold tabular-nums transition-[background-color,transform] active:scale-95 active:bg-accent disabled:opacity-30',
                className,
            )}
        >
            {children}
        </button>
    );
}

/** Single dart input: modifier + segment. Used for X01 and Cricket. */
export function DartPad({ numbers, onDart, onNext, disabled, highlight }: {
    numbers: number[];
    onDart: (s: number, m: Multiplier) => void;
    /** Remaining darts count as misses, next player */
    onNext: () => void;
    disabled?: boolean;
    /** Target to emphasise (Around the Clock / Shanghai) */
    highlight?: number | null;
}) {
    const [mod, setMod] = useState<Multiplier>(1);
    const hit = (s: number, m: Multiplier = mod) => { onDart(s, m); setMod(1); };
    const toggle = (m: Multiplier) => setMod(prev => (prev === m ? 1 : m));
    const cols = numbers.length > 10 ? 'grid-cols-5' : 'grid-cols-3';
    const modClass = mod === 2 ? 'bg-double/20 text-double' : mod === 3 ? 'bg-triple/20 text-triple' : '';

    return (
        <div className={cn('flex h-full flex-col gap-1.5', disabled && 'pointer-events-none opacity-40')}>
            <div className="grid flex-none grid-cols-2 gap-1.5">
                <Key onClick={() => toggle(2)} className={cn('min-h-[48px] [@media(max-height:700px)]:min-h-[40px] landscape:max-lg:min-h-[34px] text-base', mod === 2 && 'bg-double text-white')}>DOUBLE</Key>
                <Key onClick={() => toggle(3)} className={cn('min-h-[48px] [@media(max-height:700px)]:min-h-[40px] landscape:max-lg:min-h-[34px] text-base', mod === 3 && 'bg-triple text-white')}>TRIPLE</Key>
            </div>
            <div className={cn('grid flex-1 auto-rows-fr gap-1.5', cols)}>
                {numbers.map(n => (
                    <Key key={n} onClick={() => hit(n)} className={cn(modClass, highlight === n && 'ring-2 ring-primary ring-inset')}>
                        {mod === 2 ? <><span className="mr-px text-sm opacity-70">D</span>{n}</> : mod === 3 ? <><span className="mr-px text-sm opacity-70">T</span>{n}</> : n}
                    </Key>
                ))}
            </div>
            <div className="grid flex-none grid-cols-4 gap-1.5">
                <Key onClick={() => hit(25, 1)} className={cn('min-h-[48px] [@media(max-height:700px)]:min-h-[40px] landscape:max-lg:min-h-[34px] text-base', highlight === 25 && 'ring-2 ring-primary ring-inset')}>BULL</Key>
                <Key onClick={() => hit(25, 2)} className="min-h-[48px] [@media(max-height:700px)]:min-h-[40px] landscape:max-lg:min-h-[34px] bg-double/25 text-sm text-double">BULLSEYE</Key>
                <Key onClick={() => hit(0, 1)} className="min-h-[48px] [@media(max-height:700px)]:min-h-[40px] landscape:max-lg:min-h-[34px] text-base text-muted-foreground">MISS</Key>
                <Key onClick={onNext} className="min-h-[48px] [@media(max-height:700px)]:min-h-[40px] landscape:max-lg:min-h-[34px] gap-0.5 bg-primary text-sm text-primary-foreground active:bg-primary/80">
                    <span aria-label="Rest als Miss zählen, nächster Spieler">WEITER</span><ChevronRight className="h-5 w-5" />
                </Key>
            </div>
        </div>
    );
}

const QUICK = [26, 41, 45, 60, 81, 85, 100, 121, 140, 180];

/** Visit total input with quick scores. */
export function TotalPad({ onSubmit, onUndo, disabled, checkout }: {
    onSubmit: (score: number) => void;
    onUndo: () => void;
    disabled?: boolean;
    /** Remaining score if it can be checked out (shows a quick button) */
    checkout?: number | null;
}) {
    const [value, setValue] = useState('');
    const n = value === '' ? null : parseInt(value);
    const invalid = n !== null && n > 180;
    const type = (d: string) => setValue(v => (v === '0' ? d : (v + d).slice(0, 3)));
    const submit = (score = n) => {
        if (score === null || score > 180) return;
        onSubmit(score);
        setValue('');
    };

    return (
        <div className={cn('flex h-full flex-col gap-1.5', disabled && 'pointer-events-none opacity-40')}>
            <div className="no-scrollbar -mx-1 flex flex-none gap-1.5 overflow-x-auto px-1">
                {checkout ? (
                    <button onClick={() => { haptic(); submit(checkout); }} className="h-10 flex-none rounded-full bg-primary px-4 text-sm font-bold text-primary-foreground">
                        Check {checkout}
                    </button>
                ) : null}
                {QUICK.map(q => (
                    <button key={q} onClick={() => { haptic(); submit(q); }} className="h-10 flex-none rounded-full bg-secondary px-4 text-sm font-bold tabular-nums active:bg-accent">
                        {q}
                    </button>
                ))}
            </div>
            <div className="flex h-14 flex-none items-center gap-1.5">
                <div className={cn('flex h-full flex-1 items-center justify-center rounded-xl border-2 bg-card text-3xl font-black tabular-nums', invalid ? 'border-destructive text-destructive' : 'border-primary/40')}>
                    {value || <span className="text-muted-foreground/50">0</span>}
                </div>
                <button
                    onClick={() => { haptic(); submit(); }}
                    disabled={n === null || invalid}
                    className="h-full w-28 rounded-xl bg-primary text-lg font-bold text-primary-foreground active:scale-95 disabled:opacity-40"
                >
                    OK
                </button>
            </div>
            <div className="grid flex-1 auto-rows-fr grid-cols-3 gap-1.5">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => <Key key={d} onClick={() => type(d)} className="text-2xl">{d}</Key>)}
                <Key onClick={onUndo} className="bg-muted text-muted-foreground"><Undo2 className="h-6 w-6" /></Key>
                <Key onClick={() => type('0')} className="text-2xl">0</Key>
                <Key onClick={() => setValue(v => v.slice(0, -1))} className="bg-muted text-muted-foreground"><Delete className="h-6 w-6" /></Key>
            </div>
        </div>
    );
}
