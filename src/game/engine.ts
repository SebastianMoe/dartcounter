import { replayCricket, type CricketState } from './cricket';
import { replayX01, validateVisit, type X01State } from './x01';
import { ATC_SEQUENCE, replayRounds, type RoundsState } from './rounds';
import type { GameEvent, MatchPlayer, MatchSettings } from './types';

export type MatchState = X01State | CricketState | RoundsState;

export interface MatchRecord {
    id: string;
    settings: MatchSettings;
    players: MatchPlayer[];
    events: GameEvent[];
    createdAt: number;
    finishedAt?: number;
    /** PocketBase match id when played online */
    onlineId?: string;
}

export function replay(m: Pick<MatchRecord, 'settings' | 'players' | 'events'>): MatchState {
    switch (m.settings.kind) {
        case 'x01': return replayX01(m.settings, m.players, m.events);
        case 'cricket': return replayCricket(m.settings, m.players, m.events);
        default: return replayRounds(m.settings, m.players, m.events);
    }
}

/** Returns an error message if the event would be rejected by the engine. */
export function validateEvent(state: MatchState, e: GameEvent): string | null {
    if (e.t === 'undo') return null;
    if (state.winner !== null) return 'Das Match ist beendet.';
    if (state.kind !== 'x01') return e.t === 'dart' ? (e.s === 25 && e.m === 3 ? 'Triple-Bull gibt es nicht.' : null) : 'In diesem Spiel nur einzelne Darts.';
    if (e.t === 'visit') return validateVisit(state, e);
    if (e.s === 25 && e.m === 3) return 'Triple-Bull gibt es nicht.';
    return null;
}

/** Index of the player whose turn it is */
export const currentPlayer = (s: MatchState) => s.current;

export const currentLeg = (s: MatchState) => s.legs[s.legs.length - 1];

/** Darts thrown in the current leg by everyone (for "darts this leg" display). */
export function dartsInLeg(s: MatchState, player: number): number {
    const leg = currentLeg(s);
    let n = 0;
    for (const v of leg.visits) if (v.player === player) n += 'dartsUsed' in v ? v.dartsUsed : v.darts.length;
    if (player === s.current) n += s.pending.length;
    return n;
}

/** Short score for lists: remaining (X01), points, or next target (ATC). */
export function scoreText(s: MatchState, player: number): string {
    if (s.kind === 'x01') return String(s.remaining[player]);
    if (s.kind === 'cricket') return String(s.points[player]);
    if (s.kind === 'atc') {
        const t = ATC_SEQUENCE[s.scores[player]];
        return t === undefined ? '✓' : t === 25 ? '→Bull' : `→${t}`;
    }
    return String(s.scores[player]);
}
