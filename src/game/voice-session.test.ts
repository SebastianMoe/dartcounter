import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VoiceSession } from './voice-session';
import type { VoiceCommand, VoiceContext } from './voice';
import { evaluateScore, evaluateTotal, normalize } from './voice';

let commands: string[];
let errors: string[];
let ctx: VoiceContext;

function session() {
    return new VoiceSession({
        context: () => ctx,
        onCommand: (_c: VoiceCommand, label: string) => commands.push(label),
        onError: (m: string) => errors.push(m),
    }, 1000);
}

beforeEach(() => {
    vi.useFakeTimers();
    commands = [];
    errors = [];
    ctx = { mode: 'darts', allowTotal: true };
});

describe('voice session (keywords)', () => {
    it('three darts after "Score" are entered immediately', () => {
        session().final(['Score Triple 20 Triple 20 Doppel 16']);
        expect(commands).toEqual(['T20 · T20 · D16']);
    });

    it('joins a sentence that arrives in pieces (the "last dart" bug)', () => {
        const s = session();
        s.final(['Score Triple 20 Triple 20 Doppel']);
        expect(commands).toEqual([]); // waiting for the number after "Doppel"
        s.final(['16']);
        expect(commands).toEqual(['T20 · T20 · D16']);
    });

    it('enters 1–2 darts after a short pause', () => {
        const s = session();
        s.final(['Score Triple 20 5']);
        expect(commands).toEqual([]);
        vi.advanceTimersByTime(1100);
        expect(commands).toEqual(['T20 · 5']);
    });

    it('keeps waiting while the player is still talking', () => {
        const s = session();
        s.final(['Score Triple 20']);
        vi.advanceTimersByTime(800);
        s.interim('Triple 19');
        vi.advanceTimersByTime(800);
        expect(commands).toEqual([]);
        s.final(['Triple 19 Doppel 12']);
        expect(commands).toEqual(['T20 · T19 · D12']);
    });

    it('splits numbers the recogniser glued together', () => {
        session().final(['Score Triple 20205']);
        expect(commands).toEqual(['T20 · 20 · 5']);
    });

    it('understands other spellings of triple/double', () => {
        session().final(['Score Tripple 20 daneben Dabble 8']);
        expect(commands).toEqual(['T20 · Miss · D8']);
    });

    it('"Mist" is a curse, not a miss – never counted', () => {
        const s = session();
        s.final(['Mist']);
        expect(commands).toEqual([]);
        expect(errors).toEqual([]);
        // even while a score is still open it must not become a dart
        s.final(['Score 20 20']);
        s.final(['Mist']);
        vi.advanceTimersByTime(1100);
        expect(commands).toEqual(['20 · 20']); // the two valid darts are kept, "Mist" is dropped
        expect(errors).toEqual([]);
    });

    it('does not double count Android cumulative results', () => {
        const s = session();
        s.final(['Score Triple 20 Triple']);
        s.final(['Score Triple 20 Triple 19 Doppel 12']);
        expect(commands).toEqual(['T20 · T19 · D12']);
    });

    it('"Total" enters the visit total', () => {
        const s = session();
        s.final(['Total hundertvierzig']);
        s.final(['Total 1 40']);
        s.final(['Summe 60']);
        expect(commands).toEqual(['Total 140', 'Total 140', 'Total 60']);
    });

    it('ignores numbers without activation word and gives a hint', () => {
        session().final(['Triple 20 Triple 20']);
        expect(commands).toEqual([]);
        expect(errors[0]).toMatch(/Score/);
    });

    it('ignores normal talk silently', () => {
        session().final(['hol mir mal ein Bier']);
        expect(commands).toEqual([]);
        expect(errors).toEqual([]);
    });

    it('commands work without activation word and flush a pending score', () => {
        const s = session();
        s.final(['Score Triple 20']);
        s.final(['weiter']);
        expect(commands).toEqual(['T20', 'Weiter']);
        s.final(['rückgängig']);
        expect(commands).toEqual(['T20', 'Weiter', 'Rückgängig']);
    });

    it('two commands in one breath', () => {
        session().final(['Score 20 20 20 Score Triple 19']);
        expect(commands).toEqual(['20 · 20 · 20']);
        vi.advanceTimersByTime(1100);
        expect(commands).toEqual(['20 · 20 · 20', 'T19']);
    });

    it('reports invalid darts and totals', () => {
        const s = session();
        s.final(['Score Triple 25']);
        s.final(['Score 60']);
        s.final(['Total 200']);
        vi.advanceTimersByTime(1100); // errors are reported once the sentence is over
        expect(commands).toEqual([]);
        expect(errors.length).toBe(3);
        expect(errors[1]).toMatch(/Total 60/);
    });

    it('"Total" is refused outside X01', () => {
        ctx = { mode: 'darts', allowTotal: false };
        session().final(['Total 60']);
        expect(commands).toEqual([]);
        expect(errors[0]).toMatch(/nur bei X01/);
    });

    it('picks the recogniser alternative that parses', () => {
        session().final(['Score Triple zwanzig doppel sex zehn bier', 'Score Triple 20 Doppel 16 Miss']);
        expect(commands).toEqual(['T20 · D16 · Miss']);
    });

    it('a question can intercept plain answers', () => {
        const answered: string[] = [];
        const s = new VoiceSession({
            context: () => ctx,
            onCommand: (_c, l) => commands.push(l),
            onError: m => errors.push(m),
            intercept: alts => { answered.push(alts[0]); return true; },
        });
        s.final(['zwei']);
        expect(answered).toEqual(['zwei']);
        expect(commands).toEqual([]);
    });
});

describe('segment parsing', () => {
    it('handles bull, bullseye and repeats', () => {
        const r = evaluateScore(normalize('Bull Bullseye zweimal 20').filter(Boolean));
        expect(r.status).toBe('error'); // 4 darts
        expect(evaluateScore(normalize('Bull Bullseye 20'))).toMatchObject({ status: 'complete' });
        expect(evaluateScore(normalize('dreimal 20'))).toMatchObject({ status: 'complete' });
    });
    it('total with bust / zero', () => {
        expect(evaluateTotal(normalize('bust'))).toMatchObject({ status: 'complete', command: { type: 'total', score: 0 } });
        expect(evaluateTotal(normalize('null'))).toMatchObject({ status: 'complete', command: { type: 'total', score: 0 } });
    });
});
