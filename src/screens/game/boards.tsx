import { useEffect, useMemo, useRef } from 'react';
import type { X01State } from '@/game/x01';
import { liveRemaining } from '@/game/x01';
import { CRICKET_NUMBERS, isClosedByAll, isCutThroat, type CricketState } from '@/game/cricket';
import { cricketStats, roundsStats, x01Stats } from '@/game/stats';
import { ATC_DONE, roundsTarget, totalRounds, type RoundsState } from '@/game/rounds';
import { dartsInLeg } from '@/game/engine';
import { suggestCheckout, formatCheckout } from '@/game/checkout';
import { dartLabel, dartValue, type Dart } from '@/game/types';
import { cn, fmt1, haptic } from '@/lib/utils';
import { Undo2 } from 'lucide-react';
import { PlayerCards } from './player-cards';

function LegsBadge({ sets, legs, showSets }: { sets: number; legs: number; showSets: boolean }) {
    return (
        <div className="flex gap-1 text-xs font-bold tabular-nums">
            {showSets && <span className="rounded-md bg-muted px-1.5 py-0.5">S {sets}</span>}
            <span className="rounded-md bg-muted px-1.5 py-0.5">L {legs}</span>
        </div>
    );
}

export function X01Board({ state }: { state: X01State }) {
    const stats = useMemo(() => x01Stats(state), [state]);
    const leg = state.legs[state.legs.length - 1];
    const showSets = state.settings.sets > 0;

    const lastVisit = (p: number) => {
        for (let i = leg.visits.length - 1; i >= 0; i--) if (leg.visits[i].player === p) return leg.visits[i];
        return null;
    };

    const card = (i: number) => {
        const pl = state.players[i];
        const active = i === state.current && state.winner === null;
        const rest = liveRemaining(state, i);
        const lv = lastVisit(i);
        const co = active && rest <= 170 ? suggestCheckout(rest, 3 - state.pending.length, state.settings.outRule) : null;
        const lastLabel = lv ? (lv.bust ? 'BUST' : String(lv.score)) : '–';
        return (
            <div className={cn('relative flex flex-col items-center rounded-2xl border px-2 pb-2 pt-2 transition-colors', active ? 'border-primary bg-primary/10' : 'bg-card')}>
                <div className="flex w-full items-center justify-between">
                    <LegsBadge sets={state.progress.setsWon[i]} legs={state.progress.legsWon[i]} showSets={showSets} />
                    {leg.starter === i && <span className="h-2 w-2 rounded-full bg-primary" title="Anwurf" />}
                </div>
                <div className="mt-1 w-full truncate text-center font-semibold">{pl.name}</div>
                <div className={cn('text-[clamp(2.75rem,15vw,5rem)] font-black leading-none tabular-nums', active ? 'text-primary' : 'text-foreground/80')}>{rest}</div>
                <div className="mt-1 h-5 w-full truncate text-center text-xs font-semibold text-primary">{co ? formatCheckout(co) : ''}</div>
                <div className="mt-1 grid w-full grid-cols-3 text-center text-[11px] text-muted-foreground tabular-nums">
                    <div><div className="font-bold text-foreground">{fmt1(stats[i].average)}</div>Ø</div>
                    <div><div className={cn('font-bold text-foreground', lv?.bust && 'text-destructive')}>{lastLabel}</div>Letzte</div>
                    <div><div className="font-bold text-foreground">{dartsInLeg(state, i)}</div>Darts</div>
                </div>
            </div>
        );
    };

    return (
        <PlayerCards
            count={state.players.length}
            current={state.current}
            renderCard={card}
            strip={i => ({ name: state.players[i].name, value: liveRemaining(state, i), active: i === state.current })}
        />
    );
}

/** Three dart slots of the visit in progress plus total and checkout hint. */
export function VisitStrip({ darts, total, hint, onUndo, undoDisabled }: {
    darts: Dart[]; total: number; hint?: string | null;
    onUndo?: () => void; undoDisabled?: boolean;
}) {
    // Same 4-column grid as the bottom key row, so the undo button lines up with "Weiter" below it
    return (
        <div className="grid grid-cols-4 gap-1.5">
          <div className={cn('flex items-center gap-1.5', onUndo ? 'col-span-3' : 'col-span-4')}>
            {[0, 1, 2].map(i => {
                const d = darts[i];
                return (
                    <div key={i} className={cn(
                        'flex h-11 flex-1 items-center justify-center rounded-xl border-2 text-lg font-bold tabular-nums',
                        d ? (d.m === 3 ? 'border-triple/60 text-triple' : d.m === 2 ? 'border-double/60 text-double' : 'border-border') : i === darts.length ? 'border-primary/60 border-dashed' : 'border-border/50',
                    )}>
                        {d ? dartLabel(d) : ''}
                    </div>
                );
            })}
            <div className="w-12 flex-none text-right">
                <div className="text-2xl font-black tabular-nums leading-none">{total}</div>
                {hint && <div className="truncate text-[10px] text-muted-foreground">{hint}</div>}
            </div>
          </div>
            {onUndo && (
                <button
                    onClick={() => { haptic(); onUndo(); }}
                    disabled={undoDisabled}
                    aria-label="Rückgängig"
                    title="Rückgängig"
                    className="flex h-11 items-center justify-center rounded-xl bg-muted text-muted-foreground transition-transform active:scale-95 active:bg-accent disabled:opacity-40"
                >
                    <Undo2 className="h-6 w-6" />
                </button>
            )}
        </div>
    );
}

export const pendingTotal = (darts: Dart[]) => darts.reduce((s, d) => s + dartValue(d), 0);

const markSymbol = (m: number) => (m >= 3 ? '⊗' : m === 2 ? '✕' : m === 1 ? '╱' : '');

export function CricketBoard({ state }: { state: CricketState }) {
    const stats = useMemo(() => cricketStats(state), [state]);
    const showSets = state.settings.sets > 0;
    const cols = `3rem repeat(${state.players.length}, minmax(4.5rem, 1fr))`;
    const scroller = useRef<HTMLDivElement>(null);

    // Keep the active player's column visible when there are many players
    useEffect(() => {
        const el = scroller.current?.querySelector<HTMLElement>(`[data-player="${state.current}"]`);
        el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }, [state.current]);

    const cutThroat = isCutThroat(state.settings);
    const best = cutThroat ? Math.min(...state.points) : Math.max(...state.points);

    return (
        <div ref={scroller} className="no-scrollbar overflow-x-auto">
            {cutThroat && (
                <div className="mb-1 text-center text-[11px] text-muted-foreground">Cut-Throat · wenigste Punkte gewinnen</div>
            )}
            <div className="grid gap-1" style={{ gridTemplateColumns: cols }}>
                <div />
                {state.players.map((p, i) => {
                    const active = i === state.current && state.winner === null;
                    return (
                        <div key={p.id} data-player={i} className={cn('rounded-xl border px-1 py-1.5 text-center', active ? 'border-primary bg-primary/10' : 'bg-card')}>
                            <div className="truncate text-sm font-semibold">{p.name}</div>
                            <div className={cn('text-3xl font-black tabular-nums leading-tight', active && 'text-primary')}>
                                {state.points[i]}
                                {state.players.length > 1 && state.points[i] === best && state.points.some(x => x !== best) && <span className="ml-0.5 align-top text-xs">★</span>}
                            </div>
                            <div className="truncate whitespace-nowrap text-[10px] text-muted-foreground tabular-nums">
                                {showSets && `S${state.progress.setsWon[i]} · `}L{state.progress.legsWon[i]} · MPR {stats[i].mpr.toFixed(1)}
                            </div>
                        </div>
                    );
                })}
                {CRICKET_NUMBERS.map(n => {
                    const dead = isClosedByAll(state, n);
                    return [
                        <div key={`l${n}`} className={cn('flex items-center justify-center rounded-lg bg-muted text-lg font-black', dead && 'opacity-30 line-through')}>
                            {n === 25 ? 'B' : n}
                        </div>,
                        ...state.players.map((p, i) => (
                            <div key={`${n}-${p.id}`} className={cn(
                                'flex h-8 items-center justify-center rounded-lg text-xl font-black',
                                state.marks[i][n] >= 3 ? 'bg-primary/15 text-primary' : 'bg-card text-foreground',
                                dead && 'opacity-30',
                            )}>
                                {markSymbol(state.marks[i][n])}
                            </div>
                        )),
                    ];
                })}
            </div>
        </div>
    );
}

/** Around the Clock / Shanghai / Highscore */
export function RoundsBoard({ state }: { state: RoundsState }) {
    const stats = useMemo(() => roundsStats(state), [state]);
    const showSets = state.settings.sets > 0;
    const isAtc = state.kind === 'atc';
    const shanghaiTarget = state.kind === 'shanghai' ? roundsTarget(state) : null;
    const total = totalRounds(state.settings);
    const valueOf = (i: number) => {
        const target = roundsTarget(state, i);
        return isAtc ? (target === 25 ? 'Bull' : target ?? '✓') : state.scores[i];
    };

    const card = (i: number) => {
        const pl = state.players[i];
        const active = i === state.current && state.winner === null;
        const hitRate = stats[i].hitRate;
        const sub = isAtc
            ? `${state.scores[i]}/${ATC_DONE} · ${dartsInLeg(state, i)} Darts`
            : `Ø ${fmt1(stats[i].perRound)} · Treffer ${hitRate === null ? '–' : Math.round(hitRate * 100) + ' %'}`;
        return (
            <div className={cn('relative flex flex-col items-center overflow-hidden rounded-2xl border px-3 py-2', active ? 'border-primary bg-primary/10' : 'bg-card')}>
                {isAtc && (
                    <div className="absolute inset-x-0 bottom-0 h-1 bg-muted">
                        <div className="h-full bg-primary transition-all" style={{ width: `${(state.scores[i] / ATC_DONE) * 100}%` }} />
                    </div>
                )}
                <div className="flex w-full items-center justify-between">
                    <LegsBadge sets={state.progress.setsWon[i]} legs={state.progress.legsWon[i]} showSets={showSets} />
                    {state.legs[state.legs.length - 1].starter === i && <span className="h-2 w-2 rounded-full bg-primary" title="Anwurf" />}
                </div>
                <div className="mt-1 w-full truncate text-center font-semibold">{pl.name}</div>
                {isAtc && <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Ziel</div>}
                <div className={cn('text-[clamp(2.75rem,15vw,4.5rem)] font-black leading-none tabular-nums', active ? 'text-primary' : 'text-foreground/80')}>
                    {valueOf(i)}
                </div>
                <div className="mb-1 mt-1 w-full truncate text-center text-[11px] text-muted-foreground tabular-nums">{sub}</div>
            </div>
        );
    };

    return (
        <div className="space-y-2">
            {!isAtc && (
                <div className="flex items-center justify-between rounded-xl bg-muted px-3 py-1.5 text-sm">
                    <span className="text-muted-foreground">
                        Runde <b className="text-foreground">{state.round}</b>{state.round <= total ? ` / ${total}` : ' · Stechen'}
                    </span>
                    {shanghaiTarget !== null && (
                        <span className="font-semibold">Ziel: <span className="text-primary">{shanghaiTarget === 25 ? 'Bull' : shanghaiTarget}</span></span>
                    )}
                </div>
            )}
            <PlayerCards
                count={state.players.length}
                current={state.current}
                renderCard={card}
                strip={i => ({ name: state.players[i].name, value: valueOf(i), active: i === state.current })}
            />
        </div>
    );
}
