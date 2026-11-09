import type { MatchState } from '@/game/engine';
import { dartLabel } from '@/game/types';
import { cn } from '@/lib/utils';

/** Per-leg overview: winner, darts and every visit. */
export function LegList({ state }: { state: MatchState }) {
    const legs = state.legs.filter(l => l.visits.length > 0);
    return (
        <div className="space-y-2">
            {legs.map((leg, li) => {
                const winner = leg.winner !== null ? state.players[leg.winner].name : 'offen';
                return (
                    <details key={li} className="group rounded-2xl border bg-card">
                        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3">
                            <span className="font-semibold">Leg {li + 1}</span>
                            <span className="text-sm text-muted-foreground">{winner}</span>
                        </summary>
                        <div className="space-y-1 border-t px-4 py-2 text-sm">
                            {leg.visits.map((v, vi) => (
                                <div key={vi} className="flex items-center gap-2 tabular-nums">
                                    <span className="w-24 truncate text-muted-foreground">{state.players[v.player].name}</span>
                                    <span className="flex-1 truncate text-xs text-muted-foreground">
                                        {v.darts ? v.darts.map(dartLabel).join(' · ') : 'Summe'}
                                    </span>
                                    {'bust' in v ? (
                                        <span className={cn('w-12 text-right font-bold', v.bust && 'text-destructive', v.checkout && 'text-primary')}>
                                            {v.bust ? 'Bust' : v.score}
                                        </span>
                                    ) : 'marks' in v ? (
                                        <span className="w-12 text-right font-bold">{v.marks} M</span>
                                    ) : (
                                        <span className={cn('w-12 text-right font-bold', v.shanghai && 'text-primary')}>{v.shanghai ? 'Sh!' : v.points}</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </details>
                );
            })}
        </div>
    );
}
