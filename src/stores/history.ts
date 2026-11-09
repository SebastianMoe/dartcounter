import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { MatchRecord } from '@/game/engine';

const MAX_MATCHES = 500;

interface HistoryState {
    matches: MatchRecord[];
    /** Match ids already uploaded to the players' online accounts */
    shared: Record<string, true>;
    save: (m: MatchRecord) => void;
    remove: (id: string) => void;
    markShared: (id: string) => void;
}

export const useHistory = create<HistoryState>()(
    persist(
        (set) => ({
            matches: [],
            shared: {},
            save: (m) => set(s => ({
                matches: [m, ...s.matches.filter(x => x.id !== m.id)]
                    .sort((a, b) => (b.finishedAt ?? b.createdAt) - (a.finishedAt ?? a.createdAt))
                    .slice(0, MAX_MATCHES),
            })),
            remove: (id) => set(s => ({ matches: s.matches.filter(m => m.id !== id) })),
            markShared: (id) => set(s => ({ shared: { ...s.shared, [id]: true } })),
        }),
        { name: 'darts-history' },
    ),
);
