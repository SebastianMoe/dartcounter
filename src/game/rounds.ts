import {
    dartValue, effectiveEvents, isValidDart,
    type Dart, type GameEvent, type MatchPlayer, type MatchSettings, type RoundsKind,
} from './types';
import { applyLegWin, initProgress, legStarter, type MatchProgress } from './match';

// Round based games that only use single darts:
//  - Around the Clock: hit 1..20, then Bull, in order. First to finish wins.
//  - Shanghai: round n only scores on number n. S+D+T of n in one visit wins instantly.
//  - Highscore: most points after N rounds.
// Shanghai/Highscore ties after the last round are decided by extra rounds.

export const ATC_SEQUENCE = [...Array.from({ length: 20 }, (_, i) => i + 1), 25];
export const ATC_DONE = ATC_SEQUENCE.length;

export interface RoundsVisit {
    player: number;
    darts: Dart[];
    points: number;
    hits: number;
    round: number;
    shanghai: boolean;
}

export interface RoundsLeg {
    starter: number;
    visits: RoundsVisit[];
    winner: number | null;
}

export interface RoundsState {
    kind: RoundsKind;
    settings: MatchSettings;
    players: MatchPlayer[];
    legs: RoundsLeg[];
    progress: MatchProgress;
    /** ATC: index of the next target in ATC_SEQUENCE; otherwise points */
    scores: number[];
    /** 1-based round of the current leg */
    round: number;
    current: number;
    pending: Dart[];
    pendingPoints: number;
    pendingHits: number;
    winner: number | null;
    rejected: number;
}

export const totalRounds = (s: MatchSettings) => s.rounds ?? (s.kind === 'shanghai' ? 7 : 10);

/** Target number of the current round (Shanghai) or of a player (ATC); null = any. */
export function roundsTarget(state: RoundsState, player = state.current): number | null {
    if (state.kind === 'atc') return ATC_SEQUENCE[state.scores[player]] ?? null;
    if (state.kind === 'shanghai') return state.round <= 20 ? state.round : 25;
    return null;
}

export function initRounds(settings: MatchSettings, players: MatchPlayer[]): RoundsState {
    return {
        kind: settings.kind as RoundsKind,
        settings,
        players,
        legs: [{ starter: 0, visits: [], winner: null }],
        progress: initProgress(players.length),
        scores: players.map(() => 0),
        round: 1,
        current: 0,
        pending: [],
        pendingPoints: 0,
        pendingHits: 0,
        winner: null,
        rejected: 0,
    };
}

function isShanghai(darts: Dart[], target: number | null): boolean {
    if (darts.length !== 3 || target === null || target === 25) return false;
    const ms = new Set(darts.filter(d => d.s === target).map(d => d.m));
    return ms.has(1) && ms.has(2) && ms.has(3);
}

export function applyRoundsDart(prev: RoundsState, dart: Dart): RoundsState | null {
    if (prev.winner !== null) return null;
    const d: Dart = { s: dart.s, m: dart.s === 0 ? 1 : dart.m };
    if (!isValidDart(d)) return null;

    const s: RoundsState = {
        ...prev,
        legs: prev.legs.map((l, i) => (i === prev.legs.length - 1 ? { ...l, visits: [...l.visits] } : l)),
        scores: [...prev.scores],
        pending: [...prev.pending, d],
    };
    const p = s.current;
    const target = roundsTarget(prev, p);
    let points = 0;
    let hit = false;

    if (s.kind === 'atc') {
        if (target !== null && d.s === target) {
            hit = true;
            const step = s.settings.atcSkip && target !== 25 ? d.m : 1;
            const next = Math.min(s.scores[p] + step, ATC_DONE);
            points = next - s.scores[p];
            s.scores[p] = next;
        }
    } else if (s.kind === 'shanghai') {
        if (d.s === target) { hit = true; points = dartValue(d); }
    } else {
        points = dartValue(d);
        hit = d.s > 0;
    }
    if (s.kind !== 'atc') s.scores[p] += points;
    s.pendingPoints += points;
    s.pendingHits += hit ? 1 : 0;

    let legWinner: number | null = null;
    const shanghai = s.kind === 'shanghai' && isShanghai(s.pending, target);
    if (s.kind === 'atc' && s.scores[p] >= ATC_DONE) legWinner = p;
    if (shanghai) legWinner = p;

    if (legWinner === null && s.pending.length < 3) return s;

    // ---- close the visit
    const leg = s.legs[s.legs.length - 1];
    leg.visits.push({ player: p, darts: s.pending, points: s.pendingPoints, hits: s.pendingHits, round: s.round, shanghai });
    s.pending = [];
    s.pendingPoints = 0;
    s.pendingHits = 0;

    if (legWinner === null) {
        const next = (p + 1) % s.players.length;
        if (next === leg.starter) {
            if (s.kind !== 'atc' && s.round >= totalRounds(s.settings)) {
                const max = Math.max(...s.scores);
                const leaders = s.scores.flatMap((v, i) => (v === max ? [i] : []));
                if (leaders.length === 1) legWinner = leaders[0];
            }
            s.round++;
        }
        s.current = next;
    }

    if (legWinner !== null) {
        leg.winner = legWinner;
        const { progress } = applyLegWin(s.settings, s.progress, legWinner);
        s.progress = progress;
        if (progress.winner !== null) {
            s.winner = progress.winner;
            return s;
        }
        const starter = legStarter(progress, s.players.length, s.settings.sets > 0);
        s.legs.push({ starter, visits: [], winner: null });
        s.scores = s.players.map(() => 0);
        s.round = 1;
        s.current = starter;
    }
    return s;
}

export function replayRounds(settings: MatchSettings, players: MatchPlayer[], events: GameEvent[]): RoundsState {
    let state = initRounds(settings, players);
    for (const e of effectiveEvents(events)) {
        const next = e.t === 'dart' ? applyRoundsDart(state, e) : null;
        state = next ?? { ...state, rejected: state.rejected + 1 };
    }
    return state;
}
