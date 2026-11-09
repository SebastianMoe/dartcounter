import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useMemo } from 'react';
import { replay, validateEvent, type MatchRecord, type MatchState } from '@/game/engine';
import { effectiveEvents, normalizeSettings, type GameEvent, type MatchPlayer, type MatchSettings } from '@/game/types';
import { uid } from '@/lib/utils';
import { useHistory } from './history';
import { useOnline } from './online';
import { pb } from '@/lib/pocketbase';
import { shareMatch } from './sync';

interface MatchStore {
    active: MatchRecord | null;
    start: (settings: MatchSettings, players: MatchPlayer[], onlineId?: string, events?: GameEvent[]) => void;
    /** Adds a dart/visit. Returns an error message or null. */
    push: (e: GameEvent) => string | null;
    undo: () => string | null;
    /** Replace the event log (online sync). */
    setEvents: (events: GameEvent[]) => void;
    close: () => void;
}

function persistIfFinished(m: MatchRecord): MatchRecord {
    const state = replay(m);
    if (state.winner === null) return m;
    const done = { ...m, finishedAt: m.finishedAt ?? Date.now() };
    useHistory.getState().save(done);
    return done;
}

export const useMatch = create<MatchStore>()(
    persist(
        (set, get) => ({
            active: null,

            start: (settings, players, onlineId, events = []) => {
                // Online matches keep the server's settings so both sides replay identically
                const s = onlineId ? settings : normalizeSettings(settings);
                set({ active: { id: onlineId ?? uid(), settings: s, players, events, createdAt: Date.now(), onlineId } });
            },

            push: (e) => {
                const m = get().active;
                if (!m) return 'Kein aktives Spiel.';
                const state = replay(m);
                if (m.onlineId) {
                    const me = pb.authStore.record?.id;
                    if (state.players[state.current]?.userId !== me) return 'Dein Gegner ist dran.';
                    e = { ...e, by: me };
                }
                const err = validateEvent(state, e);
                if (err) return err;
                const next = persistIfFinished({ ...m, events: [...m.events, e] });
                set({ active: next });
                if (m.onlineId) useOnline.getState().sendEvent(e, m.events.length);
                return null;
            },

            undo: () => {
                const m = get().active;
                if (!m) return null;
                const eff = effectiveEvents(m.events);
                if (eff.length === 0) return 'Nichts zum Rückgängig machen.';
                if (m.onlineId) {
                    const me = pb.authStore.record?.id;
                    if (eff[eff.length - 1].by !== me) return 'Nur der eigene letzte Wurf kann zurückgenommen werden.';
                    if (m.finishedAt) return 'Das Online-Match ist beendet.';
                    const e: GameEvent = { t: 'undo', by: me };
                    set({ active: { ...m, events: [...m.events, e] } });
                    useOnline.getState().sendEvent(e, m.events.length);
                    return null;
                }
                // Local: simply drop the last event (keeps the log small)
                const events = m.events.slice(0, -1);
                if (m.finishedAt) useHistory.getState().remove(m.id);
                set({ active: { ...m, events, finishedAt: undefined } });
                return null;
            },

            setEvents: (events) => {
                const m = get().active;
                if (!m) return;
                set({ active: persistIfFinished({ ...m, events }) });
            },

            close: () => {
                const m = get().active;
                // Upload when leaving the summary (an undo before that must not be shared)
                if (m?.finishedAt) void shareMatch(m);
                set({ active: null });
            },
        }),
        { name: 'darts-active-match' },
    ),
);

/** Replayed match state, memoised on the event log. */
export function useMatchState(): MatchState | null {
    const active = useMatch(s => s.active);
    return useMemo(() => (active ? replay(active) : null), [active]);
}
