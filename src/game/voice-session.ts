import {
    commandLabel, evaluateSegment, normalize, parsePlainCommand, parseVoice, splitSegments,
    type SegmentResult, type VoiceCommand, type VoiceContext,
} from './voice';

// Collects what the recogniser hears into commands:
//   "Score Triple 20 Triple 20 Doppel 16"  -> three darts (as soon as the third dart is heard)
//   "Score Triple 20" … pause              -> one dart (after `settleMs` without speech)
//   "Total hundertvierzig"                 -> visit total
//   "weiter" / "rückgängig" / "bust" / "check" -> commands without activation word
// Pieces of one sentence that arrive as separate results are joined, and Android's
// cumulative results ("score t20", then "score t20 t20") are not counted twice.

export interface VoiceSessionCallbacks {
    context: () => VoiceContext;
    onCommand: (command: VoiceCommand, label: string) => void;
    onError: (message: string) => void;
    /** Gets the raw alternatives first; return true if they were handled (e.g. a pending question). */
    intercept?: (alternatives: string[]) => boolean;
}

interface Timers {
    setTimeout: (fn: () => void, ms: number) => unknown;
    clearTimeout: (id: unknown) => void;
}

const rank = (r: SegmentResult | null) =>
    !r ? 0 : r.status === 'complete' ? 4 : r.status === 'partial' ? 3 : r.status === 'incomplete' ? 2 : 1;

export class VoiceSession {
    private buffer = '';
    private lastFinal = '';
    private timer: unknown = null;
    private interimText = '';

    private cb: VoiceSessionCallbacks;
    private settleMs: number;
    private timers: Timers;

    constructor(
        cb: VoiceSessionCallbacks,
        settleMs = 1100,
        timers: Timers = { setTimeout: (f, ms) => setTimeout(f, ms), clearTimeout: id => clearTimeout(id as number) },
    ) {
        this.cb = cb;
        this.settleMs = settleMs;
        this.timers = timers;
    }

    /** Call when the recogniser (re)starts: cumulative results start from scratch. */
    newRecognition() {
        this.lastFinal = '';
    }

    reset() {
        this.buffer = '';
        this.interimText = '';
        this.cancelTimer();
    }

    /** Text for the live display */
    get preview(): string {
        return [this.buffer, this.interimText].filter(Boolean).join(' ');
    }

    get waiting(): boolean {
        return this.buffer !== '';
    }

    interim(text: string) {
        this.interimText = text;
        // still speaking -> give the sentence time to finish
        if (this.buffer && text) this.schedule();
    }

    final(alternatives: string[]) {
        this.interimText = '';
        const alts = alternatives.map(a => a.trim()).filter(Boolean);
        if (alts.length === 0) return;
        if (this.cb.intercept?.(alts)) { this.reset(); return; }

        // Android: a new final result may repeat everything said before in this recognition session
        const prev = normalize(this.lastFinal).join(' ');
        this.lastFinal = alts[0];
        const fresh = alts.map(a => {
            const n = normalize(a).join(' ');
            return prev && n.startsWith(prev + ' ') ? n.slice(prev.length + 1) : a;
        });

        // A stand-alone command ("weiter", "rückgängig", …): finish what is pending first, then run it
        const plain = fresh.map(a => parsePlainCommand(a)).find(Boolean);
        if (plain) {
            if (this.buffer) { this.cancelTimer(); this.process(true); }
            this.emit(plain);
            return;
        }

        // Pick the alternative that fits best onto what we already have
        let best = '';
        let bestRank = -1;
        for (const a of fresh) {
            const candidate = this.buffer ? `${this.buffer} ${a}` : a;
            const r = rank(this.lastSegmentResult(candidate));
            if (r > bestRank) { best = candidate; bestRank = r; }
        }
        // Something that doesn't fit the open score (e.g. "Mist!" after "Score 20 20"):
        // enter what was valid so far and treat the new text on its own.
        const pending = this.buffer ? this.lastSegmentResult(this.buffer) : null;
        if (pending?.status === 'partial' && rank(this.lastSegmentResult(best)) === 1) {
            this.cancelTimer();
            this.process(true);
            this.buffer = fresh[0];
            this.process(false);
            return;
        }

        this.buffer = best;
        this.process(false);
    }

    private lastSegmentResult(text: string): SegmentResult | null {
        const { segments } = splitSegments(normalize(text));
        return segments.length ? evaluateSegment(segments[segments.length - 1]) : null;
    }

    private process(settled: boolean) {
        const words = normalize(this.buffer);
        const { segments } = splitSegments(words);

        if (segments.length === 0) {
            const text = this.buffer;
            this.reset();
            const plain = parsePlainCommand(text);
            if (plain) { this.emit(plain); return; }
            // Looks like a score but without activation word -> give a hint, otherwise ignore table talk
            const ctx = this.cb.context();
            const loose = parseVoice(text, ctx);
            if (loose && (loose.type === 'darts' || loose.type === 'total')) {
                this.cb.onError(ctx.allowTotal ? 'Bitte mit „Score …“ (Darts) oder „Total …“ (Summe) beginnen' : 'Bitte mit „Score …“ beginnen');
            }
            return;
        }

        // Every segment except the last one is finished (another keyword followed)
        for (const seg of segments.slice(0, -1)) this.finish(evaluateSegment(seg), seg.key);

        const last = segments[segments.length - 1];
        const result = evaluateSegment(last);
        if (result.status === 'complete') {
            this.reset();
            this.finish(result, last.key);
        } else if (settled) {
            this.reset();
            this.finish(result, last.key);
        } else {
            // keep only the open segment and wait for more speech
            this.buffer = `${last.key} ${last.words.join(' ')}`.trim();
            this.schedule();
        }
    }

    private finish(result: SegmentResult, key: 'score' | 'total') {
        if (result.status === 'complete' || result.status === 'partial') {
            const ctx = this.cb.context();
            if (key === 'total' && !ctx.allowTotal) { this.cb.onError('„Total“ gibt es nur bei X01 – hier „Score …“ sagen'); return; }
            this.emit(result.command);
        } else if (result.status === 'error') {
            this.cb.onError(result.message);
        } else {
            this.cb.onError(key === 'score' ? 'Nach „Score“ fehlen die Darts' : 'Nach „Total“ fehlt die Zahl');
        }
    }

    private emit(c: VoiceCommand) {
        this.cb.onCommand(c, commandLabel(c));
    }

    private schedule() {
        this.cancelTimer();
        this.timer = this.timers.setTimeout(() => {
            this.timer = null;
            if (this.buffer) this.process(true);
        }, this.settleMs);
    }

    private cancelTimer() {
        if (this.timer !== null) this.timers.clearTimeout(this.timer);
        this.timer = null;
    }
}
