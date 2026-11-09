import type { MatchState } from '@/game/engine';
import { cricketStats, roundsStats, x01Stats, type CricketStats, type RoundsStats, type X01Stats } from '@/game/stats';
import { fmt1, pct } from '@/lib/utils';

type Metric<T> = [label: string, value: (s: T) => string | number];

export const X01_METRICS: Metric<X01Stats>[] = [
    ['Ø 3 Darts', s => fmt1(s.average)],
    ['Ø First 9', s => fmt1(s.first9Average)],
    ['Darts', s => s.darts],
    ['Legs', s => s.legsWon],
    ['Bestes Leg', s => (s.bestLeg ?? '–')],
    ['Checkout %', s => pct(s.checkoutRate)],
    ['Checkouts', s => `${s.checkouts}/${s.checkoutAttempts || '–'}`],
    ['Höchstes Finish', s => s.highestCheckout || '–'],
    ['Höchste Aufnahme', s => s.highestVisit],
    ['180', s => s.max180],
    ['140+', s => s.plus140],
    ['100+', s => s.plus100],
    ['60+', s => s.plus60],
    ['Triple', s => (s.trackedDarts ? s.triples : '–')],
    ['Doppel', s => (s.trackedDarts ? s.doubles : '–')],
    ['Bull / Bullseye', s => (s.trackedDarts ? `${s.bulls} / ${s.bullseyes}` : '–')],
    ['Miss', s => (s.trackedDarts ? s.misses : '–')],
    ['Busts', s => s.busts],
];

export const CRICKET_METRICS: Metric<CricketStats>[] = [
    ['MPR', s => s.mpr.toFixed(2)],
    ['Marks', s => s.marks],
    ['Punkte', s => s.points],
    ['Darts', s => s.darts],
    ['Legs', s => s.legsWon],
    ['Triple', s => s.triples],
    ['Doppel', s => s.doubles],
    ['Bull / Bullseye', s => `${s.bulls} / ${s.bullseyes}`],
];

export function roundsMetrics(kind: 'atc' | 'shanghai' | 'highscore'): Metric<RoundsStats>[] {
    const hit: Metric<RoundsStats> = ['Trefferquote', s => pct(s.hitRate)];
    if (kind === 'atc') return [
        ['Darts', s => s.darts], hit, ['Legs', s => s.legsWon], ['Bestes Leg (Darts)', s => s.bestLeg ?? '–'],
        ['Felder pro Runde', s => fmt1(s.perRound)], ['Triple', s => s.triples], ['Doppel', s => s.doubles],
    ];
    const list: Metric<RoundsStats>[] = [
        ['Punkte', s => s.points], ['Ø pro Runde', s => fmt1(s.perRound)], ['Beste Runde', s => s.bestVisit],
        hit, ['Darts', s => s.darts], ['Legs', s => s.legsWon], ['Triple', s => s.triples], ['Doppel', s => s.doubles],
    ];
    if (kind === 'shanghai') list.push(['Shanghais', s => s.shanghais]);
    return list;
}

export function StatsTable<T>({ names, stats, metrics }: { names: string[]; stats: T[]; metrics: Metric<T>[] }) {
    return (
        <div className="overflow-x-auto rounded-2xl border bg-card">
            <table className="w-full text-sm tabular-nums">
                <thead>
                    <tr className="border-b">
                        <th className="sticky left-0 bg-card px-3 py-2 text-left font-medium text-muted-foreground" />
                        {names.map((n, i) => <th key={i} className="px-3 py-2 text-right font-semibold">{n}</th>)}
                    </tr>
                </thead>
                <tbody>
                    {metrics.map(([label, fn]) => (
                        <tr key={label} className="border-b last:border-0">
                            <td className="sticky left-0 whitespace-nowrap bg-card px-3 py-2 text-muted-foreground">{label}</td>
                            {stats.map((s, i) => <td key={i} className="px-3 py-2 text-right font-semibold">{fn(s)}</td>)}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export function MatchStats({ state }: { state: MatchState }) {
    const names = state.players.map(p => p.name);
    if (state.kind === 'x01') return <StatsTable names={names} stats={x01Stats(state)} metrics={X01_METRICS} />;
    if (state.kind === 'cricket') {
        const metrics = state.settings.cricketMode === 'cutthroat'
            ? CRICKET_METRICS.map(([l, f]) => (l === 'Punkte' ? ['Punkte verteilt', f] as typeof CRICKET_METRICS[number] : [l, f] as typeof CRICKET_METRICS[number]))
            : CRICKET_METRICS;
        return <StatsTable names={names} stats={cricketStats(state)} metrics={metrics} />;
    }
    return <StatsTable names={names} stats={roundsStats(state)} metrics={roundsMetrics(state.kind)} />;
}
