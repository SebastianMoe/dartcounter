import { dartLabel, dartValue, type Dart, type OutRule } from './types';
import { isFinishingDart } from './x01';

// Builds a checkout suggestion the way most scoring apps do: fewest darts first,
// then "comfortable" routes (T20/T19 setups, favourite doubles like D20/D16/D8).

const ALL_DARTS: Dart[] = [];
for (let n = 1; n <= 20; n++) for (const m of [1, 2, 3] as const) ALL_DARTS.push({ s: n, m });
ALL_DARTS.push({ s: 25, m: 1 }, { s: 25, m: 2 });

const DOUBLE_PREF = [20, 16, 8, 18, 12, 10, 4, 25, 14, 6, 2, 19, 17, 15, 13, 11, 9, 7, 5, 3, 1];

function setupCost(d: Dart): number {
    if (d.s === 25) return d.m === 2 ? 4 : 3;
    if (d.m === 1) return 1 + (20 - d.s) * 0.01;
    if (d.m === 3) {
        if (d.s === 20) return 1;
        if (d.s === 19) return 1.3;
        if (d.s === 18 || d.s === 17) return 1.8;
        return 2.5 + (20 - d.s) * 0.05;
    }
    return 5; // doubles as setup darts are unusual
}

function finishCost(d: Dart): number {
    if (d.m === 2) {
        const idx = DOUBLE_PREF.indexOf(d.s);
        return idx * 0.4;
    }
    if (d.m === 3) return 3 + (20 - d.s) * 0.05; // master out
    return d.s === 25 ? 2 : 1 + (20 - d.s) * 0.02; // straight out
}

const cache = new Map<string, Dart[] | null>();

export function suggestCheckout(rest: number, dartsLeft: number, outRule: OutRule): Dart[] | null {
    if (rest <= 0 || dartsLeft <= 0 || rest > 180) return null;
    const key = `${rest}|${dartsLeft}|${outRule}`;
    if (cache.has(key)) return cache.get(key)!;

    const finishers = ALL_DARTS.filter(d => isFinishingDart(d, outRule));
    let best: Dart[] | null = null;

    for (let n = 1; n <= dartsLeft && !best; n++) {
        let bestCost = Infinity;
        const search = (remaining: number, path: Dart[], cost: number) => {
            if (cost >= bestCost) return;
            if (path.length === n - 1) {
                for (const f of finishers) {
                    if (dartValue(f) !== remaining) continue;
                    const total = cost + finishCost(f);
                    if (total < bestCost) {
                        bestCost = total;
                        best = [...path, f];
                    }
                }
                return;
            }
            for (const d of ALL_DARTS) {
                const v = dartValue(d);
                if (v >= remaining) continue;
                search(remaining - v, [...path, d], cost + setupCost(d));
            }
        };
        search(rest, [], 0);
    }
    cache.set(key, best);
    return best;
}

export const formatCheckout = (darts: Dart[]) => darts.map(dartLabel).join(' · ');
