import { create } from 'zustand';
import { supabase } from './supabase';
import { useAuthStore } from './auth-store';
import type { GameType, MatchConfig } from './types';

interface MultiplayerStore {
    invitations: any[];
    activeSession: any | null;

    // Actions
    sendInvitation: (targetId: string, gameType: GameType, config: MatchConfig) => Promise<void>;
    acceptInvitation: (invitationId: string) => Promise<void>;
    declineInvitation: (invitationId: string) => Promise<void>;
    initialize: () => void;
    joinSession: (session: any) => void;
    broadcast: (event: string, payload: any) => void;
}

export const useMultiplayerStore = create<MultiplayerStore>((set) => ({
    invitations: [],
    activeSession: null,

    initialize: () => {
        const { user } = useAuthStore.getState();
        if (!user) return;

        // Listen for new invitations
        supabase
            .channel('lobby')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'game_invitations',
                filter: `target_id=eq.${user.id}`
            }, (payload) => {
                set(state => ({ invitations: [...state.invitations, payload.new] }));
            })
        // Listen for status changes on invitations we sent (as host)
        supabase
            .channel('invitations_sent')
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'game_invitations',
                filter: `host_id=eq.${user.id}`
            }, (payload) => {
                if (payload.new.status === 'accepted') {
                    useMultiplayerStore.getState().joinSession(payload.new);
                }
            })
            .subscribe();
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
        useMultiplayerStore.getState().joinSession(updatedInv);
    },

    declineInvitation: async (invitationId) => {
        await supabase
            .from('game_invitations')
            .update({ status: 'declined' })
            .eq('id', invitationId);

        set(state => ({ invitations: state.invitations.filter(i => i.id !== invitationId) }));
    },

    joinSession: (session) => {
        set({ activeSession: session, invitations: [] });
    },

    broadcast: (event, payload) => {
        const { activeSession } = useMultiplayerStore.getState();
        if (!activeSession) return;

        supabase
            .channel(`session:${activeSession.id}`)
            .send({
                type: 'broadcast',
                event: event,
                payload: {
                    ...payload,
                    senderId: useAuthStore.getState().user?.id
                }
            });
    }
}));
