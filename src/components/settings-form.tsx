import { Row, Segmented, Stepper } from '@/components/ui/kit';
import type { GameKind, InRule, MatchSettings, OutRule } from '@/game/types';
import { GAME_NAMES, legsToWin, setsToWin } from '@/game/types';
import { useState } from 'react';
import { cn, haptic } from '@/lib/utils';

const GAMES: { kind: GameKind; hint: string }[] = [
    { kind: 'x01', hint: '301 · 501 · 701' },
    { kind: 'cricket', hint: '15–20 & Bull' },
    { kind: 'atc', hint: '1 bis 20, dann Bull' },
    { kind: 'shanghai', hint: 'Runde = Zahl' },
    { kind: 'highscore', hint: 'Meiste Punkte' },
];

const START_SCORES = [301, 501, 701];

/** Match settings editor, shared by local setup and online invitations. */
export function SettingsForm({ value, onChange }: { value: MatchSettings; onChange: (s: MatchSettings) => void }) {
    const set = (p: Partial<MatchSettings>) => onChange({ ...value, ...p });
    const isCustom = !START_SCORES.includes(value.startScore);
    const [custom, setCustom] = useState(isCustom ? String(value.startScore) : '');

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
                {GAMES.map(g => (
                    <button
                        key={g.kind}
                        onClick={() => {
                            haptic();
                            set({
                                kind: g.kind,
                                rounds: g.kind === 'shanghai' ? (value.rounds === 20 ? 20 : 7) : g.kind === 'highscore' ? (value.rounds ?? 10) : value.rounds,
                                cricketMode: g.kind === 'cricket' ? (value.cricketMode ?? 'cutthroat') : value.cricketMode,
                            });
                        }}
                        className={cn(
                            'rounded-2xl border px-3 py-3 text-left transition-colors',
                            g.kind === 'x01' && 'col-span-2',
                            value.kind === g.kind ? 'border-primary bg-primary/15' : 'bg-card active:bg-accent',
                        )}
                    >
                        <div className={cn('font-bold', value.kind === g.kind && 'text-primary')}>{GAME_NAMES[g.kind]}</div>
                        <div className="text-xs text-muted-foreground">{g.hint}</div>
                    </button>
                ))}
            </div>

            {value.kind === 'cricket' && (
                <div className="space-y-2 rounded-2xl border bg-card p-3">
                    <Segmented value={value.cricketMode === 'standard' ? 'standard' : 'cutthroat'}
                        onChange={cricketMode => set({ cricketMode })}
                        options={[{ value: 'cutthroat', label: 'Cut-Throat' }, { value: 'standard', label: 'Klassisch' }]} />
                    <p className="px-1 text-xs text-muted-foreground">
                        {value.cricketMode === 'standard'
                            ? 'Treffer auf deine geschlossenen Felder bringen dir Punkte – die meisten Punkte gewinnen.'
                            : 'Treffer auf deine geschlossenen Felder geben allen Gegnern Punkte, die das Feld noch offen haben – die wenigsten Punkte gewinnen.'}
                    </p>
                </div>
            )}

            {value.kind === 'atc' && (
                <div className="rounded-2xl border bg-card px-3">
                    <Row label="Doppel/Triple springen" hint="D = 2 Felder weiter, T = 3 Felder weiter">
                        <Segmented value={value.atcSkip ? 'skip' : 'single'} className="w-40"
                            onChange={v => set({ atcSkip: v === 'skip' })}
                            options={[{ value: 'single', label: 'Nein' }, { value: 'skip', label: 'Ja' }]} />
                    </Row>
                </div>
            )}

            {value.kind === 'shanghai' && (
                <div className="rounded-2xl border bg-card px-3">
                    <Row label="Runden" hint={value.rounds === 20 ? 'Zahlen 1 bis 20' : 'Zahlen 1 bis 7'}>
                        <Segmented value={value.rounds === 20 ? 20 : 7} className="w-40"
                            onChange={rounds => set({ rounds })}
                            options={[{ value: 7, label: '7' }, { value: 20, label: '20' }]} />
                    </Row>
                </div>
            )}

            {value.kind === 'highscore' && (
                <div className="rounded-2xl border bg-card px-3">
                    <Row label="Runden" hint="Je 3 Darts">
                        <Stepper value={value.rounds ?? 10} min={1} max={30} onChange={rounds => set({ rounds })} />
                    </Row>
                </div>
            )}

            {value.kind === 'x01' && (
                <div className="space-y-3 rounded-2xl border bg-card p-3">
                    <Segmented
                        value={isCustom ? -1 : value.startScore}
                        onChange={v => {
                            if (v === -1) set({ startScore: parseInt(custom) > 1 ? parseInt(custom) : 1001 });
                            else set({ startScore: v });
                        }}
                        options={[...START_SCORES.map(s => ({ value: s, label: String(s) })), { value: -1, label: 'Eigene' }]}
                    />
                    {isCustom && (
                        <input
                            inputMode="numeric"
                            className="h-12 w-full rounded-xl border bg-background px-4 text-xl font-bold outline-none focus:border-primary"
                            value={custom || value.startScore}
                            onChange={e => {
                                const v = e.target.value.replace(/\D/g, '').slice(0, 4);
                                setCustom(v);
                                const n = parseInt(v);
                                if (n >= 2) set({ startScore: n });
                            }}
                        />
                    )}
                    <div className="grid grid-cols-[3rem_1fr] items-center gap-2">
                        <span className="text-sm text-muted-foreground">In</span>
                        <Segmented<InRule> value={value.inRule} onChange={inRule => set({ inRule })}
                            options={[{ value: 'straight', label: 'Single' }, { value: 'double', label: 'Double' }]} />
                        <span className="text-sm text-muted-foreground">Out</span>
                        <Segmented<OutRule> value={value.outRule} onChange={outRule => set({ outRule })}
                            options={[{ value: 'double', label: 'Double' }, { value: 'straight', label: 'Single' }, { value: 'master', label: 'Master' }]} />
                    </div>
                </div>
            )}

            <div className="rounded-2xl border bg-card px-3">
                <Row label="Modus">
                    <Segmented value={value.format} onChange={format => set({ format })} className="w-48"
                        options={[{ value: 'firstTo', label: 'First to' }, { value: 'bestOf', label: 'Best of' }]} />
                </Row>
                <Row label="Legs" hint={value.sets ? `${legsToWin(value)} Legs gewinnen einen Satz` : `${legsToWin(value)} zum Sieg`}>
                    <Stepper value={value.legs} min={1} max={21} onChange={legs => set({ legs })} />
                </Row>
                <Row label="Sätze" hint={value.sets ? `${setsToWin(value)} Sätze zum Sieg` : 'Aus – nur Legs'}>
                    <Stepper value={value.sets} min={0} max={13} onChange={sets => set({ sets })} format={v => (v === 0 ? 'Aus' : v)} />
                </Row>
            </div>
        </div>
    );
}

export function settingsLabel(s: MatchSettings): string {
    if (s.kind === 'cricket') return s.cricketMode === 'cutthroat' ? 'Cricket Cut-Throat' : 'Cricket';
    if (s.kind === 'atc') return s.atcSkip ? 'Around the Clock (D/T)' : 'Around the Clock';
    if (s.kind === 'shanghai') return `Shanghai ${s.rounds === 20 ? 20 : 7}`;
    if (s.kind === 'highscore') return `Highscore ${s.rounds ?? 10}`;
    const rules = [s.inRule === 'double' ? 'DI' : null, s.outRule === 'double' ? 'DO' : s.outRule === 'master' ? 'MO' : 'SO'].filter(Boolean).join('/');
    return `${s.startScore} ${rules}`;
}
