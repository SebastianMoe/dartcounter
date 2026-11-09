import { describe, expect, it } from 'vitest';
import { parseNumberWord, parseVoice, parseAlternatives, type VoiceContext } from './voice';
import { dartLabel } from './types';

const darts: VoiceContext = { mode: 'darts', allowTotal: true };
const total: VoiceContext = { mode: 'total', allowTotal: true };
const cricket: VoiceContext = { mode: 'darts', allowTotal: false };

const labels = (text: string, ctx = darts) => {
    const c = parseVoice(text, ctx);
    return c?.type === 'darts' ? c.darts.map(dartLabel).join(' ') : c;
};

describe('number words', () => {
    it.each([
        ['zwanzig', 20], ['einundzwanzig', 21], ['sechzig', 60], ['hundert', 100], ['hundertvierzig', 140],
        ['einhundertachtzig', 180], ['hundertundeins', 101], ['fünfundachtzig', 85], ['zwölf', 12], ['180', 180],
    ])('%s = %i', (w, n) => expect(parseNumberWord(w)).toBe(n));
    it('rejects garbage', () => expect(parseNumberWord('bier')).toBeNull());
});

describe('voice commands', () => {
    it('parses single darts in many spellings', () => {
        expect(labels('Triple 20, Triple 20, Doppel 16')).toBe('T20 T20 D16');
        expect(labels('T20 T19 D12')).toBe('T20 T19 D12');
        expect(labels('tripple zwanzig doppel acht')).toBe('T20 D8');
        expect(labels('Bull')).toBe('Bull');
        expect(labels('Bullseye')).toBe('Bullseye');
        expect(labels('Doppel Bull')).toBe('Bullseye');
        expect(labels('daneben 5 einfach 1')).toBe('Miss 5 1');
        expect(labels('dreimal')).toBeNull();
        expect(labels('zwei mal Triple 20 und Doppel 10')).toBe('T20 T20 D10');
    });

    it('treats single numbers as total or dart depending on mode', () => {
        expect(parseVoice('100', darts)).toEqual({ type: 'total', score: 100 });
        expect(parseVoice('hundert vierzig', darts)).toEqual({ type: 'total', score: 140 });
        expect(parseVoice('20', darts)).toEqual({ type: 'darts', darts: [{ s: 20, m: 1 }] });
        expect(parseVoice('20', total)).toEqual({ type: 'total', score: 20 });
        expect(parseVoice('180er', total)).toEqual({ type: 'total', score: 180 });
        expect(parseVoice('100', cricket)).toBeNull();
    });

    it('understands commands', () => {
        expect(parseVoice('rückgängig', darts)).toEqual({ type: 'undo' });
        expect(parseVoice('Bust', darts)).toEqual({ type: 'bust' });
        expect(parseVoice('überworfen', total)).toEqual({ type: 'bust' });
        expect(parseVoice('Check', darts)).toEqual({ type: 'checkout' });
        expect(parseVoice('Game shot', darts)).toEqual({ type: 'checkout' });
        expect(parseVoice('weiter', darts)).toEqual({ type: 'next' });
        expect(parseVoice('nächster', cricket)).toEqual({ type: 'next' });
        expect(parseVoice('triple 20 weiter', darts)).toBeNull();
    });

    it('ignores table talk and invalid darts', () => {
        expect(parseVoice('hol mir mal ein bier', darts)).toBeNull();
        expect(parseVoice('triple bull', darts)).toBeNull();
        expect(parseVoice('triple 25', darts)).toBeNull();
        expect(parseVoice('triple 21', darts)).toBeNull();
        expect(parseVoice('20 20 20 20', darts)).toBeNull();
        expect(parseVoice('200', total)).toBeNull();
    });

    it('uses the first alternative that parses', () => {
        const r = parseAlternatives(['triple zwanzig doppel sex zehn', 'triple 20 doppel 16'], darts);
        expect(r?.command).toEqual({ type: 'darts', darts: [{ s: 20, m: 3 }, { s: 16, m: 2 }] });
    });
});
