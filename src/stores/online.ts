import { create } from 'zustand';
import { pb, pbError, displayName, type UserRecord } from '@/lib/pocketbase';
import { normalizeSettings, type GameEvent, type MatchPlayer, type MatchSettings } from '@/game/types';
import { haptic } from '@/lib/utils';
import { useMatch } from './match';
import { useProfiles } from './profiles';

export interface Invitation {
    id: string;
    from: string;
    to: string;
    settings: MatchSettings;
    status: 'pending' | 'accepted' | 'declined' | 'cancelled';
    match?: string;
    created: string;
    expand?: { from?: UserRecord; to?: UserRecord };
}

interface EventRecord {
    id: string;
    match: string;
    seq: number;
    event: GameEvent;
    by: string;
}

type MatchStatus = 'active' | 'finished' | 'abandoned';

interface OnlineState {
    incoming: Invitation[];
    outgoing: Invitation[];
    notice: string | null;
    matchStatus: MatchStatus | null;
    syncing: boolean;
    init: () => Promise<void>;
    stop: () => void;
    invite: (user: UserRecord, settings: MatchSettings) => Promise<string | null>;
    accept: (inv: Invitation) => Promise<string | null>;
    decline: (inv: Invitation) => Promise<void>;
    cancel: (inv: Invitation) => Promise<void>;
    joinMatch: (matchId: string) => Promise<string | null>;
    sendEvent: (e: GameEvent, seq: number) => Promise<void>;
    resync: () => Promise<void>;
    leaveMatch: (abandon: boolean) => Promise<void>;
    markFinished: () => Promise<void>;
    clearNotice: () => void;
}

const me = () => pb.authStore.record?.id ?? '';
const INVITE_TTL_MS = 2 * 60 * 60 * 1000;
let activeMatchId: string | null = null;

function onVisible() {
    if (document.visibilityState === 'visible' && activeMatchId) useOnline.getState().resync();
}

export const useOnline = create<OnlineState>((set, get) => ({
    incoming: [],
    outgoing: [],
    notice: null,
    matchStatus: null,
    syncing: false,

    init: async () => {
        if (!pb.authStore.isValid) return;
        const uid = me();
        await pb.collection('invitations').unsubscribe();
        const since = new Date(Date.now() - INVITE_TTL_MS).toISOString().replace('T', ' ');
        try {
            const list = await pb.collection('invitations').getFullList<Invitation>({
                filter: pb.filter('status = "pending" && created >= {:since} && (to = {:uid} || from = {:uid})', { since, uid }),
                expand: 'from,to',
                sort: '-created',
            });
            set({ incoming: list.filter(i => i.to === uid), outgoing: list.filter(i => i.from === uid) });
        } catch { /* offline */ }

        pb.collection('invitations').subscribe<Invitation>('*', ({ action, record }) => {
            if (record.to === uid) {
                if (action === 'create' && record.status === 'pending') {
                    haptic(200);
                    set(s => ({ incoming: [record, ...s.incoming.filter(i => i.id !== record.id)] }));
                } else if (record.status !== 'pending' || action === 'delete') {
                    set(s => ({ incoming: s.incoming.filter(i => i.id !== record.id) }));
                }
            }
            if (record.from === uid && action !== 'create') {
                set(s => ({ outgoing: s.outgoing.filter(i => i.id !== record.id) }));
                if (record.status === 'accepted' && record.match) {
                    get().joinMatch(record.match);
                } else if (record.status === 'declined') {
                    set({ notice: `${displayName(record.expand?.to)} hat die Einladung abgelehnt.` });
                }
            }
        }, { expand: 'from,to' }).catch(() => { /* server unreachable – the SDK reconnects on its own */ });
    },

    stop: () => {
        pb.realtime.unsubscribe();
        set({ incoming: [], outgoing: [] });
    },

    invite: async (user, settings) => {
        try {
            const inv = await pb.collection('invitations').create<Invitation>(
                { from: me(), to: user.id, settings: normalizeSettings(settings), status: 'pending' },
                { expand: 'from,to' },
            );
            set(s => ({ outgoing: [inv, ...s.outgoing] }));
            return null;
        } catch (e) {
            return pbError(e);
        }
    },

    accept: async (inv) => {
        try {
            const match = await pb.collection('matches').create({
                host: inv.from,
                guest: me(),
                settings: inv.settings,
                players: [
                    { id: inv.from, userId: inv.from, name: displayName(inv.expand?.from) },
                    { id: me(), userId: me(), name: displayName(pb.authStore.record as UserRecord) },
                ],
                status: 'active',
            });
            await pb.collection('invitations').update(inv.id, { status: 'accepted', match: match.id });
            set(s => ({ incoming: s.incoming.filter(i => i.id !== inv.id) }));
            return get().joinMatch(match.id);
        } catch (e) {
            return pbError(e);
        }
    },

    decline: async (inv) => {
        set(s => ({ incoming: s.incoming.filter(i => i.id !== inv.id) }));
        try { await pb.collection('invitations').update(inv.id, { status: 'declined' }); } catch { /* ignore */ }
    },

    cancel: async (inv) => {
        set(s => ({ outgoing: s.outgoing.filter(i => i.id !== inv.id) }));
        try { await pb.collection('invitations').update(inv.id, { status: 'cancelled' }); } catch { /* ignore */ }
    },

    joinMatch: async (matchId) => {
        try {
            const match = await pb.collection('matches').getOne(matchId);
            const events = await pb.collection('match_events').getFullList<EventRecord>({
                filter: pb.filter('match = {:id}', { id: matchId }),
                sort: 'seq',
            });
            const players = (match.players as MatchPlayer[]).map(p => ({
                ...p,
                profileId: p.userId ? useProfiles.getState().ensureForUser(p.userId, p.name).id : undefined,
            }));
            useMatch.getState().start(match.settings as MatchSettings, players, matchId, events.map(e => e.event));
            activeMatchId = matchId;
            set({ matchStatus: match.status as MatchStatus });

            await pb.collection('match_events').unsubscribe();
            await pb.collection('matches').unsubscribe();
            pb.collection('match_events').subscribe<EventRecord>('*', ({ action, record }) => {
                if (action !== 'create' || record.match !== activeMatchId) return;
                const active = useMatch.getState().active;
                if (!active) return;
                const local = active.events;
                if (record.seq === local.length) {
                    useMatch.getState().setEvents([...local, record.event]);
                } else if (record.seq < local.length && local[record.seq]?.by === record.by && record.by === me()) {
                    // echo of our own event
                } else {
                    get().resync();
                }
            }, { filter: pb.filter('match = {:id}', { id: matchId }) });
            pb.collection('matches').subscribe(matchId, ({ record }) => {
                set({ matchStatus: record.status as MatchStatus });
                if (record.status === 'abandoned') set({ notice: 'Das Match wurde abgebrochen.' });
            });
            document.removeEventListener('visibilitychange', onVisible);
            document.addEventListener('visibilitychange', onVisible);
            return null;
        } catch (e) {
            return pbError(e);
        }
    },

    sendEvent: async (e, seq) => {
        if (!activeMatchId) return;
        try {
            await pb.collection('match_events').create({ match: activeMatchId, seq, event: e, by: me() });
            // The winning event must be stored before the match gets closed.
            if (useMatch.getState().active?.finishedAt) await get().markFinished();
        } catch {
            set({ notice: 'Wurf konnte nicht synchronisiert werden – Stand wurde neu geladen.' });
            await get().resync();
        }
    },

    resync: async () => {
        if (!activeMatchId) return;
        set({ syncing: true });
        try {
            const events = await pb.collection('match_events').getFullList<EventRecord>({
                filter: pb.filter('match = {:id}', { id: activeMatchId }),
                sort: 'seq',
            });
            useMatch.getState().setEvents(events.map(e => e.event));
            const match = await pb.collection('matches').getOne(activeMatchId);
            set({ matchStatus: match.status as MatchStatus });
        } catch { /* offline, try later */ }
        set({ syncing: false });
    },

    leaveMatch: async (abandon) => {
        const id = activeMatchId;
        activeMatchId = null;
        document.removeEventListener('visibilitychange', onVisible);
        set({ matchStatus: null });
        try {
            await pb.collection('match_events').unsubscribe();
            await pb.collection('matches').unsubscribe();
            if (abandon && id) await pb.collection('matches').update(id, { status: 'abandoned' });
        } catch { /* ignore */ }
    },

    markFinished: async () => {
        if (!activeMatchId || get().matchStatus !== 'active') return;
        set({ matchStatus: 'finished' });
        try { await pb.collection('matches').update(activeMatchId, { status: 'finished' }); } catch { /* other side did it */ }
    },

    clearNotice: () => set({ notice: null }),
}));

/** Re-attach to a running online match after a page reload. */
export function resumeOnlineMatch() {
    const active = useMatch.getState().active;
    if (active?.onlineId && !active.finishedAt && pb.authStore.isValid) {
        useOnline.getState().joinMatch(active.onlineId);
    }
}
