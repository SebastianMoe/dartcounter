import { effectiveEvents, isValidDart, type Dart, type GameEvent, type MatchPlayer, type MatchSettings } from './types';
import { applyLegWin, initProgress, legStarter, type MatchProgress } from './match';

export const CRICKET_NUMBERS = [20, 19, 18, 17, 16, 15, 25] as const;

export interface CricketVisit {
    player: number;
    darts: Dart[];
    /** Marks that counted (closing or scoring) */
    marks: number;
    points: number;
}

export interface CricketLeg {
    starter: number;
    visits: CricketVisit[];
    winner: number | null;
}

export interface CricketState {
    kind: 'cricket';
    settings: MatchSettings;
    players: MatchPlayer[];
    legs: CricketLeg[];
    progress: MatchProgress;
    /** marks[player][number] 0..3 */
    marks: Record<number, number>[];
    points: number[];
    current: number;
    pending: Dart[];
    pendingMarks: number;
    pendingPoints: number;
    winner: number | null;
    rejected: number;
}

const emptyMarks = () => Object.fromEntries(CRICKET_NUMBERS.map(n => [n, 0])) as Record<number, number>;

export function initCricket(settings: MatchSettings, players: MatchPlayer[]): CricketState {
    return {
        kind: 'cricket',
        settings,
        players,
        legs: [{ starter: 0, visits: [], winner: null }],
        progress: initProgress(players.length),
        marks: players.map(emptyMarks),
        points: players.map(() => 0),
        current: 0,
        pending: [],
        pendingMarks: 0,
        pendingPoints: 0,
        winner: null,
        rejected: 0,
    };
}

export function isClosedByAll(state: CricketState, num: number): boolean {
    return state.marks.every(m => m[num] >= 3);
}

/** Cut-Throat: points go to the opponents, lowest score wins. Old matches without the flag stay classic. */
export const isCutThroat = (s: MatchSettings) => s.cricketMode === 'cutthroat';

function hasWon(state: CricketState, p: number): boolean {
    const allClosed = CRICKET_NUMBERS.every(n => state.marks[p][n] >= 3);
    if (!allClosed) return false;
    return isCutThroat(state.settings)
        ? state.points.every((pts, i) => i === p || pts >= state.points[p])
        : state.points.every((pts, i) => i === p || pts <= state.points[p]);
}

export function applyCricketDart(prev: CricketState, dart: Dart): CricketState | null {
    if (prev.winner !== null) return null;
    const d: Dart = { s: dart.s, m: dart.s === 0 ? 1 : dart.m };
    if (!isValidDart(d)) return null;

    const s: CricketState = {
        ...prev,
        legs: prev.legs.map((l, i) => (i === prev.legs.length - 1 ? { ...l, visits: [...l.visits] } : l)),
        marks: prev.marks.map(m => ({ ...m })),
        points: [...prev.points],
        pending: [...prev.pending, d],
    };
    const p = s.current;

    if ((CRICKET_NUMBERS as readonly number[]).includes(d.s)) {
        const have = s.marks[p][d.s];
        const closing = Math.min(3 - have, d.m);
        const extra = d.m - closing;
        s.marks[p][d.s] = have + closing;
        let usedMarks = closing;
        const open = s.marks.flatMap((m, i) => (i !== p && m[d.s] < 3 ? [i] : []));
        if (extra > 0 && open.length > 0) {
            const pts = extra * d.s;
            if (isCutThroat(s.settings)) {
                // every opponent who hasn't closed the number gets the points
                for (const i of open) s.points[i] += pts;
                s.pendingPoints += pts * open.length;
            } else {
                s.points[p] += pts;
                s.pendingPoints += pts;
            }
            usedMarks += extra;
        }
        s.pendingMarks += usedMarks;
    }

    const order = [p, ...s.players.map((_, i) => i).filter(i => i !== p)];
    const legWinner = order.find(i => hasWon(s, i)) ?? null;
    const won = legWinner !== null;
    if (won || s.pending.length === 3) {
        const leg = s.legs[s.legs.length - 1];
        leg.visits.push({ player: p, darts: s.pending, marks: s.pendingMarks, points: s.pendingPoints });
        s.pending = [];
        s.pendingMarks = 0;
        s.pendingPoints = 0;

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
            s.marks = s.players.map(emptyMarks);
            s.points = s.players.map(() => 0);
            s.current = starter;
            return s;
        }
        s.current = (p + 1) % s.players.length;
    }
    return s;
}

export function replayCricket(settings: MatchSettings, players: MatchPlayer[], events: GameEvent[]): CricketState {
    let state = initCricket(settings, players);
    for (const e of effectiveEvents(events)) {
        const next = e.t === 'dart' ? applyCricketDart(state, e) : null;
        state = next ?? { ...state, rejected: state.rejected + 1 };
    }
    return state;
}
