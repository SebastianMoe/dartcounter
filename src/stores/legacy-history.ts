// Games saved by the previous app version (localStorage "darts-history-storage").
// They only contain per-player summaries, not individual darts, so they can't be
// replayed – they are shown as an extra block in the player statistics instead.

interface LegacyPlayer {
    playerId: string;
    onlineId?: string;
    playerName: string;
    average: number;
    first9Avg: number;
    dartsThrown: number;
    checkoutRate: number;
    highFinish: number;
    scores: Record<string, number>;
}

interface LegacyMatch {
    id: string;
    timestamp: string;
    matchType: 'X01' | 'Cricket' | 'Clock';
    winnerId: string;
    players: LegacyPlayer[];
}

export interface LegacyStats {
    matches: number;
    wins: number;
    x01Matches: number;
    average: number | null;
    bestAverage: number;
    first9: number | null;
    darts: number;
    highestFinish: number;
    scores: Record<string, number>;
    firstDate: string;
    lastDate: string;
}

let cache: LegacyMatch[] | null = null;

function load(): LegacyMatch[] {
    if (cache) return cache;
    try {
        const raw = localStorage.getItem('darts-history-storage');
        const list = raw ? (JSON.parse(raw)?.state?.matchHistory as LegacyMatch[] | undefined) : undefined;
        cache = Array.isArray(list) ? list.filter(m => m && Array.isArray(m.players)) : [];
    } catch {
        cache = [];
    }
    return cache;
}

export const hasLegacyHistory = () => load().length > 0;
export const legacyMatchCount = () => load().length;

const same = (a?: string, b?: string) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

/** Aggregated old games of a player (matched by old profile id or by name). */
export function legacyStatsFor(profile: { id: string; name: string }): LegacyStats | null {
    const mine = load().flatMap(m => {
        const p = m.players.find(x => x.playerId === profile.id || same(x.playerName, profile.name));
        return p ? [{ m, p }] : [];
    });
    if (mine.length === 0) return null;

    const x01 = mine.filter(({ m }) => m.matchType === 'X01' && m.players.length > 0);
    const scores: Record<string, number> = {};
    let darts = 0, highestFinish = 0, bestAverage = 0, wins = 0, avgSum = 0, f9Sum = 0, f9n = 0;
    for (const { m, p } of mine) {
        if (m.winnerId === p.playerId && m.players.length > 1) wins++;
        darts += p.dartsThrown || 0;
        highestFinish = Math.max(highestFinish, p.highFinish || 0);
        for (const [k, v] of Object.entries(p.scores ?? {})) scores[k] = (scores[k] ?? 0) + (v || 0);
    }
    for (const { p } of x01) {
        avgSum += p.average || 0;
        bestAverage = Math.max(bestAverage, p.average || 0);
        if (p.first9Avg) { f9Sum += p.first9Avg; f9n++; }
    }
    const dates = mine.map(({ m }) => m.timestamp).filter(Boolean).sort();
    return {
        matches: mine.length,
        wins,
        x01Matches: x01.length,
        average: x01.length ? avgSum / x01.length : null,
        bestAverage,
        first9: f9n ? f9Sum / f9n : null,
        darts,
        highestFinish,
        scores,
        firstDate: dates[0] ?? '',
        lastDate: dates[dates.length - 1] ?? '',
    };
}
