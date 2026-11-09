import { useEffect, useRef, useState } from 'react';
import { BarChart3, Check, ChevronLeft, Loader2, Mic, MicOff, MoreVertical, Wifi, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Row, Segmented, Sheet, Toast, Toggle } from '@/components/ui/kit';
import { settingsLabel } from '@/components/settings-form';
import { useMatch, useMatchState } from '@/stores/match';
import { usePrefs } from '@/stores/prefs';
import { useOnline } from '@/stores/online';
import { pb } from '@/lib/pocketbase';
import { navigate } from '@/lib/router';
import { keepScreenOn, speak } from '@/lib/device';
import { cn, haptic } from '@/lib/utils';
import { describeFormat, type Multiplier } from '@/game/types';
import { isCheckoutPossible, liveRemaining } from '@/game/x01';
import { suggestCheckout, formatCheckout } from '@/game/checkout';
import { replay, type MatchState } from '@/game/engine';
import { CRICKET_NUMBERS } from '@/game/cricket';
import { CricketBoard, RoundsBoard, VisitStrip, X01Board, pendingTotal } from './boards';
import { roundsTarget } from '@/game/rounds';
import { dartLabel, type Dart } from '@/game/types';
import { parseAlternatives, parseVoice, type VoiceContext } from '@/game/voice';
import { useVoice } from '@/lib/use-voice';
import { DartPad, TotalPad } from './pads';
import { MatchStats } from './stats-table';
import { MatchSummary } from './match-summary';

const X01_NUMBERS = Array.from({ length: 20 }, (_, i) => i + 1);

const completedLegs = (s: MatchState) => s.legs.filter(l => l.winner !== null).length;

export function GameScreen() {
    const active = useMatch(s => s.active);
    const state = useMatchState();
    const { push, undo } = useMatch.getState();
    const prefs = usePrefs();
    const online = useOnline();
    const [error, setError] = useState<string | null>(null);
    const [menu, setMenu] = useState(false);
    const [statsOpen, setStatsOpen] = useState(false);
    const [confirmQuit, setConfirmQuit] = useState(false);
    const [checkoutAsk, setCheckoutAsk] = useState<number | null>(null);
    const [seenLegs, setSeenLegs] = useState(() => (state ? completedLegs(state) : 0));
    const lastVisitCount = useRef<number>(-1);
    const [voiceMsg, setVoiceMsg] = useState<{ ok: boolean; text: string } | null>(null);
    const [voiceHelp, setVoiceHelp] = useState(false);
    const voiceHandler = useRef<(alts: string[]) => void>(() => { });
    const voice = useVoice(alts => voiceHandler.current(alts));

    useEffect(() => {
        if (!voiceMsg) return;
        const t = setTimeout(() => setVoiceMsg(null), 2500);
        return () => clearTimeout(t);
    }, [voiceMsg]);

    useEffect(() => {
        keepScreenOn(prefs.keepAwake);
        return () => keepScreenOn(false);
    }, [prefs.keepAwake]);

    useEffect(() => {
        if (!active) navigate('/', true);
    }, [active]);

    // Score caller: announce each finished visit
    useEffect(() => {
        if (!state || state.kind === 'cricket' || state.kind === 'atc') return;
        const visits = state.legs.reduce((n, l) => n + l.visits.length, 0);
        if (lastVisitCount.current >= 0 && visits > lastVisitCount.current && prefs.caller) {
            const leg = [...state.legs].reverse().find(l => l.visits.length > 0);
            const v = leg?.visits[leg.visits.length - 1];
            if (v && 'bust' in v) speak(v.checkout ? 'Game shot!' : v.bust ? 'No score' : String(v.score));
            else if (v && 'shanghai' in v) speak(v.shanghai ? 'Shanghai!' : String(v.points));
        }
        lastVisitCount.current = visits;
    }, [state, prefs.caller]);

    // Online: close the match on the server once someone won
    useEffect(() => {
        if (state?.winner !== null && active?.onlineId) online.markFinished();
    }, [state?.winner, active?.onlineId, online]);

    /** Total score entry (X01). Opens the "how many darts" sheet for a checkout. */
    function submitTotal(score: number): string | null {
        if (!state || state.kind !== 'x01') return 'Summen gibt es nur bei X01.';
        const rest = state.remaining[state.current];
        if (score === rest && state.settings.outRule !== 'straight' && isCheckoutPossible(score, state.settings.outRule)) {
            if (state.pending.length > 0) return 'Erst die angefangene Aufnahme beenden.';
            setCheckoutAsk(score);
            return null;
        }
        return useMatch.getState().push({ t: 'visit', score });
    }

    function confirmCheckout(darts: number): string | null {
        if (checkoutAsk === null || !state) return null;
        if (suggestCheckout(checkoutAsk, darts, state.settings.outRule) === null) return `${checkoutAsk} geht nicht mit ${darts} ${darts === 1 ? 'Dart' : 'Darts'}.`;
        const score = checkoutAsk;
        setCheckoutAsk(null);
        return useMatch.getState().push({ t: 'visit', score, darts, atDouble: 1 });
    }

    /** Remaining darts of the visit count as misses; with no dart thrown yet the whole visit is 0. */
    function finishVisit(): string | null {
        if (!state || state.winner !== null) return null;
        const missing = 3 - state.pending.length;
        const { push: pushEvent } = useMatch.getState();
        for (let i = 0; i < missing; i++) {
            const err = pushEvent({ t: 'dart', s: 0, m: 1 });
            if (err) return err;
        }
        return null;
    }

    function handleVoice(alts: string[]) {
        if (!state || state.winner !== null || alts.length === 0) return;
        const report = (err: string | null, label: string) => {
            setVoiceMsg(err ? { ok: false, text: err } : { ok: true, text: label });
            haptic(err ? 80 : 25);
        };
        const ctx: VoiceContext = { mode: state.kind === 'x01' ? prefs.inputMode : 'darts', allowTotal: state.kind === 'x01' };

        // Answer to "how many darts?" for a checkout
        if (checkoutAsk !== null) {
            for (const a of alts) {
                const c = parseVoice(a, { mode: 'total', allowTotal: true });
                const n = c?.type === 'total' ? c.score : c?.type === 'darts' && c.darts.length === 1 ? c.darts[0].s : 0;
                if (n >= 1 && n <= 3) return report(confirmCheckout(n), `Checkout mit ${n} ${n === 1 ? 'Dart' : 'Darts'}`);
            }
            return report('Bitte „eins“, „zwei“ oder „drei“ sagen.', '');
        }

        const r = parseAlternatives(alts, ctx);
        if (!r) return report(`„${alts[0]}“ nicht verstanden`, '');
        const c = r.command;
        const { push: pushEvent, undo: undoEvent } = useMatch.getState();
        switch (c.type) {
            case 'next':
                return report(finishVisit(), state.pending.length ? 'Rest als Miss – nächster Spieler' : 'Aufnahme 0 – nächster Spieler');
            case 'undo': {
                const err = undoEvent();
                const a = useMatch.getState().active;
                if (a) setSeenLegs(prev => Math.min(prev, completedLegs(replay(a))));
                return report(err, 'Rückgängig');
            }
            case 'bust':
                if (state.pending.length > 0) return report('Bust wird bei Einzel-Darts automatisch erkannt.', '');
                return report(pushEvent({ t: 'visit', score: 0 }), 'Bust – 0 Punkte');
            case 'checkout':
                if (state.kind !== 'x01') return report('Nur bei X01.', '');
                return report(submitTotal(liveRemaining(state, state.current)), `Check ${liveRemaining(state, state.current)}`);
            case 'total':
                return report(submitTotal(c.score), String(c.score));
            case 'darts': {
                const done: Dart[] = [];
                for (const d of c.darts) {
                    const err = pushEvent({ t: 'dart', s: d.s, m: d.m });
                    if (err) return report(done.length ? `${done.map(dartLabel).join(' · ')} – dann: ${err}` : err, '');
                    done.push(d);
                }
                return report(null, done.map(dartLabel).join(' · '));
            }
        }
    }

    useEffect(() => { voiceHandler.current = handleVoice; });

    if (!active || !state) return null;

    const me = pb.authStore.record?.id;
    const isOnline = !!active.onlineId;
    const myTurn = !isOnline || state.players[state.current]?.userId === me;
    const legDone = completedLegs(state);

    const run = (fn: () => string | null) => {
        const err = fn();
        if (err) { setError(err); haptic(80); }
    };
    const onDart = (s: number, m: Multiplier) => run(() => push({ t: 'dart', s, m }));
    const onUndo = () => {
        run(undo);
        const a = useMatch.getState().active;
        if (a) setSeenLegs(prev => Math.min(prev, completedLegs(replay(a))));
    };
    const onTotal = (score: number) => run(() => submitTotal(score));

    const leave = async () => {
        if (isOnline) await online.leaveMatch(state.winner === null);
        useMatch.getState().close();
        navigate('/', true);
    };

    // ---- finished match
    if (state.winner !== null) {
        return <MatchSummary state={state} record={active} onUndo={isOnline ? undefined : onUndo} onClose={leave} />;
    }

    const showLegSheet = legDone > seenLegs;
    const lastLeg = state.legs[legDone - 1];
    const inputMode = state.kind === 'x01' ? prefs.inputMode : 'darts';
    const x01 = state.kind === 'x01' ? state : null;
    const rest = x01 ? liveRemaining(x01, x01.current) : 0;
    const checkoutHint = x01 && x01.players.length > 2 && rest <= 170
        ? suggestCheckout(rest, 3 - x01.pending.length, x01.settings.outRule) : null;
    const opponent = state.players[state.current]?.name;

    return (
        <div className="flex h-[100dvh] flex-col overflow-hidden">
            <header className="pt-safe flex-none">
                <div className="flex h-12 items-center gap-1 px-1">
                    <button className="flex h-11 w-11 items-center justify-center rounded-full active:bg-accent" onClick={() => navigate('/')} aria-label="Menü">
                        <ChevronLeft className="h-6 w-6" />
                    </button>
                    <div className="min-w-0 flex-1 text-center leading-tight">
                        <div className="truncate text-sm font-semibold">{settingsLabel(state.settings)}</div>
                        <div className="truncate text-[11px] text-muted-foreground">
                            {describeFormat(state.settings)} · Leg {state.progress.legInSet + 1}{state.settings.sets ? ` · Satz ${state.progress.setNumber + 1}` : ''}
                        </div>
                    </div>
                    {isOnline && (online.syncing ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : <Wifi className="h-4 w-4 text-primary" />)}
                    <button
                        className={cn('flex h-11 w-11 items-center justify-center rounded-full active:bg-accent', voice.active && 'bg-destructive text-white active:bg-destructive')}
                        onClick={() => {
                            haptic();
                            if (voice.active) voice.stop();
                            else { voice.start(); setVoiceMsg({ ok: true, text: 'Sag z. B. „Triple 20“ oder „hundert“' }); }
                        }}
                        aria-label="Spracheingabe"
                    >
                        {voice.active ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
                    </button>
                    <button className="flex h-11 w-11 items-center justify-center rounded-full active:bg-accent" onClick={() => setStatsOpen(true)} aria-label="Statistik">
                        <BarChart3 className="h-5 w-5" />
                    </button>
                    <button className="flex h-11 w-11 items-center justify-center rounded-full active:bg-accent" onClick={() => setMenu(true)} aria-label="Optionen">
                        <MoreVertical className="h-5 w-5" />
                    </button>
                </div>
            </header>

            <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col gap-2 px-2 landscape:max-lg:flex-row">
                <div className="no-scrollbar min-h-[96px] flex-[0_1_auto] overflow-y-auto overflow-x-hidden landscape:max-lg:min-h-0 landscape:max-lg:flex-1">
                    {state.kind === 'x01' ? <X01Board state={state} /> : state.kind === 'cricket' ? <CricketBoard state={state} /> : <RoundsBoard state={state} />}
                </div>

                <div className="pb-safe flex flex-[1_0_auto] flex-col gap-2 landscape:max-lg:min-h-0 landscape:max-lg:max-w-[50%] landscape:max-lg:flex-1">
                    {(voice.active || voiceMsg || voice.error) && (
                        <button
                            onClick={() => setVoiceHelp(true)}
                            className={cn(
                                'flex min-h-10 items-center gap-2 rounded-xl px-3 py-2 text-left text-sm',
                                voiceMsg ? (voiceMsg.ok ? 'bg-primary/15 text-primary' : 'bg-destructive/15 text-destructive') : voice.error ? 'bg-destructive/15 text-destructive' : 'bg-muted text-muted-foreground',
                            )}
                        >
                            {voiceMsg ? (voiceMsg.ok ? <Check className="h-4 w-4 flex-none" /> : <X className="h-4 w-4 flex-none" />)
                                : <Mic className={cn('h-4 w-4 flex-none', voice.status === 'listening' && 'animate-pulse text-destructive')} />}
                            <span className="min-w-0 flex-1 truncate">
                                {voiceMsg?.text ?? voice.error ?? (voice.interim ? `„${voice.interim}“` : voice.status === 'paused' ? 'Pause …' : 'Hört zu …')}
                            </span>
                            <span className="flex-none text-xs opacity-60">Hilfe</span>
                        </button>
                    )}
                    {(inputMode === 'darts' || state.pending.length > 0) && (
                        <VisitStrip
                            darts={state.pending}
                            total={state.kind === 'x01' ? pendingTotal(state.pending) : state.kind === 'cricket' ? state.pendingMarks : state.pendingPoints}
                            hint={state.kind === 'cricket' ? 'Marks' : state.kind === 'atc' ? 'Felder' : state.kind !== 'x01' ? 'Punkte' : checkoutHint ? formatCheckout(checkoutHint) : null}
                            onUndo={onUndo}
                        />
                    )}
                    {!myTurn && (
                        <div className="rounded-xl bg-muted px-3 py-2 text-center text-sm text-muted-foreground">
                            {opponent} ist am Zug …
                        </div>
                    )}
                    <div className={cn('flex-1 landscape:max-lg:min-h-0', state.kind === 'cricket' ? 'min-h-[230px] [@media(max-height:700px)]:min-h-[200px]' : 'min-h-[300px] [@media(max-height:700px)]:min-h-[262px]')}>
                        {inputMode === 'darts' ? (
                            <DartPad
                                numbers={state.kind === 'cricket' ? CRICKET_NUMBERS.filter(n => n !== 25) : X01_NUMBERS}
                                highlight={state.kind === 'atc' || state.kind === 'shanghai' ? roundsTarget(state) : null}
                                onDart={onDart}
                                onNext={() => run(finishVisit)}
                                disabled={!myTurn}
                            />
                        ) : (
                            <TotalPad
                                onSubmit={onTotal}
                                onUndo={onUndo}
                                disabled={!myTurn}
                                checkout={x01 && isCheckoutPossible(rest, x01.settings.outRule) ? rest : null}
                            />
                        )}
                    </div>
                </div>
            </div>

            <Toast message={error ?? online.notice} onClose={() => { setError(null); online.clearNotice(); }} />

            {/* Leg finished */}
            <Sheet open={showLegSheet} onClose={() => setSeenLegs(legDone)} title={`Leg an ${lastLeg ? state.players[lastLeg.winner!].name : ''}`} dismissable>
                <LegInfo state={state} legIndex={legDone - 1} />
                <div className="grid grid-cols-2 gap-2 pb-2">
                    <Button variant="secondary" size="xl" onClick={onUndo} disabled={isOnline}>Rückgängig</Button>
                    <Button size="xl" onClick={() => setSeenLegs(legDone)}>Weiter</Button>
                </div>
            </Sheet>

            {/* Checkout darts (total mode) */}
            <Sheet open={checkoutAsk !== null} onClose={() => setCheckoutAsk(null)} title={`Checkout ${checkoutAsk ?? ''} – wie viele Darts?`}>
                <div className="grid grid-cols-3 gap-2 pb-2">
                    {[1, 2, 3].map(n => {
                        const possible = checkoutAsk !== null && suggestCheckout(checkoutAsk, n, state.settings.outRule) !== null;
                        return (
                            <Button key={n} size="xl" className="h-16" disabled={!possible} onClick={() => run(() => confirmCheckout(n))}>
                                {n} {n === 1 ? 'Dart' : 'Darts'}
                            </Button>
                        );
                    })}
                </div>
            </Sheet>

            <Sheet open={voiceHelp} onClose={() => setVoiceHelp(false)} title="Spracheingabe">
                <VoiceHelp kind={state.kind} />
                <Button size="xl" className="my-3 w-full" variant={voice.active ? 'secondary' : 'default'}
                    onClick={() => { setVoiceHelp(false); if (voice.active) voice.stop(); else voice.start(); }}>
                    {voice.active ? 'Spracheingabe aus' : 'Spracheingabe an'}
                </Button>
            </Sheet>

            <Sheet open={statsOpen} onClose={() => setStatsOpen(false)} title="Statistik">
                <div className="pb-2"><MatchStats state={state} /></div>
            </Sheet>

            <Sheet open={menu} onClose={() => setMenu(false)} title="Optionen">
                {state.kind === 'x01' && (
                    <div className="mb-3">
                        <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Eingabe</div>
                        <Segmented value={prefs.inputMode} onChange={inputMode => prefs.set({ inputMode })}
                            options={[{ value: 'darts', label: 'Einzelne Darts' }, { value: 'total', label: 'Summe' }]} />
                        <p className="mt-1 text-xs text-muted-foreground">Doppel/Triple werden nur bei einzelnen Darts gezählt.</p>
                    </div>
                )}
                <Row label="Spracheingabe" hint="Beispiele und Befehle">
                    <Button variant="secondary" size="sm" onClick={() => { setMenu(false); setVoiceHelp(true); }}>Hilfe</Button>
                </Row>
                <Row label="Ansage" hint="Punkte werden vorgelesen"><Toggle checked={prefs.caller} onChange={caller => prefs.set({ caller })} /></Row>
                <Row label="Bildschirm anlassen"><Toggle checked={prefs.keepAwake} onChange={keepAwake => prefs.set({ keepAwake })} /></Row>
                <Button variant="destructive" size="xl" className="my-3 w-full" onClick={() => { setMenu(false); setConfirmQuit(true); }}>
                    Spiel beenden
                </Button>
            </Sheet>

            <Sheet open={confirmQuit} onClose={() => setConfirmQuit(false)} title="Spiel wirklich beenden?">
                <p className="mb-4 text-sm text-muted-foreground">
                    {isOnline ? 'Das Online-Match wird für beide abgebrochen.' : 'Das Spiel wird nicht in der Statistik gespeichert.'}
                </p>
                <div className="grid grid-cols-2 gap-2 pb-2">
                    <Button variant="secondary" size="xl" onClick={() => setConfirmQuit(false)}>Weiterspielen</Button>
                    <Button variant="destructive" size="xl" onClick={leave}>Beenden</Button>
                </div>
            </Sheet>
        </div>
    );
}

function LegInfo({ state, legIndex }: { state: MatchState; legIndex: number }) {
    const leg = state.legs[legIndex];
    if (!leg || leg.winner === null) return null;
    const visits = leg.visits.filter(v => v.player === leg.winner);
    const darts = visits.reduce((n, v) => n + ('dartsUsed' in v ? v.dartsUsed : v.darts.length), 0);
    const last = visits[visits.length - 1];
    const finish = last && 'startScore' in last ? last.startScore : null;
    return (
        <div className={cn('mb-4 grid gap-2 text-center', finish ? 'grid-cols-3' : 'grid-cols-2')}>
            <div className="rounded-2xl bg-card p-3"><div className="text-2xl font-black">{darts}</div><div className="text-xs text-muted-foreground">Darts</div></div>
            {finish !== null && <div className="rounded-2xl bg-card p-3"><div className="text-2xl font-black text-primary">{finish}</div><div className="text-xs text-muted-foreground">Checkout</div></div>}
            <div className="rounded-2xl bg-card p-3">
                <div className="text-2xl font-black">{state.progress.legsWon.join(' : ')}</div>
                <div className="text-xs text-muted-foreground">{state.settings.sets ? `Legs · Sätze ${state.progress.setsWon.join(':')}` : 'Legs'}</div>
            </div>
        </div>
    );
}

function VoiceHelp({ kind }: { kind: MatchState['kind'] }) {
    const rows: [string, string][] = [
        ['„Triple 20, Triple 19, Doppel 12“', 'Bis zu drei Darts auf einmal'],
        ['„T20 T20 D16“, „zwei mal Triple 20“', 'Kurzformen gehen auch'],
        ['„Bull“ / „Bullseye“ (oder „Doppel Bull“)', 'Bull = 25, Bullseye = 50'],
        ['„Daneben“, „Miss“, „Null“', 'Kein Treffer'],
        ['„Rückgängig“, „Zurück“', 'Letzten Dart löschen'],
        ['„Weiter“, „Nächster“', 'Restliche Darts als Miss, nächster Spieler'],
    ];
    if (kind === 'x01') rows.splice(1, 0,
        ['„Hundertvierzig“, „60“', 'Summe der Aufnahme (bei Zahlen über 20 immer)'],
        ['„Check“, „Game shot“', 'Rest ausgecheckt, danach „eins/zwei/drei“ für die Darts'],
        ['„Bust“, „Überworfen“', 'Aufnahme mit 0 Punkten'],
    );
    return (
        <div className="space-y-2 text-sm">
            <p className="text-muted-foreground">
                Mikrofon oben antippen – es hört dauerhaft zu. Sätze mit unbekannten Wörtern werden ignoriert,
                damit normales Reden nicht gezählt wird. Funktioniert am besten in Chrome (Android) und Safari (iPhone), braucht HTTPS und Internet.
            </p>
            <div className="divide-y rounded-2xl border bg-card">
                {rows.map(([say, what]) => (
                    <div key={say} className="px-3 py-2">
                        <div className="font-semibold">{say}</div>
                        <div className="text-xs text-muted-foreground">{what}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}
