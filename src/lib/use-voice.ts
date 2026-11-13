import { useCallback, useEffect, useRef, useState } from 'react';
import { onSpeaking } from './device';

// Thin wrapper around the Web Speech API (Chrome/Android, Edge, Safari/iOS).
// - listens continuously and restarts itself (browsers stop after silence)
// - pauses while the app is speaking (score caller)
// - hands all alternatives of a final result to the caller

interface RecognitionAlternative { transcript: string; confidence: number }
interface RecognitionResult { isFinal: boolean; length: number; [i: number]: RecognitionAlternative }
interface RecognitionEvent { resultIndex: number; results: { length: number; [i: number]: RecognitionResult } }
interface Recognition {
    continuous: boolean;
    interimResults: boolean;
    maxAlternatives: number;
    lang: string;
    start(): void;
    stop(): void;
    abort(): void;
    onresult: ((e: RecognitionEvent) => void) | null;
    onerror: ((e: { error: string }) => void) | null;
    onend: (() => void) | null;
    onstart: (() => void) | null;
}
type RecognitionCtor = new () => Recognition;

function getCtor(): RecognitionCtor | null {
    const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
    return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const voiceSupported = () => !!getCtor() && window.isSecureContext;

export type VoiceStatus = 'off' | 'starting' | 'listening' | 'paused' | 'error';

export function useVoice(
    onFinal: (alternatives: string[]) => void,
    extra: { onInterim?: (text: string) => void; onStart?: () => void } = {},
) {
    const [status, setStatus] = useState<VoiceStatus>('off');
    const [interim, setInterim] = useState('');
    const [error, setError] = useState<string | null>(null);
    const rec = useRef<Recognition | null>(null);
    const wanted = useRef(false);
    const paused = useRef(false);
    const restarts = useRef<number[]>([]);
    const lastFinal = useRef({ text: '', at: 0 });
    const handler = useRef(onFinal);
    const extraRef = useRef(extra);
    useEffect(() => { handler.current = onFinal; extraRef.current = extra; });

    // Dev only: simulate recognised speech from the console, e.g. __say('triple 20')
    useEffect(() => {
        if (!import.meta.env.DEV) return;
        const w = window as unknown as { __say?: (...alts: string[]) => void };
        const wi = window as unknown as { __interim?: (t: string) => void };
        w.__say = (...alts) => handler.current(alts);
        wi.__interim = (t) => extraRef.current.onInterim?.(t);
        return () => { delete w.__say; delete wi.__interim; };
    }, []);

    const startRec = useCallback(() => {
        const r = rec.current;
        if (!r || !wanted.current || paused.current) return;
        // Avoid a restart storm if the browser keeps ending immediately
        const now = Date.now();
        restarts.current = restarts.current.filter(t => now - t < 10_000);
        if (restarts.current.length > 8) {
            wanted.current = false;
            setStatus('error');
            setError('Spracherkennung startet nicht stabil – bitte erneut antippen.');
            return;
        }
        restarts.current.push(now);
        try { r.start(); } catch { /* already running */ }
    }, []);

    const ensure = useCallback(() => {
        if (rec.current) return rec.current;
        const Ctor = getCtor();
        if (!Ctor) return null;
        const r = new Ctor();
        r.lang = 'de-DE';
        r.continuous = true;
        r.interimResults = true;
        r.maxAlternatives = 4;
        r.onstart = () => { setStatus('listening'); setError(null); extraRef.current.onStart?.(); };
        r.onresult = (e) => {
            let interimText = '';
            for (let i = e.resultIndex; i < e.results.length; i++) {
                const res = e.results[i];
                if (res.isFinal) {
                    const alts: string[] = [];
                    for (let a = 0; a < res.length; a++) alts.push(res[a].transcript.trim());
                    const key = alts[0]?.toLowerCase() ?? '';
                    const now = Date.now();
                    // Android Chrome sometimes delivers the same final result twice
                    if (key && !(key === lastFinal.current.text && now - lastFinal.current.at < 1500)) {
                        lastFinal.current = { text: key, at: now };
                        handler.current(alts.filter(Boolean));
                    }
                } else {
                    interimText += res[0].transcript;
                }
            }
            setInterim(interimText);
            extraRef.current.onInterim?.(interimText);
        };
        r.onerror = (e) => {
            if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
                wanted.current = false;
                setStatus('error');
                setError('Mikrofon nicht erlaubt. Bitte in den Browser-Einstellungen freigeben.');
            } else if (e.error === 'network') {
                setError('Spracherkennung braucht eine Internetverbindung.');
            } else if (e.error === 'audio-capture') {
                wanted.current = false;
                setStatus('error');
                setError('Kein Mikrofon gefunden.');
            }
            // 'no-speech' / 'aborted': handled by onend restart
        };
        r.onend = () => {
            setInterim('');
            if (wanted.current && !paused.current) {
                setTimeout(startRec, 250);
            } else {
                setStatus(wanted.current ? 'paused' : status => (status === 'error' ? 'error' : 'off'));
            }
        };
        rec.current = r;
        return r;
    }, [startRec]);

    const start = useCallback(() => {
        if (!voiceSupported()) {
            setStatus('error');
            setError(window.isSecureContext ? 'Dieser Browser unterstützt keine Spracherkennung.' : 'Spracheingabe braucht HTTPS.');
            return;
        }
        ensure();
        wanted.current = true;
        paused.current = false;
        restarts.current = [];
        setError(null);
        setStatus('starting');
        startRec();
    }, [ensure, startRec]);

    const stop = useCallback(() => {
        wanted.current = false;
        setStatus('off');
        setInterim('');
        try { rec.current?.abort(); } catch { /* ignore */ }
    }, []);

    // Pause while the app speaks
    useEffect(() => onSpeaking((speaking) => {
        if (!wanted.current) return;
        paused.current = speaking;
        if (speaking) {
            setStatus('paused');
            try { rec.current?.abort(); } catch { /* ignore */ }
        } else {
            startRec();
        }
    }), [startRec]);

    // Stop when leaving the screen; pause in background
    useEffect(() => {
        const onVis = () => {
            if (!wanted.current) return;
            if (document.visibilityState === 'hidden') {
                paused.current = true;
                try { rec.current?.abort(); } catch { /* ignore */ }
            } else {
                paused.current = false;
                startRec();
            }
        };
        document.addEventListener('visibilitychange', onVis);
        return () => {
            document.removeEventListener('visibilitychange', onVis);
            wanted.current = false;
            try { rec.current?.abort(); } catch { /* ignore */ }
        };
    }, [startRec]);

    return { status, interim, error, start, stop, active: status !== 'off' && status !== 'error' };
}
