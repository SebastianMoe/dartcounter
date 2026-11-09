import { useMemo, useState } from 'react';
import { ChevronRight, Trash2 } from 'lucide-react';
import { Card, Empty, Page, Section, Segmented, Sheet } from '@/components/ui/kit';
import { Button } from '@/components/ui/button';
import { settingsLabel } from '@/components/settings-form';
import { useHistory } from '@/stores/history';
import { useProfiles } from '@/stores/profiles';
import { replay, type MatchRecord } from '@/game/engine';
import { cricketStats, mergeCricketStats, mergeRoundsStats, mergeX01Stats, roundsStats, x01Stats, type RoundsStats, type X01Stats } from '@/game/stats';
import { describeFormat, GAME_NAMES, type RoundsKind } from '@/game/types';
import { navigate, goBack } from '@/lib/router';
import { cn, fmt1, formatDate, pct } from '@/lib/utils';
import { CRICKET_METRICS, MatchStats, StatsTable, X01_METRICS, roundsMetrics } from './game/stats-table';
import { LegList } from './game/leg-list';
import { legacyStatsFor, type LegacyStats } from '@/stores/legacy-history';

export function MatchListItem({ match }: { match: MatchRecord }) {
    const state = useMemo(() => replay(match), [match]);
    const score = match.settings.sets ? state.progress.setsWon : state.progress.totalLegsWon;
    return (
        <Card onClick={() => navigate(`/match/${match.id}`)} className="flex items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">
                    {match.players.map((p, i) => (
                        <span key={i} className={cn(state.winner === i && 'text-primary')}>{i > 0 && ' – '}{p.name}</span>
                    ))}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                    {settingsLabel(match.settings)} · {formatDate(match.finishedAt ?? match.createdAt)}{match.onlineId ? ' · Online' : ''}
                </div>
            </div>
            {match.players.length > 1 && <div className="text-lg font-black tabular-nums">{score.join(':')}</div>}
            <ChevronRight className="h-5 w-5 flex-none text-muted-foreground" />
        </Card>
    );
}

interface ProfileSummary {
    id: string;
    name: string;
    matches: MatchRecord[];
    wins: number;
    x01: X01Stats | null;
    x01Matches: { match: MatchRecord; stats: X01Stats }[];
    legacy: LegacyStats | null;
}

function useProfileSummaries(): ProfileSummary[] {
    const matches = useHistory(s => s.matches);
    const profiles = useProfiles(s => s.profiles);
    return useMemo(() => profiles.map(p => {
        const mine = matches.filter(m => m.players.some(pl => pl.profileId === p.id));
        let wins = 0;
        const x01Matches: { match: MatchRecord; stats: X01Stats }[] = [];
        for (const m of mine) {
            const idx = m.players.findIndex(pl => pl.profileId === p.id);
            const st = replay(m);
            if (st.winner === idx && m.players.length > 1) wins++;
            if (st.kind === 'x01') x01Matches.push({ match: m, stats: x01Stats(st)[idx] });
        }
        const legacy = legacyStatsFor(p);
        return {
            id: p.id, name: p.name, matches: mine, wins, x01Matches, legacy,
            x01: x01Matches.length ? mergeX01Stats(x01Matches.map(x => x.stats)) : null,
        };
    }).filter(s => s.matches.length > 0 || s.legacy)
        .sort((a, b) => (b.matches.length + (b.legacy?.matches ?? 0)) - (a.matches.length + (a.legacy?.matches ?? 0))), [matches, profiles]);
}

export function StatsScreen() {
    const [tab, setTab] = useState<'players' | 'matches'>('players');
    const summaries = useProfileSummaries();
    const matches = useHistory(s => s.matches);

    return (
        <Page title="Statistik" back>
            <Segmented value={tab} onChange={setTab} className="mb-4"
                options={[{ value: 'players', label: 'Spieler' }, { value: 'matches', label: `Spiele (${matches.length})` }]} />
            {tab === 'players' ? (
                summaries.length === 0 ? <Empty>Nach dem ersten beendeten Spiel erscheinen hier die Statistiken.</Empty> : (
                    <div className="space-y-2">
                        {summaries.map(s => (
                            <Card key={s.id} onClick={() => navigate(`/stats/${s.id}`)} className="flex items-center gap-3">
                                <div className="min-w-0 flex-1">
                                    <div className="truncate text-lg font-semibold">{s.name}</div>
                                    <div className="text-xs text-muted-foreground">
                                        {s.matches.length + (s.legacy?.matches ?? 0)} Spiele · {s.wins + (s.legacy?.wins ?? 0)} Siege
                                    </div>
                                </div>
                                {(s.x01 || s.legacy?.average) && (
                                    <div className="text-right">
                                        <div className="text-2xl font-black tabular-nums text-primary">{fmt1(s.x01 ? s.x01.average : s.legacy!.average!)}</div>
                                        <div className="text-[10px] uppercase text-muted-foreground">Ø 3 Darts</div>
                                    </div>
                                )}
                                <ChevronRight className="h-5 w-5 text-muted-foreground" />
                            </Card>
                        ))}
                    </div>
                )
            ) : (
                matches.length === 0 ? <Empty>Noch keine Spiele.</Empty> : (
                    <div className="space-y-2">{matches.map(m => <MatchListItem key={m.id} match={m} />)}</div>
                )
            )}
        </Page>
    );
}

function Tile({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
    return (
        <div className="rounded-2xl border bg-card p-3">
            <div className={cn('text-2xl font-black tabular-nums', accent && 'text-primary')}>{value}</div>
            <div className="text-xs text-muted-foreground">{label}</div>
        </div>
    );
}

export function ProfileStatsScreen({ id }: { id: string }) {
    const summary = useProfileSummaries().find(s => s.id === id);
    const matches = useHistory(s => s.matches);
    const cricket = useMemo(() => {
        const list = matches.filter(m => m.settings.kind === 'cricket').flatMap(m => {
            const idx = m.players.findIndex(p => p.profileId === id);
            if (idx < 0) return [];
            const st = replay(m);
            return st.kind === 'cricket' ? [cricketStats(st)[idx]] : [];
        });
        return list.length ? mergeCricketStats(list) : null;
    }, [matches, id]);
    const rounds = useMemo(() => {
        const out: { kind: RoundsKind; games: number; stats: RoundsStats }[] = [];
        for (const kind of ['atc', 'shanghai', 'highscore'] as RoundsKind[]) {
            const list = matches.filter(m => m.settings.kind === kind).flatMap(m => {
                const idx = m.players.findIndex(p => p.profileId === id);
                if (idx < 0) return [];
                const st = replay(m);
                return st.kind === kind ? [roundsStats(st)[idx]] : [];
            });
            if (list.length) out.push({ kind, games: list.length, stats: mergeRoundsStats(list) });
        }
        return out;
    }, [matches, id]);

    if (!summary) return <Page title="Statistik" back><Empty>Keine Daten.</Empty></Page>;
    const x = summary.x01;
    const totalGames = summary.matches.length + (summary.legacy?.matches ?? 0);
    const totalWins = summary.wins + (summary.legacy?.wins ?? 0);
    const recent = summary.x01Matches.slice(0, 12).reverse();
    const maxAvg = Math.max(60, ...recent.map(r => r.stats.average));

    return (
        <Page title={summary.name} back>
            <div className="mb-6 grid grid-cols-3 gap-2">
                <Tile label="Spiele" value={totalGames} />
                <Tile label="Siege" value={totalWins} />
                <Tile label="Siegquote" value={totalGames ? `${Math.round(totalWins / totalGames * 100)} %` : '–'} />
            </div>

            {x && (
                <>
                    <Section title="X01">
                        <div className="mb-3 grid grid-cols-3 gap-2">
                            <Tile label="Ø 3 Darts" value={fmt1(x.average)} accent />
                            <Tile label="Ø First 9" value={fmt1(x.first9Average)} />
                            <Tile label="Checkout" value={pct(x.checkoutRate)} />
                            <Tile label="180er" value={x.max180} />
                            <Tile label="Höchstes Finish" value={x.highestCheckout || '–'} />
                            <Tile label="Bestes Leg" value={x.bestLeg ?? '–'} />
                        </div>
                        <StatsTable names={['Gesamt']} stats={[x]} metrics={X01_METRICS} />
                    </Section>
                    {recent.length > 1 && (
                        <Section title="Verlauf Ø (letzte Spiele)">
                            <div className="flex h-32 items-end gap-1 rounded-2xl border bg-card p-3">
                                {recent.map(r => (
                                    <div key={r.match.id} className="flex flex-1 flex-col items-center justify-end gap-1">
                                        <div className="text-[9px] tabular-nums text-muted-foreground">{Math.round(r.stats.average)}</div>
                                        <div className="w-full rounded-t bg-primary/70" style={{ height: `${Math.max(4, r.stats.average / maxAvg * 80)}px` }} />
                                    </div>
                                ))}
                            </div>
                        </Section>
                    )}
                </>
            )}
            {cricket && (
                <Section title="Cricket">
                    <StatsTable names={['Gesamt']} stats={[cricket]} metrics={CRICKET_METRICS} />
                </Section>
            )}
            {rounds.map(r => (
                <Section key={r.kind} title={`${GAME_NAMES[r.kind]} · ${r.games} ${r.games === 1 ? 'Spiel' : 'Spiele'}`}>
                    <StatsTable names={['Gesamt']} stats={[r.stats]} metrics={roundsMetrics(r.kind)} />
                </Section>
            ))}
            {summary.legacy && <LegacyBlock stats={summary.legacy} />}
            <Section title="Spiele">
                <div className="space-y-2">{summary.matches.slice(0, 30).map(m => <MatchListItem key={m.id} match={m} />)}</div>
            </Section>
        </Page>
    );
}

export function MatchDetailScreen({ id }: { id: string }) {
    const match = useHistory(s => s.matches.find(m => m.id === id));
    const remove = useHistory(s => s.remove);
    const [confirm, setConfirm] = useState(false);
    const state = useMemo(() => (match ? replay(match) : null), [match]);
    if (!match || !state) return <Page title="Spiel" back><Empty>Spiel nicht gefunden.</Empty></Page>;

    return (
        <Page
            title={settingsLabel(match.settings)}
            back
            actions={<button className="flex h-11 w-11 items-center justify-center text-muted-foreground" onClick={() => setConfirm(true)} aria-label="Löschen"><Trash2 className="h-5 w-5" /></button>}
        >
            <p className="mb-4 text-sm text-muted-foreground">{describeFormat(match.settings)} · {formatDate(match.createdAt)}</p>
            <Section title="Statistik"><MatchStats state={state} /></Section>
            <Section title="Legs"><LegList state={state} /></Section>
            <Sheet open={confirm} onClose={() => setConfirm(false)} title="Spiel löschen?">
                <p className="mb-4 text-sm text-muted-foreground">Das Spiel wird aus der Statistik entfernt.</p>
                <div className="grid grid-cols-2 gap-2 pb-2">
                    <Button variant="secondary" size="xl" onClick={() => setConfirm(false)}>Abbrechen</Button>
                    <Button variant="destructive" size="xl" onClick={() => { remove(match.id); goBack('/stats'); }}>Löschen</Button>
                </div>
            </Sheet>
        </Page>
    );
}

function LegacyBlock({ stats }: { stats: LegacyStats }) {
    const d = (iso: string) => (iso ? new Date(iso).toLocaleDateString('de-DE', { month: '2-digit', year: '2-digit' }) : '');
    const sc = stats.scores;
    return (
        <Section title={`Ältere Spiele (vorherige App-Version) · ${stats.matches}`}>
            <div className="grid grid-cols-3 gap-2">
                <Tile label="Siege" value={stats.wins} />
                <Tile label="Ø 3 Darts (X01)" value={stats.average === null ? '–' : fmt1(stats.average)} accent />
                <Tile label="Bester Ø" value={stats.bestAverage ? fmt1(stats.bestAverage) : '–'} />
                <Tile label="Ø First 9" value={stats.first9 === null ? '–' : fmt1(stats.first9)} />
                <Tile label="Höchstes Finish" value={stats.highestFinish || '–'} />
                <Tile label="180er" value={sc['180'] ?? 0} />
                <Tile label="140+" value={sc['140+'] ?? 0} />
                <Tile label="100+" value={(sc['100+'] ?? 0) + (sc['120+'] ?? 0)} />
                <Tile label="Darts" value={stats.darts} />
            </div>
            <p className="mt-2 px-1 text-xs text-muted-foreground">
                Aus der vorherigen Version übernommen{stats.firstDate ? ` (${d(stats.firstDate)} – ${d(stats.lastDate)})` : ''}. Diese Spiele enthalten keine einzelnen Würfe.
            </p>
        </Section>
    );
}
