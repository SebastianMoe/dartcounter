// Core domain types for the darts engine.
// The engine is pure: a match is fully described by its settings, players and an
// append-only list of events. Every view (scores, stats, undo) is derived by replay.

export type GameKind = 'x01' | 'cricket' | 'atc' | 'shanghai' | 'highscore';
export type RoundsKind = 'atc' | 'shanghai' | 'highscore';
export const isRoundsKind = (k: GameKind): k is RoundsKind => k === 'atc' || k === 'shanghai' || k === 'highscore';
export type InRule = 'straight' | 'double';
export type OutRule = 'straight' | 'double' | 'master';
export type MatchFormat = 'firstTo' | 'bestOf';

export interface MatchSettings {
    kind: GameKind;
    /** X01 only */
    startScore: number;
    inRule: InRule;
    outRule: OutRule;
    /** How the leg/set target is interpreted */
    format: MatchFormat;
    /** Legs (per set, when sets > 0) */
    legs: number;
    /** 0 = no sets, only legs */
    sets: number;
    /** Shanghai / Highscore: number of rounds */
    rounds?: number;
    /** Around the Clock: doubles/triples advance 2/3 numbers */
    atcSkip?: boolean;
    /** Cricket: 'cutthroat' = points go to opponents, lowest wins. Missing = classic. */
    cricketMode?: 'standard' | 'cutthroat';
}

/** Fills in defaults for new matches (old saved matches are replayed as they were). */
export function normalizeSettings(s: MatchSettings): MatchSettings {
    if (s.kind === 'cricket' && !s.cricketMode) return { ...s, cricketMode: 'cutthroat' };
    return s;
}

export const GAME_NAMES: Record<GameKind, string> = {
    x01: 'X01',
    cricket: 'Cricket',
    atc: 'Around the Clock',
    shanghai: 'Shanghai',
    highscore: 'Highscore',
};

export interface MatchPlayer {
    id: string;
    name: string;
    /** Local profile id (for statistics) */
    profileId?: string;
    /** PocketBase user id (online matches) */
    userId?: string;
}

export type Multiplier = 1 | 2 | 3;

export interface DartEvent {
    t: 'dart';
    /** Segment 0 (miss), 1-20, 25 (bull) */
    s: number;
    m: Multiplier;
    /** Author (online) */
    by?: string;
}

export interface VisitEvent {
    t: 'visit';
    /** Total score of the visit */
    score: number;
    /** Darts used (only relevant for a checkout, default 3) */
    darts?: number;
    /** Darts thrown at a double (optional, for checkout %) */
    atDouble?: number;
    by?: string;
}

export interface UndoEvent {
    t: 'undo';
    by?: string;
}

export type GameEvent = DartEvent | VisitEvent | UndoEvent;

export interface Dart {
    s: number;
    m: Multiplier;
}

export const dartValue = (d: Dart) => (d.s === 0 ? 0 : d.s * d.m);

export function dartLabel(d: Dart): string {
    if (d.s === 0) return 'Miss';
    if (d.s === 25) return d.m === 2 ? 'Bullseye' : 'Bull';
    return `${d.m === 3 ? 'T' : d.m === 2 ? 'D' : ''}${d.s}`;
}

export function isValidDart(d: Dart): boolean {
    if (d.s === 0) return d.m === 1;
    if (d.s === 25) return d.m === 1 || d.m === 2;
    return Number.isInteger(d.s) && d.s >= 1 && d.s <= 20 && (d.m === 1 || d.m === 2 || d.m === 3);
}

/** Leg target needed to win a set (or the match when sets are off) */
export function legsToWin(settings: MatchSettings): number {
    return settings.format === 'bestOf' ? Math.floor(settings.legs / 2) + 1 : settings.legs;
}

export function setsToWin(settings: MatchSettings): number {
    if (!settings.sets) return 0;
    return settings.format === 'bestOf' ? Math.floor(settings.sets / 2) + 1 : settings.sets;
}

export function describeFormat(settings: MatchSettings): string {
    const f = settings.format === 'bestOf' ? 'Best of' : 'First to';
    if (settings.sets > 0) return `${f} ${settings.sets} Sets · ${settings.legs} Legs`;
    return `${f} ${settings.legs} ${settings.legs === 1 ? 'Leg' : 'Legs'}`;
}

/** Removes undone events, so replay only sees effective events. */
export function effectiveEvents(events: GameEvent[]): Exclude<GameEvent, UndoEvent>[] {
    const out: Exclude<GameEvent, UndoEvent>[] = [];
    for (const e of events) {
        if (e.t === 'undo') out.pop();
        else out.push(e);
    }
    return out;
}
