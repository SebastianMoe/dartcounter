import { create } from 'zustand';
import { supabase } from './supabase';
import { useAuthStore } from './auth-store';
import type { GameType, MatchConfig } from './types';

interface MultiplayerStore {
    invitations: any[];
    activeSession: any | null;
    onlineUsers: any[];
    channel: any | null;

    // Actions
    sendInvitation: (targetId: string, gameType: GameType, config: MatchConfig) => Promise<void>;
    acceptInvitation: (invitationId: string) => Promise<void>;
    declineInvitation: (invitationId: string) => Promise<void>;
    initialize: () => void;
    joinSession: (session: any) => void;
    leaveSession: () => void;
    broadcast: (event: string, payload: any) => void;
    onBroadcast: (event: string, callback: (payload: any) => void) => () => void;
}

export const useMultiplayerStore = create<MultiplayerStore>((set, get) => ({
    invitations: [],
    activeSession: null,
    onlineUsers: [],
    channel: null,

    initialize: () => {
        const { user } = useAuthStore.getState();
        if (!user) return;

        // Presence & Global Lobby
        const channel = supabase.channel('lobby', {
            config: {
                presence: {
                    key: user.id,
                },
            },
        });

        channel
            .on('presence', { event: 'sync' }, () => {
                const newState = channel.presenceState();
                set({ onlineUsers: Object.values(newState).flat() });
            })
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'game_invitations',
                filter: `target_id=eq.${user.id}`
            }, (payload) => {
                set(state => ({ invitations: [...state.invitations, payload.new] }));
            })
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'game_invitations',
                filter: `host_id=eq.${user.id}`
            }, (payload) => {
                if (payload.new.status === 'accepted') {
                    get().joinSession(payload.new);
                }
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await channel.track({
                        id: user.id,
                        name: useAuthStore.getState().profile?.name || 'Unknown',
                        online_at: new Date().toISOString(),
                    });
                }
            });

        set({ channel });
    },

    sendInvitation: async (targetId, gameType, config) => {
        const { user } = useAuthStore.getState();
        if (!user) return;

        const { error } = await supabase
            .from('game_invitations')
            .insert({
                host_id: user.id,
                target_id: targetId,
                game_type: gameType,
                config: config,
                status: 'pending'
            });

        if (error) throw error;
    },

    acceptInvitation: async (invitationId) => {
        const { data: updatedInv, error } = await supabase
            .from('game_invitations')
            .update({ status: 'accepted' })
            .eq('id', invitationId)
            .select()
            .single();

        if (error) throw error;
        get().joinSession(updatedInv);
    },

    declineInvitation: async (invitationId) => {
        await supabase
            .from('game_invitations')
            .update({ status: 'declined' })
            .eq('id', invitationId);

        set(state => ({ invitations: state.invitations.filter(i => i.id !== invitationId) }));
    },

    joinSession: (session) => {
        // Cleanup old session channel if exists
        const oldChannel = get().channel;
        if (oldChannel && oldChannel.topic.startsWith('session:')) {
            oldChannel.unsubscribe();
        }

        const sessionChannel = supabase.channel(`session:${session.id}`);

        sessionChannel.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                console.log('Joined real-time session:', session.id);
            }
        });

        set({ activeSession: session, invitations: [], channel: sessionChannel });
    },

    leaveSession: () => {
        const { channel } = get();
        if (channel) channel.unsubscribe();
        set({ activeSession: null, channel: null });
        get().initialize(); // Go back to lobby
    },

    broadcast: (event, payload) => {
        const { channel } = get();
        if (!channel) return;

        channel.send({
            type: 'broadcast',
            event: event,
            payload: {
                ...payload,
                senderId: useAuthStore.getState().user?.id
            }
        });
    },

    onBroadcast: (event, callback) => {
        const { channel } = get();
        if (!channel) return () => { };

        channel.on('broadcast', { event }, (payload: any) => {
            callback(payload.payload);
        });

        return () => {
            // Channel handles internal cleanup, but we can't easily remove a specific listener
            // without rebuilding the channel or using a wrapper. 
            // supabase-js channels are somewhat persistent until unsubscribe.
        };
    }
}));
