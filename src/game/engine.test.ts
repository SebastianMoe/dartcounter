import { describe, expect, it } from 'vitest';
import { replay } from './engine';
import { suggestCheckout, formatCheckout } from './checkout';
import { x01Stats, cricketStats } from './stats';
import type { GameEvent, MatchPlayer, MatchSettings, Multiplier } from './types';
import type { X01State } from './x01';
import type { CricketState } from './cricket';
import { roundsTarget, type RoundsState } from './rounds';
import { roundsStats } from './stats';

const players: MatchPlayer[] = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }];
const x01 = (over: Partial<MatchSettings> = {}): MatchSettings => ({
    kind: 'x01', startScore: 501, inRule: 'straight', outRule: 'double', format: 'firstTo', legs: 1, sets: 0, ...over,
});
const d = (s: number, m: Multiplier = 1): GameEvent => ({ t: 'dart', s, m });
const v = (score: number, darts?: number): GameEvent => ({ t: 'visit', score, darts });
const run = (settings: MatchSettings, events: GameEvent[]) => replay({ settings, players, events }) as X01State;

describe('x01', () => {
    it('scores darts and rotates after three', () => {
        const s = run(x01(), [d(20, 3), d(20, 3), d(20, 3)]);
        expect(s.remaining).toEqual([321, 501]);
        expect(s.current).toBe(1);
    });

    it('requires a double to finish with double out', () => {
        const s = run(x01({ startScore: 40 }), [d(20, 1), d(20, 1)]);
        // 20 left after first dart, then single 20 -> 0 without double = bust
        expect(s.remaining[0]).toBe(40);
        expect(s.legs[0].visits[0].bust).toBe(true);
        expect(s.current).toBe(1);
    });

    it('busts on 1 remaining with double out', () => {
        const s = run(x01({ startScore: 21 }), [d(20)]);
        expect(s.remaining[0]).toBe(21);
        expect(s.legs[0].visits[0].bust).toBe(true);
    });

    it('allows straight out', () => {
        const s = run(x01({ startScore: 40, outRule: 'straight' }), [d(20), d(20)]);
        expect(s.winner).toBe(0);
    });

    it('master out allows triple finish', () => {
        const s = run(x01({ startScore: 60, outRule: 'master' }), [d(20, 3)]);
        expect(s.winner).toBe(0);
    });

    it('double in ignores darts until a double is hit', () => {
        const s = run(x01({ inRule: 'double' }), [d(20, 3), d(10, 2), d(20, 3)]);
        expect(s.remaining[0]).toBe(501 - 20 - 60);
        expect(s.opened[0]).toBe(true);
    });

    it('counts legs, alternates starter and ends the match', () => {
        const settings = x01({ startScore: 40, legs: 2 });
        let s = run(settings, [d(20, 2)]);
        expect(s.progress.legsWon).toEqual([1, 0]);
        expect(s.winner).toBeNull();
        expect(s.current).toBe(1); // B starts leg 2
        s = run(settings, [d(20, 2), d(20, 2)]);
        expect(s.progress.legsWon).toEqual([1, 1]);
        expect(s.current).toBe(0);
        s = run(settings, [d(20, 2), d(20, 2), d(20, 2)]);
        expect(s.winner).toBe(0);
    });

    it('best of 3 needs 2 legs', () => {
        const s = run(x01({ startScore: 40, format: 'bestOf', legs: 3 }), [d(20, 2), v(0), d(20, 2)]);
        // Leg1 A wins; leg2 B starts and scores 0, A finishes
        expect(s.winner).toBe(0);
    });

    it('handles sets', () => {
        const settings = x01({ startScore: 40, legs: 1, sets: 2 });
        const s = run(settings, [d(20, 2)]);
        expect(s.progress.setsWon).toEqual([1, 0]);
        expect(s.progress.legsWon).toEqual([0, 0]);
        expect(s.winner).toBeNull();
    });

    it('total visits respect bust and leg logic', () => {
        const settings = x01({ startScore: 101, legs: 2 });
        let s = run(settings, [v(100)]);
        expect(s.remaining[0]).toBe(101); // 1 left = bust
        s = run(settings, [v(60), v(0), v(41, 2)]);
        expect(s.progress.legsWon).toEqual([1, 0]);
        expect(s.winner).toBeNull();
        expect(s.legs[0].visits[2].dartsUsed).toBe(2);
    });

    it('rejects impossible totals and checkouts', () => {
        expect(run(x01(), [v(179)]).rejected).toBe(1);
        expect(run(x01({ startScore: 169 }), [v(169)]).rejected).toBe(1);
        expect(run(x01({ startScore: 501 }), [v(181)]).rejected).toBe(1);
    });

    it('rejects triple bull', () => {
        expect(run(x01(), [d(25, 3)]).rejected).toBe(1);
    });

    it('undo removes the last event, also across visits and legs', () => {
        const settings = x01({ startScore: 40, legs: 2 });
        const s = run(settings, [d(20, 2), { t: 'undo' }]);
        expect(s.progress.legsWon).toEqual([0, 0]);
        expect(s.remaining[0]).toBe(40);
        expect(s.current).toBe(0);
        const s2 = run(x01(), [d(20), d(20), d(20), { t: 'undo' }]);
        expect(s2.current).toBe(0);
        expect(s2.pending.length).toBe(2);
    });
});

describe('stats', () => {
    it('computes averages, doubles, triples and checkout rate', () => {
        const s = run(x01({ startScore: 141 }), [d(20, 3), d(19, 3), d(1), /* B */ v(0), /* A: 23 left */ d(3), d(5, 2), d(5, 2)]);
        // A: visit1 60+57+1 = 118 -> 23 left. visit2: S3 -> 20, D5 -> 10, D5 -> 0 finish
        const [a] = x01Stats(s);
        expect(s.winner).toBe(0);
        expect(a.triples).toBe(2);
        expect(a.doubles).toBe(2);
        expect(a.singles).toBe(2);
        expect(a.darts).toBe(6);
        expect(a.average).toBeCloseTo(141 / 6 * 3);
        expect(a.checkouts).toBe(1);
        expect(a.checkoutAttempts).toBe(3); // 24 left (D12), 20 left and 10 left
        expect(a.highestCheckout).toBe(23);
        expect(a.plus100).toBe(1);
    });
});

describe('cricket', () => {
    const cs: MatchSettings = { ...x01(), kind: 'cricket' };
    const runC = (events: GameEvent[]) => replay({ settings: cs, players, events }) as CricketState;

    it('closes numbers and scores extra marks', () => {
        const s = runC([d(20, 3), d(20, 2), d(0)]);
        expect(s.marks[0][20]).toBe(3);
        expect(s.points[0]).toBe(40);
        expect(s.current).toBe(1);
    });

    it('does not score on numbers closed by everyone', () => {
        const s = runC([d(20, 3), d(0), d(0), d(20, 3), d(0), d(0), d(20, 3)]);
        expect(s.points).toEqual([0, 0]);
    });

    it('wins when all closed with enough points and supports undo', () => {
        const nums = [20, 19, 18, 17, 16, 15];
        const ev: GameEvent[] = [];
        for (let i = 0; i < 6; i += 3) {
            ev.push(d(nums[i], 3), d(nums[i + 1], 3), d(nums[i + 2], 3));
            ev.push(d(0), d(0), d(0));
        }
        ev.push(d(25, 2), d(25));
        const s = runC(ev);
        expect(s.winner).toBe(0);
        expect(cricketStats(s)[0].mpr).toBeCloseTo((18 + 3) / 8 * 3);
        const u = runC([...ev, { t: 'undo' }, { t: 'undo' }, { t: 'undo' }]);
        expect(u.winner).toBeNull();
        expect(u.current).toBe(1);
    });
});

describe('checkout suggestions', () => {
    it('finds standard routes', () => {
        expect(formatCheckout(suggestCheckout(170, 3, 'double')!)).toBe('T20 · T20 · Bullseye');
        expect(formatCheckout(suggestCheckout(100, 3, 'double')!)).toBe('T20 · D20');
        expect(formatCheckout(suggestCheckout(40, 3, 'double')!)).toBe('D20');
        expect(suggestCheckout(169, 3, 'double')).toBeNull();
        expect(suggestCheckout(101, 1, 'double')).toBeNull();
    });
});

describe('round games', () => {
    const base = (kind: MatchSettings['kind'], over: Partial<MatchSettings> = {}): MatchSettings =>
        ({ ...x01(), kind, legs: 1, ...over });
    const runR = (settings: MatchSettings, events: GameEvent[], pl = players) => replay({ settings, players: pl, events }) as RoundsState;
    const solo = [players[0]];

    it('around the clock advances on the target only', () => {
        const s = runR(base('atc'), [d(1), d(5), d(2)], solo);
        expect(s.scores[0]).toBe(2); // next target is 3
        expect(roundsTarget(s, 0)).toBe(3);
    });

    it('around the clock skip mode jumps with doubles/triples and finishes on bull', () => {
        const ev: GameEvent[] = [d(1, 3), d(4, 3), d(7, 3), d(10, 3), d(13, 3), d(16, 3), d(19, 2), d(25)];
        const s = runR(base('atc', { atcSkip: true }), ev, solo);
        expect(s.winner).toBe(0);
        expect(roundsStats(s)[0].bestLeg).toBe(8);
    });

    it('shanghai scores only the round number and ends after the rounds', () => {
        const ev: GameEvent[] = [];
        for (let r = 1; r <= 7; r++) ev.push(d(r, 2), d(20, 3), d(0), d(r), d(0), d(0));
        const s = runR(base('shanghai', { rounds: 7 }), ev);
        expect(s.scores[0]).toBe(2 * 28);
        expect(s.scores[1]).toBe(28);
        expect(s.winner).toBe(0);
    });

    it('shanghai (single+double+triple) wins instantly', () => {
        const s = runR(base('shanghai'), [d(1), d(1, 2), d(1, 3)]);
        expect(s.winner).toBe(0);
        expect(roundsStats(s)[0].shanghais).toBe(1);
    });

    it('highscore plays extra rounds on a tie', () => {
        const ev: GameEvent[] = [d(20), d(0), d(0), d(20), d(0), d(0)];
        let s = runR(base('highscore', { rounds: 1 }), ev);
        expect(s.winner).toBeNull();
        expect(s.round).toBe(2);
        s = runR(base('highscore', { rounds: 1 }), [...ev, d(5), d(0), d(0), d(1), d(0), d(0)]);
        expect(s.winner).toBe(0);
    });
});

describe('cut-throat cricket', () => {
    const three: MatchPlayer[] = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }];
    const ct: MatchSettings = { ...x01(), kind: 'cricket', cricketMode: 'cutthroat' };
    const runCT = (events: GameEvent[], pl = three) => replay({ settings: ct, players: pl, events }) as CricketState;
    const miss3 = [d(0), d(0), d(0)];

    it('gives points to every opponent who has not closed the number', () => {
        // A closes 20 and hits two more 20s -> B and C get 40 each, A gets nothing
        const s = runCT([d(20, 3), d(20, 2), d(0)]);
        expect(s.points).toEqual([0, 40, 40]);
    });

    it('opponents who closed the number get nothing', () => {
        const s = runCT([d(20, 3), ...[d(0), d(0)], /* B */ d(20, 3), d(0), d(0), /* C */ ...miss3, /* A */ d(20, 3)]);
        expect(s.points).toEqual([0, 0, 60]);
    });

    it('the player with everything closed and the lowest score wins', () => {
        const pl = [three[0], three[1]];
        const close = (n: number) => d(n, 3);
        // A closes 20 and scores 60 onto B, then closes everything else
        const ev: GameEvent[] = [close(20), d(20, 3), d(0), ...miss3, close(19), close(18), close(17), ...miss3, close(16), close(15), d(25, 2)];
        let s = runCT(ev, pl);
        expect(s.winner).toBeNull(); // bull needs 3 marks: 2 so far
        s = runCT([...ev, ...miss3, d(25)], pl);
        expect(s.points).toEqual([0, 60]);
        expect(s.winner).toBe(0);
    });

    it('closing everything is not enough with more points than an opponent', () => {
        const pl = [three[0], three[1]];
        // B scores 20 onto A first
        const ev: GameEvent[] = [...miss3, d(20, 3), d(20), d(0), d(20, 3), d(19, 3), d(18, 3), ...miss3, d(17, 3), d(16, 3), d(15, 3), ...miss3, d(25, 2), d(25), d(0)];
        const s = runCT(ev, pl);
        expect(s.points[0]).toBe(20);
        expect(s.winner).toBeNull();
    });

    it('classic cricket is unchanged for old matches without the flag', () => {
        const classic = { ...ct, cricketMode: undefined };
        const s = replay({ settings: classic, players: three, events: [d(20, 3), d(20, 2), d(0)] }) as CricketState;
        expect(s.points).toEqual([40, 0, 0]);
    });
});
