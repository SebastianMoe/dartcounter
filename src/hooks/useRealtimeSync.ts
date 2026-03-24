import { useEffect } from 'react';
import { useMultiplayerStore } from '@/lib/multiplayer-store';
import { useX01Store } from '@/lib/store';
import { useCricketStore } from '@/lib/cricket-store';
import { useAuthStore } from '@/lib/auth-store';
import { supabase } from '@/lib/supabase';

export function useRealtimeSync() {
    const { activeSession } = useMultiplayerStore();
    const { addThrow: addX01Throw, nextPlayer: nextX01Player, initGame: initX01 } = useX01Store();
    const { addThrow: addCricketThrow, nextPlayer: nextCricketPlayer, initGame: initCricket } = useCricketStore();
    const { user } = useAuthStore();

    useEffect(() => {
        if (!activeSession || !user) return;

        const channel = supabase.channel(`session:${activeSession.id}`);

        channel
            .on('broadcast', { event: 'throw' }, ({ payload }) => {
                // Ignore our own throws (handled locally)
                if (payload.senderId === user.id) return;

                if (activeSession.game_type === 'Cricket') {
                    addCricketThrow(payload.throw);
                } else {
                    addX01Throw(payload.throw);
                }
            })
            .on('broadcast', { event: 'init-game' }, ({ payload }) => {
                if (payload.senderId === user.id) return;

                const players = payload.playerNames.map((name: string, i: number) => ({
                    id: `remote-${i}`, // Temporary IDs for Guest
                    name
                }));

                if (payload.type === 'Cricket') {
                    initCricket(players, payload.matchConfig, true);
                } else {
                    initX01(payload.type, players, payload.customScore, payload.matchConfig, true);
                }
            })
            .on('broadcast', { event: 'next-player' }, ({ payload }) => {
                if (payload.senderId === user.id) return;

                if (activeSession.game_type === 'Cricket') {
                    nextCricketPlayer();
                } else {
                    nextX01Player();
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [activeSession, user, addX01Throw, addCricketThrow, nextX01Player, nextCricketPlayer]);
}
