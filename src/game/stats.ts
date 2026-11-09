import type { X01State, X01Visit } from './x01';
import type { CricketState } from './cricket';
import type { RoundsState } from './rounds';
import { dartValue } from './types';

export interface X01Stats {
    darts: number;
    points: number;
    average: number; // 3-dart average
    first9Darts: number;
    first9Points: number;
    first9Average: number;
    visits: number;
    singles: number;
    doubles: number;
    triples: number;
    bulls: number; // outer bull (25)
    bullseyes: number; // inner bull (50)
    misses: number;
    /** Darts entered individually (doubles/triples are only known for those) */
    trackedDarts: number;
    plus60: number;
    plus100: number;
    plus140: number;
    max180: number;
    highestVisit: number;
    busts: number;
    checkouts: number;
    checkoutAttempts: number;
    checkoutRate: number | null;
    highestCheckout: number;
    legsWon: number;
    bestLeg: number | null; // fewest darts for a won leg
}

export function emptyX01Stats(): X01Stats {
    return {
        darts: 0, points: 0, average: 0, first9Darts: 0, first9Points: 0, first9Average: 0, visits: 0,
        singles: 0, doubles: 0, triples: 0, bulls: 0, bullseyes: 0, misses: 0, trackedDarts: 0,
        plus60: 0, plus100: 0, plus140: 0, max180: 0, highestVisit: 0, busts: 0,
        checkouts: 0, checkoutAttempts: 0, checkoutRate: null, highestCheckout: 0, legsWon: 0, bestLeg: null,
    };
}

function addVisit(st: X01Stats, v: X01Visit, visitIndexInLeg: number) {
    st.visits++;
    st.darts += v.dartsUsed;
    st.points += v.score;
    if (visitIndexInLeg < 3) {
        st.first9Darts += v.dartsUsed;
        st.first9Points += v.score;
    }
    if (v.bust) st.busts++;
    const s = v.score;
    if (s >= 180) st.max180++;
    else if (s >= 140) st.plus140++;
    else if (s >= 100) st.plus100++;
    else if (s >= 60) st.plus60++;
    st.highestVisit = Math.max(st.highestVisit, s);
    if (v.atDouble !== null) st.checkoutAttempts += v.atDouble;
    if (v.checkout) {
        st.checkouts++;
        st.highestCheckout = Math.max(st.highestCheckout, v.startScore);
    }
    if (v.darts) {
        for (const d of v.darts) {
            st.trackedDarts++;
            if (d.s === 0) st.misses++;
            else if (d.s === 25 && d.m === 2) st.bullseyes++;
            else if (d.s === 25) st.bulls++;
            else if (d.m === 3) st.triples++;
            else if (d.m === 2) st.doubles++;
            else st.singles++;
        }
    }
}

export function finalizeX01(st: X01Stats): X01Stats {
    st.average = st.darts ? (st.points / st.darts) * 3 : 0;
    st.first9Average = st.first9Darts ? (st.first9Points / st.first9Darts) * 3 : 0;
    st.checkoutRate = st.checkoutAttempts > 0 ? st.checkouts / st.checkoutAttempts : null;
    return st;
}

/** Stats per player for the whole match (or one leg when legIndex is set). */
export function x01Stats(state: X01State, legIndex?: number): X01Stats[] {
    const stats = state.players.map(emptyX01Stats);
    const legs = legIndex === undefined ? state.legs : [state.legs[legIndex]];
    for (const leg of legs) {
        const perPlayerVisit = state.players.map(() => 0);
        const dartsInLeg = state.players.map(() => 0);
        for (const v of leg.visits) {
            addVisit(stats[v.player], v, perPlayerVisit[v.player]++);
            dartsInLeg[v.player] += v.dartsUsed;
        }
        if (leg.winner !== null) {
            const st = stats[leg.winner];
            st.legsWon++;
            const d = dartsInLeg[leg.winner];
            st.bestLeg = st.bestLeg === null ? d : Math.min(st.bestLeg, d);
        }
    }
    return stats.map(finalizeX01);
}

/** Merges stats of several matches (for the statistics screen). */
export function mergeX01Stats(list: X01Stats[]): X01Stats {
    const out = emptyX01Stats();
    for (const s of list) {
        for (const k of Object.keys(out) as (keyof X01Stats)[]) {
            if (k === 'highestVisit' || k === 'highestCheckout') out[k] = Math.max(out[k], s[k]);
            else if (k === 'bestLeg') out.bestLeg = s.bestLeg === null ? out.bestLeg : out.bestLeg === null ? s.bestLeg : Math.min(out.bestLeg, s.bestLeg);
            else if (k === 'average' || k === 'first9Average' || k === 'checkoutRate') continue;
            else (out[k] as number) += s[k] as number;
        }
    }
    return finalizeX01(out);
}

export interface CricketStats {
    darts: number;
    marks: number;
    mpr: number; // marks per round (3 darts)
    points: number;
    triples: number;
    doubles: number;
    bulls: number;
    bullseyes: number;
    legsWon: number;
}

export function emptyCricketStats(): CricketStats {
    return { darts: 0, marks: 0, mpr: 0, points: 0, triples: 0, doubles: 0, bulls: 0, bullseyes: 0, legsWon: 0 };
}

export function cricketStats(state: CricketState): CricketStats[] {
    const stats = state.players.map(emptyCricketStats);
    for (const leg of state.legs) {
        for (const v of leg.visits) {
            const st = stats[v.player];
            st.darts += v.darts.length;
            st.marks += v.marks;
            st.points += v.points;
            for (const d of v.darts) {
                if (d.s === 25 && d.m === 2) st.bullseyes++;
                else if (d.s === 25) st.bulls++;
                else if (d.m === 3) st.triples++;
                else if (d.m === 2) st.doubles++;
            }
        }
        if (leg.winner !== null) stats[leg.winner].legsWon++;
    }
    for (const st of stats) st.mpr = st.darts ? (st.marks / st.darts) * 3 : 0;
    return stats;
}

export function mergeCricketStats(list: CricketStats[]): CricketStats {
    const out = emptyCricketStats();
    for (const s of list) {
        for (const k of Object.keys(out) as (keyof CricketStats)[]) if (k !== 'mpr') out[k] += s[k];
    }
    out.mpr = out.darts ? (out.marks / out.darts) * 3 : 0;
    return out;
}

export const visitTotal = (v: X01Visit) => (v.darts ? v.darts.reduce((s, d) => s + dartValue(d), 0) : v.rawScore);

export interface RoundsStats {
    darts: number;
    points: number;
    hits: number;
    hitRate: number | null;
    perRound: number; // points per visit
    bestVisit: number;
    doubles: number;
    triples: number;
    shanghais: number;
    legsWon: number;
    /** Around the Clock: fewest darts for a won leg */
    bestLeg: number | null;
}

export function emptyRoundsStats(): RoundsStats {
    return { darts: 0, points: 0, hits: 0, hitRate: null, perRound: 0, bestVisit: 0, doubles: 0, triples: 0, shanghais: 0, legsWon: 0, bestLeg: null };
}

function finalizeRounds(st: RoundsStats, visits: number): RoundsStats {
    st.hitRate = st.darts ? st.hits / st.darts : null;
    st.perRound = visits ? st.points / visits : 0;
    return st;
}

export function roundsStats(state: RoundsState): RoundsStats[] {
    const stats = state.players.map(emptyRoundsStats);
    const visits = state.players.map(() => 0);
    for (const leg of state.legs) {
        const legDarts = state.players.map(() => 0);
        for (const v of leg.visits) {
            const st = stats[v.player];
            visits[v.player]++;
            st.darts += v.darts.length;
            legDarts[v.player] += v.darts.length;
            st.points += v.points;
            st.hits += v.hits;
            st.bestVisit = Math.max(st.bestVisit, v.points);
            if (v.shanghai) st.shanghais++;
            for (const d of v.darts) {
                if (d.s === 0 || d.s === 25) continue;
                if (d.m === 3) st.triples++;
                else if (d.m === 2) st.doubles++;
            }
        }
        if (leg.winner !== null) {
            const st = stats[leg.winner];
            st.legsWon++;
            const n = legDarts[leg.winner];
            st.bestLeg = st.bestLeg === null ? n : Math.min(st.bestLeg, n);
        }
    }
    return stats.map((st, i) => finalizeRounds(st, visits[i]));
}

export function mergeRoundsStats(list: RoundsStats[]): RoundsStats {
    const out = emptyRoundsStats();
    let visits = 0;
    for (const s of list) {
        out.darts += s.darts; out.points += s.points; out.hits += s.hits;
        out.doubles += s.doubles; out.triples += s.triples; out.shanghais += s.shanghais; out.legsWon += s.legsWon;
        out.bestVisit = Math.max(out.bestVisit, s.bestVisit);
        if (s.bestLeg !== null) out.bestLeg = out.bestLeg === null ? s.bestLeg : Math.min(out.bestLeg, s.bestLeg);
        visits += s.perRound ? s.points / s.perRound : 0;
    }
    return finalizeRounds(out, Math.round(visits));
}
