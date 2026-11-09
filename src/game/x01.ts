import {
    dartValue, effectiveEvents, isValidDart,
    type Dart, type DartEvent, type GameEvent, type MatchPlayer, type MatchSettings, type OutRule, type VisitEvent,
} from './types';
import { applyLegWin, initProgress, legStarter, type MatchProgress } from './match';

export interface X01Visit {
    player: number;
    /** Individual darts (null when entered as a total) */
    darts: Dart[] | null;
    /** Points scored (0 on bust) */
    score: number;
    /** Points as entered, before bust handling */
    rawScore: number;
    startScore: number;
    bust: boolean;
    checkout: boolean;
    dartsUsed: number;
    /** Darts thrown at a finishing double (null = unknown) */
    atDouble: number | null;
}

export interface X01Leg {
    starter: number;
    visits: X01Visit[];
    winner: number | null;
}

export interface X01State {
    kind: 'x01';
    settings: MatchSettings;
    players: MatchPlayer[];
    legs: X01Leg[];
    progress: MatchProgress;
    /** Remaining score per player in the current leg */
    remaining: number[];
    /** Double-in: has the player opened in the current leg */
    opened: boolean[];
    current: number;
    /** Darts of the visit in progress */
    pending: Dart[];
    /** Darts at double in the visit in progress */
    pendingAtDouble: number;
    winner: number | null;
    /** Events that were ignored during replay (should be 0) */
    rejected: number;
}

// Scores that cannot be finished with the given out rule in 3 darts.
const BOGEY_DOUBLE = new Set([159, 162, 163, 165, 166, 168, 169]);
const IMPOSSIBLE_VISITS = new Set([163, 166, 169, 172, 173, 175, 176, 178, 179]);

export function isFinishingDart(d: Dart, outRule: OutRule): boolean {
    if (outRule === 'straight') return true;
    if (outRule === 'double') return d.m === 2;
    return d.m === 2 || d.m === 3;
}

/** Can `rest` be checked out with a single dart under the out rule? */
export function isOneDartFinish(rest: number, outRule: OutRule): boolean {
    if (outRule === 'straight') return rest > 0 && (rest <= 20 || rest === 25 || rest === 50 || (rest <= 40 && rest % 2 === 0) || (rest <= 60 && rest % 3 === 0));
    if (outRule === 'double') return rest === 50 || (rest >= 2 && rest <= 40 && rest % 2 === 0);
    return rest === 50 || (rest >= 2 && rest <= 40 && rest % 2 === 0) || (rest >= 3 && rest <= 60 && rest % 3 === 0);
}

/** Can `rest` be checked out with at most 3 darts? */
export function isCheckoutPossible(rest: number, outRule: OutRule): boolean {
    if (rest <= 0) return false;
    if (outRule === 'straight') return rest <= 180 && !IMPOSSIBLE_VISITS.has(rest);
    if (outRule === 'double') return rest >= 2 && rest <= 170 && !BOGEY_DOUBLE.has(rest);
    return rest >= 2 && rest <= 180 && !IMPOSSIBLE_VISITS.has(rest) && rest !== 179;
}

/** Remaining score that can never be finished (e.g. 1 with double out). */
const isDeadScore = (rest: number, outRule: OutRule) => rest === 1 && outRule !== 'straight';

export function isValidVisitScore(score: number): boolean {
    return Number.isInteger(score) && score >= 0 && score <= 180 && !IMPOSSIBLE_VISITS.has(score);
}

export function initX01(settings: MatchSettings, players: MatchPlayer[]): X01State {
    const progress = initProgress(players.length);
    return {
        kind: 'x01',
        settings,
        players,
        legs: [{ starter: 0, visits: [], winner: null }],
        progress,
        remaining: players.map(() => settings.startScore),
        opened: players.map(() => settings.inRule === 'straight'),
        current: 0,
        pending: [],
        pendingAtDouble: 0,
        winner: null,
        rejected: 0,
    };
}

function cloneState(s: X01State): X01State {
    const legs = [...s.legs];
    const cur = legs[legs.length - 1];
    legs[legs.length - 1] = { ...cur, visits: [...cur.visits] };
    return { ...s, legs, remaining: [...s.remaining], opened: [...s.opened], pending: [...s.pending] };
}

function closeVisit(s: X01State, visit: X01Visit): X01State {
    const leg = s.legs[s.legs.length - 1];
    leg.visits.push(visit);
    s.pending = [];
    s.pendingAtDouble = 0;

    if (visit.checkout) {
        leg.winner = visit.player;
        const { progress } = applyLegWin(s.settings, s.progress, visit.player);
        s.progress = progress;
        if (progress.winner !== null) {
            s.winner = progress.winner;
            return s;
        }
        const starter = legStarter(progress, s.players.length, s.settings.sets > 0);
        s.legs.push({ starter, visits: [], winner: null });
        s.remaining = s.players.map(() => s.settings.startScore);
        s.opened = s.players.map(() => s.settings.inRule === 'straight');
        s.current = starter;
        return s;
    }
    s.current = (s.current + 1) % s.players.length;
    return s;
}

export function applyX01Dart(prev: X01State, e: DartEvent): X01State | null {
    if (prev.winner !== null) return null;
    const dart: Dart = { s: e.s, m: e.s === 0 ? 1 : e.m };
    if (!isValidDart(dart)) return null;

    const s = cloneState(prev);
    const p = s.current;
    const startScore = s.remaining[p];
    const before = startScore - s.pending.reduce((sum, d, i) => sum + countedValue(s, d, i), 0);

    // Double-in: darts only count once the player has hit a double
    const pendingOpened = s.opened[p] || s.pending.some(d => d.m === 2);
    const counts = pendingOpened || dart.m === 2;
    const value = counts ? dartValue(dart) : 0;
    const after = before - value;

    if (isOneDartFinish(before, s.settings.outRule) && s.settings.outRule !== 'straight') s.pendingAtDouble++;
    s.pending.push(dart);

    const finishOk = after === 0 && isFinishingDart(dart, s.settings.outRule);
    const bust = after < 0 || (after === 0 && !finishOk) || isDeadScore(after, s.settings.outRule);

    if (bust || finishOk || s.pending.length === 3) {
        const raw = startScore - after;
        const visit: X01Visit = {
            player: p,
            darts: s.pending,
            score: bust ? 0 : raw,
            rawScore: raw,
            startScore,
            bust,
            checkout: finishOk && !bust,
            dartsUsed: s.pending.length,
            atDouble: s.settings.outRule === 'straight' ? null : s.pendingAtDouble,
        };
        if (!bust) {
            s.remaining[p] = after;
            s.opened[p] = s.opened[p] || s.pending.some(d => d.m === 2);
        }
        return closeVisit(s, visit);
    }
    return s;
}

// Value of a pending dart, honouring double-in.
function countedValue(s: X01State, d: Dart, index: number): number {
    const p = s.current;
    if (s.opened[p]) return dartValue(d);
    const openedBefore = s.pending.slice(0, index).some(x => x.m === 2);
    return openedBefore || d.m === 2 ? dartValue(d) : 0;
}

export function validateVisit(state: X01State, e: VisitEvent): string | null {
    if (state.winner !== null) return 'Das Match ist beendet.';
    if (state.pending.length > 0) return 'Erst die angefangene Aufnahme beenden.';
    if (!isValidVisitScore(e.score)) return `${e.score} ist mit drei Darts nicht möglich.`;
    const rest = state.remaining[state.current] - e.score;
    if (rest === 0 && !isCheckoutPossible(e.score, state.settings.outRule)) {
        return `${e.score} kann man nicht auschecken.`;
    }
    if (rest === 0 && e.darts !== undefined && (e.darts < 1 || e.darts > 3)) return 'Ungültige Anzahl Darts.';
    return null;
}

export function applyX01Visit(prev: X01State, e: VisitEvent): X01State | null {
    if (validateVisit(prev, e)) return null;
    const s = cloneState(prev);
    const p = s.current;
    const startScore = s.remaining[p];
    const after = startScore - e.score;
    const bust = after < 0 || isDeadScore(after, s.settings.outRule);
    const checkout = after === 0;
    if (e.score > 0) s.opened[p] = true;
    if (!bust) s.remaining[p] = after;

    const visit: X01Visit = {
        player: p,
        darts: null,
        score: bust ? 0 : e.score,
        rawScore: e.score,
        startScore,
        bust,
        checkout,
        dartsUsed: checkout ? Math.min(3, Math.max(1, e.darts ?? 3)) : 3,
        atDouble: e.atDouble ?? (checkout && s.settings.outRule !== 'straight' ? 1 : null),
    };
    return closeVisit(s, visit);
}

export function replayX01(settings: MatchSettings, players: MatchPlayer[], events: GameEvent[]): X01State {
    let state = initX01(settings, players);
    for (const e of effectiveEvents(events)) {
        const next = e.t === 'dart' ? applyX01Dart(state, e) : applyX01Visit(state, e);
        if (next) state = next;
        else state = { ...state, rejected: state.rejected + 1 };
    }
    return state;
}

/** Remaining score shown during a visit in progress (after pending darts). */
export function liveRemaining(state: X01State, player: number): number {
    if (player !== state.current) return state.remaining[player];
    const s = state;
    return s.remaining[player] - s.pending.reduce((sum, d, i) => sum + countedValue(s, d, i), 0);
}
