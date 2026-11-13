import type { Dart, Multiplier } from './types';

// Turns a spoken sentence into a darts command. Deliberately strict: if a sentence
// contains a word we don't understand, it is ignored. That keeps table talk from
// being scored while the microphone is listening permanently.

export type VoiceCommand =
    | { type: 'darts'; darts: Dart[] }
    | { type: 'total'; score: number }
    | { type: 'undo' }
    | { type: 'bust' }
    | { type: 'checkout' }
    | { type: 'next' };

export interface VoiceContext {
    /** 'total' prefers visit totals for single numbers */
    mode: 'darts' | 'total';
    /** Totals are only allowed in X01 */
    allowTotal: boolean;
}

const UNITS: Record<string, number> = {
    null: 0, ein: 1, eins: 1, eine: 1, zwei: 2, zwo: 2, drei: 3, vier: 4, 'fünf': 5, fuenf: 5,
    sechs: 6, sieben: 7, acht: 8, neun: 9,
};
const TEENS: Record<string, number> = {
    zehn: 10, elf: 11, 'zwölf': 12, zwoelf: 12, dreizehn: 13, vierzehn: 14, 'fünfzehn': 15, fuenfzehn: 15,
    sechzehn: 16, siebzehn: 17, achtzehn: 18, neunzehn: 19,
};
const TENS: Record<string, number> = {
    zwanzig: 20, 'dreißig': 30, dreissig: 30, vierzig: 40, 'fünfzig': 50, fuenfzig: 50,
    sechzig: 60, siebzig: 70, achtzig: 80, neunzig: 90,
};
const ENGLISH: Record<string, number> = {
    zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
    eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
    eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70,
    eighty: 80, ninety: 90, hundred: 100,
};

function below100(w: string): number | null {
    if (w in UNITS) return UNITS[w];
    if (w in TEENS) return TEENS[w];
    if (w in TENS) return TENS[w];
    const m = w.match(/^(.+?)und(.+)$/); // einundzwanzig
    if (m && m[1] in UNITS && m[2] in TENS && UNITS[m[1]] > 0) return UNITS[m[1]] + TENS[m[2]];
    return null;
}

/** German number words up to 999 ("hundertvierzig", "einhundertachtzig", "sechzig"). */
export function parseNumberWord(w: string): number | null {
    if (/^\d+$/.test(w)) return parseInt(w, 10);
    if (w in ENGLISH) return ENGLISH[w];
    const h = w.indexOf('hundert');
    if (h >= 0) {
        const left = w.slice(0, h);
        const right = w.slice(h + 7).replace(/^und/, '');
        const mul = left === '' ? 1 : below100(left);
        const rest = right === '' ? 0 : below100(right);
        if (mul === null || rest === null || mul < 1) return null;
        return mul * 100 + rest;
    }
    return below100(w);
}

const MULT: Record<string, Multiplier> = {
    triple: 3, tripple: 3, trippel: 3, tripel: 3, treble: 3, triebel: 3, tribble: 3, tribel: 3, trippl: 3, tripl: 3,
    triples: 3, dreifach: 3, dreifache: 3, t: 3, tee: 3,
    double: 2, doppel: 2, doppelt: 2, doppelte: 2, dobbel: 2, dopple: 2, doubel: 2, dabble: 2, dobel: 2, dobble: 2,
    dabel: 2, doppl: 2, doubles: 2, d: 2, de: 2,
    single: 1, singel: 1, einfach: 1, einfache: 1, einzel: 1, s: 1,
};
const BULL = new Set(['bull', 'bulle', 'bul', 'bulls', 'bullen']);
const BULLSEYE = new Set(['bullseye', 'bullauge', 'bullsai', 'bullsei']);
const MISS = new Set(['miss', 'mis', 'missed', 'neben', 'daneben', 'vorbei', 'nix', 'nichts', 'fehlwurf', 'kein']);
const UNDO = new Set(['rückgängig', 'rueckgaengig', 'zurück', 'zurueck', 'undo', 'korrektur', 'korrigieren', 'löschen', 'loeschen', 'falsch', 'storno']);
const BUST = new Set(['bust', 'busted', 'überworfen', 'ueberworfen', 'überwurf', 'ueberwurf', 'überschmissen']);
const CHECK = new Set(['check', 'checkout', 'gecheckt', 'ausgecheckt', 'ausgemacht', 'rest', 'game', 'gameshot', 'shot', 'finish']);
const TIMES = new Set(['mal', 'x']);
const NEXT = new Set(['weiter', 'nächster', 'naechster', 'nächste', 'next', 'wechsel', 'fertig']);
const FILLER = new Set([
    'und', 'dann', 'noch', 'der', 'die', 'das', 'den', 'dem', 'ein', 'eine', 'einen', 'punkte', 'punkt', 'ich', 'hab', 'habe', 'hat', 'geworfen', 'wurf', 'würfe', 'darts', 'dart', 'pfeil', 'pfeile', 'mit', 'äh', 'ähm',
    'ehm', 'hm', 'ok', 'okay', 'also', 'bitte', 'jetzt', 'so', 'macht', 'gibt', 'sind', 'ist', 'es', 'aufnahme', 'treffer', 'auf', 'in', 'im', 'feld', 'mein', 'meine', 'letzte', 'letzten', 'nochmal', 'ja',
    'the', 'and', 'a', 'points', 'point', 'nummer', 'zahl',
]);

type Token =
    | { k: 'num'; v: number }
    | { k: 'mult'; v: Multiplier }
    | { k: 'bull'; v: 1 | 2 }
    | { k: 'miss' } | { k: 'undo' } | { k: 'bust' } | { k: 'check' } | { k: 'times' } | { k: 'next' };

export function normalize(text: string): string[] {
    return text
        .toLowerCase()
        .replace(/bull'?s[\s-]?eye/g, 'bullseye')
        .replace(/bulls?\s?auge/g, 'bullauge')
        .replace(/game\s?shot/g, 'gameshot')
        .replace(/(\d+)\s?er\b/g, '$1') // "180er"
        .replace(/(\d+)\s?x\b/g, '$1 x') // "2x"
        .replace(/\b(ein|zwei|drei)mal\b/g, '$1 mal') // "dreimal"
        .replace(/\b([tdsTDS])(\d{1,2})\b/g, '$1 $2') // "T20"
        .replace(/[.,!?;:"„“()/+-]/g, ' ')
        .split(/\s+/)
        .filter(Boolean);
}

function tokenize(words: string[]): Token[] | null {
    const out: Token[] = [];
    for (const w of words) {
        if (FILLER.has(w)) continue;
        if (w in MULT) { out.push({ k: 'mult', v: MULT[w] }); continue; }
        if (BULLSEYE.has(w)) { out.push({ k: 'bull', v: 2 }); continue; }
        if (BULL.has(w)) { out.push({ k: 'bull', v: 1 }); continue; }
        if (MISS.has(w)) { out.push({ k: 'miss' }); continue; }
        if (UNDO.has(w)) { out.push({ k: 'undo' }); continue; }
        if (BUST.has(w)) { out.push({ k: 'bust' }); continue; }
        if (CHECK.has(w)) { out.push({ k: 'check' }); continue; }
        if (TIMES.has(w)) { out.push({ k: 'times' }); continue; }
        if (NEXT.has(w)) { out.push({ k: 'next' }); continue; }
        const n = parseNumberWord(w);
        if (n === null) return null; // unknown word -> ignore whole sentence
        out.push({ k: 'num', v: n });
    }
    // Merge split numbers: "hundert achtzig", "ein hundert vierzig"
    const merged: Token[] = [];
    for (const t of out) {
        const last = merged[merged.length - 1];
        if (t.k === 'num' && last?.k === 'num') {
            if (last.v >= 100 && last.v % 100 === 0 && t.v < 100) { last.v += t.v; continue; }
            if (t.v === 100 && last.v >= 1 && last.v <= 9) { last.v *= 100; continue; }
        }
        merged.push(t);
    }
    return merged;
}

const isSegment = (n: number) => (n >= 0 && n <= 20) || n === 25 || n === 50;

function dartFor(n: number, m: Multiplier): Dart | null {
    if (n === 0) return { s: 0, m: 1 };
    if (n === 50) return m === 1 ? { s: 25, m: 2 } : null;
    if (n === 25) return m === 3 ? null : { s: 25, m };
    if (n >= 1 && n <= 20) return { s: n, m };
    return null;
}

export function parseVoice(text: string, ctx: VoiceContext): VoiceCommand | null {
    const tokens = tokenize(normalize(text));
    if (!tokens || tokens.length === 0) return null;

    const only = (k: Token['k']) => tokens.every(t => t.k === k);
    if (only('undo')) return { type: 'undo' };
    if (only('next')) return { type: 'next' };
    if (tokens.some(t => t.k === 'next')) return null;
    if (tokens.some(t => t.k === 'bust')) return tokens.every(t => t.k === 'bust' || t.k === 'num') && ctx.allowTotal ? { type: 'bust' } : null;
    if (tokens.some(t => t.k === 'check')) {
        // "Check" alone or "Check 40"
        return ctx.allowTotal && tokens.every(t => t.k === 'check' || t.k === 'num') ? { type: 'checkout' } : null;
    }

    // A single plain number: total or single dart depending on context
    if (tokens.length === 1 && tokens[0].k === 'num') {
        const n = tokens[0].v;
        if (ctx.allowTotal && (ctx.mode === 'total' || !isSegment(n))) {
            return n >= 0 && n <= 180 ? { type: 'total', score: n } : null;
        }
        const dart = dartFor(n, 1);
        return dart ? { type: 'darts', darts: [dart] } : null;
    }

    // Sequence of darts: [n mal] [mult] (number | bull | miss)
    const darts: Dart[] = [];
    let mult: Multiplier | null = null;
    let repeat = 1;
    for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i];
        if (t.k === 'times') return null; // "mal" without a count before it
        if (t.k === 'num' && tokens[i + 1]?.k === 'times') {
            if (t.v < 1 || t.v > 3) return null;
            repeat = t.v;
            i++;
            continue;
        }
        if (t.k === 'mult') {
            if (mult !== null) return null;
            mult = t.v;
            continue;
        }
        let dart: Dart | null = null;
        if (t.k === 'num') dart = dartFor(t.v, mult ?? 1);
        else if (t.k === 'bull') dart = mult === 2 ? { s: 25, m: 2 } : mult === 3 ? null : { s: 25, m: t.v };
        else if (t.k === 'miss') dart = mult === null ? { s: 0, m: 1 } : null;
        if (!dart) return null;
        for (let r = 0; r < repeat; r++) darts.push(dart);
        mult = null;
        repeat = 1;
    }
    if (mult !== null || darts.length === 0 || darts.length > 3) return null;
    return { type: 'darts', darts };
}

/** Try every alternative transcript from the recogniser, take the first that parses. */
export function parseAlternatives(alts: string[], ctx: VoiceContext): { command: VoiceCommand; text: string } | null {
    for (const text of alts) {
        const command = parseVoice(text, ctx);
        if (command) return { command, text };
    }
    return null;
}

// ---------------------------------------------------------------------------
// Keyword mode: "Score <bis zu 3 Darts>" and "Total <Summe>".
// The recogniser may deliver one spoken sentence in several pieces, so these
// functions work on the accumulated text and report whether it is complete yet.

const SCORE_WORDS = new Set(['score', 'scores', 'scor', 'skor', 'skore', 'scoore', 'skoor', 'schor', 'sko', 'scorr', 'scoring']);
const TOTAL_WORDS = new Set(['total', 'totaal', 'totale', 'totals', 'summe', 'gesamt', 'insgesamt']);

export type KeywordSegment = { key: 'score' | 'total'; words: string[] };

/** Splits normalised words at the activation words. Words before the first keyword are returned as `lead`. */
export function splitSegments(words: string[]): { lead: string[]; segments: KeywordSegment[] } {
    const lead: string[] = [];
    const segments: KeywordSegment[] = [];
    for (const w of words) {
        if (SCORE_WORDS.has(w)) segments.push({ key: 'score', words: [] });
        else if (TOTAL_WORDS.has(w)) segments.push({ key: 'total', words: [] });
        else if (segments.length) segments[segments.length - 1].words.push(w);
        else lead.push(w);
    }
    return { lead, segments };
}

export type SegmentResult =
    | { status: 'complete'; command: VoiceCommand }
    | { status: 'partial'; command: VoiceCommand } // valid, but more may follow (1–2 darts)
    | { status: 'incomplete' } // e.g. "Triple" without number yet, or nothing said yet
    | { status: 'error'; message: string };

/** "2020" -> 20 20, "20205" -> 20 20 5, "519" -> 5 19 (only for 3+ digits, 2-digit values like 60 stay invalid). */
function splitDigits(n: number): number[] | null {
    const str = String(n);
    if (str.length < 3) return null;
    const out: number[] = [];
    let i = 0;
    while (i < str.length) {
        const two = str.length - i >= 2 ? parseInt(str.slice(i, i + 2), 10) : NaN;
        if (str[i] !== '0' && (two <= 20 || two === 25)) { out.push(two); i += 2; continue; }
        out.push(parseInt(str[i], 10));
        i += 1;
    }
    return out.length <= 3 ? out : null;
}

function unknownWord(words: string[]): string | null {
    for (const w of words) {
        if (FILLER.has(w) || w in MULT || BULL.has(w) || BULLSEYE.has(w) || MISS.has(w) || TIMES.has(w)) continue;
        if (parseNumberWord(w) === null) return w;
    }
    return null;
}

export function evaluateScore(words: string[]): SegmentResult {
    if (words.length === 0) return { status: 'incomplete' };
    const bad = unknownWord(words);
    if (bad) return { status: 'error', message: `„${bad}“ nicht verstanden` };
    const tokens = tokenize(words) ?? [];
    // expand concatenated digits
    const expanded: Token[] = [];
    for (const t of tokens) {
        if (t.k === 'num' && !isSegment(t.v)) {
            const parts = splitDigits(t.v);
            if (!parts) return { status: 'error', message: `${t.v} ist kein Feld – für eine Summe „Total ${t.v}“ sagen` };
            parts.forEach(v => expanded.push({ k: 'num', v }));
        } else expanded.push(t);
    }
    const darts: Dart[] = [];
    let mult: Multiplier | null = null;
    let repeat = 1;
    for (let i = 0; i < expanded.length; i++) {
        const t = expanded[i];
        if (t.k === 'times') continue;
        if (t.k === 'num' && expanded[i + 1]?.k === 'times' && t.v >= 1 && t.v <= 3) { repeat = t.v; i++; continue; }
        if (t.k === 'mult') { mult = t.v; continue; } // a repeated multiplier word just overrides the previous one
        let dart: Dart | null = null;
        if (t.k === 'num') dart = dartFor(t.v, mult ?? 1);
        else if (t.k === 'bull') dart = mult === 2 ? { s: 25, m: 2 } : mult === 3 ? null : { s: 25, m: t.v };
        else if (t.k === 'miss') dart = { s: 0, m: 1 };
        else return { status: 'error', message: 'Befehl mitten in der Ansage' };
        if (!dart) {
            const label = t.k === 'num' ? `${mult === 3 ? 'Triple ' : mult === 2 ? 'Doppel ' : ''}${t.v}` : 'Triple-Bull';
            return { status: 'error', message: `${label} gibt es nicht` };
        }
        for (let r = 0; r < repeat; r++) darts.push(dart);
        mult = null;
        repeat = 1;
    }
    if (darts.length > 3) return { status: 'error', message: 'Mehr als 3 Darts' };
    if (darts.length === 0) return { status: 'incomplete' };
    const command: VoiceCommand = { type: 'darts', darts };
    if (mult !== null) return { status: 'incomplete' }; // "… Doppel" – number still to come
    return darts.length === 3 ? { status: 'complete', command } : { status: 'partial', command };
}

export function evaluateTotal(words: string[]): SegmentResult {
    if (words.length === 0) return { status: 'incomplete' };
    const bad = unknownWord(words.filter(w => !BUST.has(w) && !CHECK.has(w)));
    if (bad) return { status: 'error', message: `„${bad}“ nicht verstanden` };
    const tokens = tokenize(words) ?? [];
    if (tokens.some(t => t.k === 'bust' || t.k === 'miss')) return { status: 'complete', command: { type: 'total', score: 0 } };
    if (tokens.some(t => t.k === 'check')) return { status: 'complete', command: { type: 'checkout' } };
    const nums = tokens.filter((t): t is { k: 'num'; v: number } => t.k === 'num').map(t => t.v);
    if (nums.length === 0) return { status: 'incomplete' };
    let score = nums.length === 1 ? nums[0] : NaN;
    if (nums.length > 1) {
        // "1 40" -> 140 (recogniser split the digits)
        const joined = parseInt(nums.join(''), 10);
        if (joined <= 180) score = joined;
    }
    if (!Number.isFinite(score) || score > 180) return { status: 'error', message: `${nums.join(' ')} ist keine gültige Summe` };
    return { status: 'complete', command: { type: 'total', score } };
}

export function evaluateSegment(seg: KeywordSegment): SegmentResult {
    return seg.key === 'score' ? evaluateScore(seg.words) : evaluateTotal(seg.words);
}

/** Commands that work without an activation word (only if that is all that was said). */
export function parsePlainCommand(text: string): VoiceCommand | null {
    const words = normalize(text).filter(w => !FILLER.has(w));
    if (words.length === 0 || words.length > 2) return null;
    if (words.every(w => UNDO.has(w))) return { type: 'undo' };
    if (words.every(w => NEXT.has(w))) return { type: 'next' };
    if (words.every(w => BUST.has(w))) return { type: 'bust' };
    if (words.every(w => CHECK.has(w))) return { type: 'checkout' };
    return null;
}

export function commandLabel(c: VoiceCommand): string {
    switch (c.type) {
        case 'darts': return c.darts.map(d => (d.s === 0 ? 'Miss' : d.s === 25 ? (d.m === 2 ? 'Bullseye' : 'Bull') : `${d.m === 3 ? 'T' : d.m === 2 ? 'D' : ''}${d.s}`)).join(' · ');
        case 'total': return `Total ${c.score}`;
        case 'undo': return 'Rückgängig';
        case 'bust': return 'Bust';
        case 'checkout': return 'Check';
        case 'next': return 'Weiter';
    }
}
