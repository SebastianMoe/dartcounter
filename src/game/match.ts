import { legsToWin, setsToWin, type MatchSettings } from './types';

/** Leg/set bookkeeping shared by all game kinds. */
export interface MatchProgress {
    legsWon: number[]; // legs in the current set (or overall when sets are off)
    setsWon: number[];
    totalLegsWon: number[];
    legNumber: number; // global leg index, 0-based
    setNumber: number; // 0-based
    legInSet: number; // 0-based
    winner: number | null;
}

export function initProgress(playerCount: number): MatchProgress {
    return {
        legsWon: Array(playerCount).fill(0),
        setsWon: Array(playerCount).fill(0),
        totalLegsWon: Array(playerCount).fill(0),
        legNumber: 0,
        setNumber: 0,
        legInSet: 0,
        winner: null,
    };
}

export interface LegResult {
    progress: MatchProgress;
    setWon: boolean;
}

export function applyLegWin(settings: MatchSettings, prev: MatchProgress, winner: number): LegResult {
    const p: MatchProgress = {
        ...prev,
        legsWon: [...prev.legsWon],
        setsWon: [...prev.setsWon],
        totalLegsWon: [...prev.totalLegsWon],
    };
    p.legsWon[winner]++;
    p.totalLegsWon[winner]++;
    p.legNumber++;
    p.legInSet++;
    let setWon = false;

    if (p.legsWon[winner] >= legsToWin(settings)) {
        if (settings.sets > 0) {
            p.setsWon[winner]++;
            setWon = true;
            if (p.setsWon[winner] >= setsToWin(settings)) {
                p.winner = winner;
            } else {
                p.legsWon = p.legsWon.map(() => 0);
                p.setNumber++;
                p.legInSet = 0;
            }
        } else {
            p.winner = winner;
        }
    }
    return { progress: p, setWon };
}

/**
 * Who throws first in the current leg.
 * Within a set legs alternate; each new set is opened by the next player
 * (standard tournament rotation). Without sets it simply alternates.
 */
export function legStarter(progress: MatchProgress, playerCount: number, usesSets: boolean): number {
    if (!usesSets) return progress.legNumber % playerCount;
    return (progress.setNumber + progress.legInSet) % playerCount;
}
