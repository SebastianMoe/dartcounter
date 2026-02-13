import { create } from 'zustand';
import { supabase } from './supabase';
import type { PlayerProfile } from './types';

interface AuthState {
    user: any | null;
    profile: PlayerProfile | null;
    loading: boolean;

    // Actions
    signUpWithUsername: (username: string, password: string) => Promise<void>;
    signInWithUsername: (username: string, password: string) => Promise<void>;
    signOut: () => Promise<void>;
    initialize: () => void;
    updateOnlineStatus: (status: 'online' | 'offline' | 'in-game') => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
    user: null,
    profile: null,
    loading: true,

    initialize: async () => {
        const { data: { session } } = await supabase.auth.getSession();

        if (session) {
            const { data: profile } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', session.user.id)
                .maybeSingle();

            if (profile) {
                // Sync to player store so it appears in selection
                import('./player-store').then(({ usePlayerStore }) => {
                    usePlayerStore.getState().syncOnlineProfile(profile as PlayerProfile);
                });
            }

            if (!profile && session.user) {
                // Self-healing: Create profile if missing
                const name = session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'Player';
                const { data: newProfile, error: createError } = await supabase
                    .from('profiles')
                    .upsert({
                        id: session.user.id,
                        name: name,
                        email: session.user.email,
                        onlineStatus: 'online'
                    })
                    .select()
                    .single();

                if (newProfile) {
                    set({ user: session.user, profile: newProfile as PlayerProfile, loading: false });
                    // Sync newly created profile to player store
                    import('./player-store').then(({ usePlayerStore }) => {
                        usePlayerStore.getState().syncOnlineProfile(newProfile as PlayerProfile);
                    });
                } else {
                    console.error("Failed to create missing profile:", createError);
                    set({ user: session.user, profile: null, loading: false });
                }
            } else {
                set({ user: session.user, profile: profile as PlayerProfile, loading: false });
            }
        } else {
            set({ user: null, profile: null, loading: false });
        }

        // Listen for auth changes
        supabase.auth.onAuthStateChange(async (_event, session) => {
            if (session) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', session.user.id)
                    .maybeSingle();

                set({ user: session.user, profile: profile as PlayerProfile });

                if (profile) {
                    import('./player-store').then(({ usePlayerStore }) => {
                        usePlayerStore.getState().syncOnlineProfile(profile as PlayerProfile);
                    });
                }
            } else {
                set({ user: null, profile: null });
            }
        });
    },

    signUpWithUsername: async (username: string, password: string) => {
        set({ loading: true });
        const sanitized = username.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
        if (sanitized.length < 3) throw new Error("Benutzername muss mindestens 3 Zeichen enthalten (a-z, 0-9).");

        const email = `${sanitized}@darts-pwa.com`;

        const { data, error } = await supabase.auth.signUp({
            email,
            password,
        });

        if (error) {
            set({ loading: false });
            throw error;
        }

        if (data.user) {
            await supabase.from('profiles').upsert({
                id: data.user.id,
                name: username,
                email: email,
                onlineStatus: 'online'
            });
        }
        set({ loading: false });
    },

    signInWithUsername: async (username: string, password: string) => {
        set({ loading: true });
        const sanitized = username.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
        const email = `${sanitized}@darts-pwa.com`;

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            set({ loading: false });
            throw error;
        }
        set({ loading: false });
    },

    signOut: async () => {
        const { user } = get();
        if (user) {
            import('./player-store').then(({ usePlayerStore }) => {
                usePlayerStore.getState().removeOnlineProfile(user.id);
            });
        }
        await get().updateOnlineStatus('offline');
        await supabase.auth.signOut();
        set({ user: null, profile: null });
    },

    updateOnlineStatus: async (status) => {
        const { user } = get();
        if (!user) return;

        await supabase
            .from('profiles')
            .update({ onlineStatus: status })
            .eq('id', user.id);
    }
}));
