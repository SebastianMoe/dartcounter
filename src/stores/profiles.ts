import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { uid } from '@/lib/utils';
import { useHistory } from './history';
import { usePrefs } from './prefs';

export interface Profile {
    id: string;
    name: string;
    createdAt: number;
    /** Linked PocketBase user (own account, online opponent or paired visitor) */
    userId?: string;
    username?: string;
    /** Pairing token of a visitor – allows uploading games to their account */
    linkToken?: string;
    linkExpires?: number;
}

interface EnsureOptions {
    username?: string;
    /** Link an existing unlinked profile with the same name instead of creating a new one */
    adoptByName?: boolean;
    linkToken?: string;
    linkExpires?: number;
}

interface ProfilesState {
    profiles: Profile[];
    add: (name: string) => Profile;
    rename: (id: string, name: string) => void;
    remove: (id: string) => void;
    ensureForUser: (userId: string, name: string, opts?: EnsureOptions) => Profile;
    /** Merge `fromId` into `intoId`: games and selections move over, `fromId` is deleted. */
    merge: (fromId: string, intoId: string) => void;
    unlink: (id: string) => void;
}

// Import profiles from the old app version once (guests are dropped).
function legacyProfiles(): Profile[] {
    try {
        const raw = localStorage.getItem('darts-player-storage-v1');
        if (!raw) return [];
        const old = JSON.parse(raw)?.state?.profiles as { id: string; name: string; type: string; createdAt?: number }[] | undefined;
        return (old ?? [])
            .filter(p => p.type === 'local' && p.name)
            .map(p => ({ id: p.id, name: p.name, createdAt: p.createdAt ?? Date.now() }));
    } catch {
        return [];
    }
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export const useProfiles = create<ProfilesState>()(
    persist(
        (set, get) => ({
            profiles: legacyProfiles(),
            add: (name) => {
                const p: Profile = { id: uid(), name: name.trim(), createdAt: Date.now() };
                set(s => ({ profiles: [...s.profiles, p] }));
                return p;
            },
            rename: (id, name) => set(s => ({ profiles: s.profiles.map(p => (p.id === id ? { ...p, name: name.trim() } : p)) })),
            remove: (id) => set(s => ({ profiles: s.profiles.filter(p => p.id !== id) })),

            ensureForUser: (userId, name, opts = {}) => {
                const patch: Partial<Profile> = { userId, name };
                if (opts.username) patch.username = opts.username;
                if (opts.linkToken) { patch.linkToken = opts.linkToken; patch.linkExpires = opts.linkExpires; }

                let target = get().profiles.find(p => p.userId === userId);
                if (!target && opts.adoptByName) target = get().profiles.find(p => !p.userId && sameName(p.name, name));
                if (target) {
                    const updated = { ...target, ...patch };
                    set(s => ({ profiles: s.profiles.map(p => (p.id === target!.id ? updated : p)) }));
                    return updated;
                }
                const p: Profile = { id: uid(), createdAt: Date.now(), ...patch, name, userId };
                set(s => ({ profiles: [...s.profiles, p] }));
                return p;
            },

            merge: (fromId, intoId) => {
                if (fromId === intoId) return;
                const from = get().profiles.find(p => p.id === fromId);
                const into = get().profiles.find(p => p.id === intoId);
                if (!from || !into) return;
                // Keep the online link of whichever profile has one
                const merged: Profile = into.userId ? into : { ...into, userId: from.userId, username: from.username, linkToken: from.linkToken, linkExpires: from.linkExpires };
                set(s => ({ profiles: s.profiles.filter(p => p.id !== fromId).map(p => (p.id === intoId ? merged : p)) }));

                const history = useHistory.getState();
                useHistory.setState({
                    matches: history.matches.map(m => (m.players.some(p => p.profileId === fromId)
                        ? { ...m, players: m.players.map(p => (p.profileId === fromId ? { ...p, profileId: intoId } : p)) }
                        : m)),
                });
                const prefs = usePrefs.getState();
                prefs.setPlayerIds([...new Set(prefs.playerIds.map(id => (id === fromId ? intoId : id)))]);
            },

            unlink: (id) => set(s => ({
                profiles: s.profiles.map(p => (p.id === id ? { id: p.id, name: p.name, createdAt: p.createdAt } : p)),
            })),
        }),
        { name: 'darts-profiles-v2' },
    ),
);

/** Visitor links are valid for a limited time (set by the server). */
export const hasValidLink = (p: Profile) => !!p.linkToken && (p.linkExpires ?? 0) > Date.now();
