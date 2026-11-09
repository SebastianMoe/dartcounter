import { create } from 'zustand';
import { pb, pbError, type UserRecord } from '@/lib/pocketbase';
import { useProfiles } from './profiles';

interface AuthState {
    user: UserRecord | null;
    busy: boolean;
    init: () => void;
    login: (username: string, password: string) => Promise<string | null>;
    register: (username: string, name: string, password: string) => Promise<string | null>;
    updateName: (name: string) => Promise<string | null>;
    logout: () => void;
}

const normalize = (u: string) => u.trim().toLowerCase();
let heartbeat: number | undefined;

function linkProfile(u: UserRecord | null) {
    if (u) useProfiles.getState().ensureForUser(u.id, u.name || u.username, { username: u.username, adoptByName: true });
}

async function touch() {
    const id = pb.authStore.record?.id;
    if (!id || document.visibilityState !== 'visible') return;
    try {
        await pb.collection('users').update(id, { lastSeen: new Date().toISOString() });
    } catch { /* offline */ }
}

export const useAuth = create<AuthState>((set, get) => ({
    user: (pb.authStore.isValid ? pb.authStore.record : null) as UserRecord | null,
    busy: false,

    init: () => {
        pb.authStore.onChange(() => {
            const u = (pb.authStore.isValid ? pb.authStore.record : null) as UserRecord | null;
            set({ user: u });
        });
        if (pb.authStore.isValid) {
            pb.collection('users').authRefresh()
                .then(r => linkProfile(r.record as UserRecord))
                .catch((e) => { if (e?.status === 401 || e?.status === 404) pb.authStore.clear(); });
        }
        window.clearInterval(heartbeat);
        heartbeat = window.setInterval(touch, 60_000);
        document.addEventListener('visibilitychange', touch);
        touch();
    },

    login: async (username, password) => {
        set({ busy: true });
        try {
            const r = await pb.collection('users').authWithPassword(normalize(username), password);
            linkProfile(r.record as UserRecord);
            touch();
            return null;
        } catch (e) {
            return pbError(e);
        } finally {
            set({ busy: false });
        }
    },

    register: async (username, name, password) => {
        set({ busy: true });
        try {
            await pb.collection('users').create({
                username: normalize(username),
                name: name.trim() || username.trim(),
                password,
                passwordConfirm: password,
            });
        } catch (e) {
            set({ busy: false });
            return pbError(e);
        }
        set({ busy: false });
        return get().login(username, password);
    },

    updateName: async (name) => {
        const u = get().user;
        if (!u) return 'Nicht angemeldet.';
        try {
            const r = await pb.collection('users').update(u.id, { name: name.trim() });
            pb.authStore.save(pb.authStore.token, r);
            linkProfile(r as UserRecord);
            return null;
        } catch (e) {
            return pbError(e);
        }
    },

    logout: () => {
        pb.realtime.unsubscribe();
        pb.authStore.clear();
    },
}));
