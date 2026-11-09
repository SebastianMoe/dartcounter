import { useState } from 'react';
import { Delete } from 'lucide-react';
import { cn, haptic } from '@/lib/utils';

// Simple device lock for the privately hosted app (same PIN and storage key as before,
// so devices that were unlocked with the old version stay unlocked).
// Note: this only hides the UI – the API itself is protected by the PocketBase rules.
const PIN = '180';
const KEY = 'darts_app_authenticated';

export const isUnlocked = () => {
    try { return localStorage.getItem(KEY) === 'true'; } catch { return true; }
};

export function PinLock({ onUnlock }: { onUnlock: () => void }) {
    const [pin, setPin] = useState('');
    const [error, setError] = useState(false);

    const press = (d: string) => {
        haptic();
        setError(false);
        const next = (pin + d).slice(0, 4);
        setPin(next);
        if (next.length === PIN.length) {
            if (next === PIN) {
                localStorage.setItem(KEY, 'true');
                onUnlock();
            } else {
                haptic(120);
                setError(true);
                setTimeout(() => setPin(''), 350);
            }
        }
    };

    const key = 'flex h-16 items-center justify-center rounded-2xl bg-secondary text-2xl font-bold active:scale-95 active:bg-accent';
    return (
        <div className="pt-safe pb-safe flex h-[100dvh] flex-col items-center justify-center px-6">
            <div className="w-full max-w-xs space-y-8 text-center">
                <div>
                    <h1 className="text-2xl font-black">Darts</h1>
                    <p className="text-sm text-muted-foreground">Bitte PIN eingeben</p>
                </div>
                <div className={'flex justify-center gap-3'}>
                    {Array.from({ length: PIN.length }, (_, i) => (
                        <div key={i} className={cn(
                            'h-4 w-4 rounded-full border-2',
                            error ? 'border-destructive bg-destructive' : i < pin.length ? 'border-primary bg-primary' : 'border-muted-foreground',
                        )} />
                    ))}
                </div>
                <p className={cn('h-5 text-sm text-destructive', !error && 'invisible')}>Falsche PIN</p>
                <div className="grid grid-cols-3 gap-3">
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => (
                        <button key={d} className={key} onClick={() => press(d)}>{d}</button>
                    ))}
                    <div />
                    <button className={key} onClick={() => press('0')}>0</button>
                    <button className={cn(key, 'bg-muted text-muted-foreground')} onClick={() => setPin(p => p.slice(0, -1))} aria-label="Löschen">
                        <Delete className="h-6 w-6" />
                    </button>
                </div>
            </div>
        </div>
    );
}
