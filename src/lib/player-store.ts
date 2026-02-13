import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PlayerProfile } from './types';
import { v4 as uuidv4 } from 'uuid';

interface PlayerState {
    profiles: PlayerProfile[];
    activePlayerIds: string[];

    // Actions
    addProfile: (name: string, type: 'local' | 'guest') => void;
    deleteProfile: (id: string) => void;
    togglePlayerSelection: (id: string) => void;
    clearSelection: () => void;
    getProfile: (id: string) => PlayerProfile | undefined;
    resetGuests: () => void;
    syncOnlineProfile: (profile: PlayerProfile) => void;
    removeOnlineProfile: (id: string) => void;
}

export const usePlayerStore = create<PlayerState>()(
    persist(
        (set, get) => ({
            profiles: [],
            activePlayerIds: [],

            addProfile: (name, type) => {
                const newProfile: PlayerProfile = {
                    id: uuidv4(),
                    name,
                    type,
                    createdAt: Date.now(),
                    stats: type === 'local' ? { gamesPlayed: 0, gamesWon: 0 } : undefined
                };

                set((state) => ({
                    profiles: [...state.profiles, newProfile],
                    // Auto-select guests for convenience? 
                    activePlayerIds: type === 'guest' ? [...state.activePlayerIds, newProfile.id] : state.activePlayerIds
                }));
            },

            deleteProfile: (id) => {
                set((state) => ({
                    profiles: state.profiles.filter((p) => p.id !== id),
                    activePlayerIds: state.activePlayerIds.filter((pid) => pid !== id)
                }));
            },

            togglePlayerSelection: (id) => {
                set((state) => {
                    const isSelected = state.activePlayerIds.includes(id);
                    if (isSelected) {
                        return { activePlayerIds: state.activePlayerIds.filter(pid => pid !== id) };
                    } else {
                        return { activePlayerIds: [...state.activePlayerIds, id] };
                    }
                });
            },

            clearSelection: () => set({ activePlayerIds: [] }),

            getProfile: (id) => get().profiles.find(p => p.id === id),

            resetGuests: () => set((state) => ({
                profiles: state.profiles.filter(p => p.type === 'local'),
                activePlayerIds: state.activePlayerIds.filter(id => {
                    const p = state.profiles.find(prof => prof.id === id);
                    return p?.type === 'local';
                })
            })),

            syncOnlineProfile: (profile) => {
                set((state) => {
                    // Check if profile already exists (by ID)
                    const exists = state.profiles.some(p => p.id === profile.id);
                    if (exists) {
                        return {
                            profiles: state.profiles.map(p => p.id === profile.id ? { ...p, ...profile, type: 'local', isOnline: true, onlineId: profile.id } : p)
                        };
                    }
                    // Add new "Online" profile that acts as local
                    const newProfile: PlayerProfile = {
                        ...profile,
                        type: 'local', // Treat as local so it appears in the list
                        isOnline: true,
                        onlineId: profile.id,
                        stats: { gamesPlayed: 0, gamesWon: 0 }
                    };
                    return { profiles: [...state.profiles, newProfile] };
                });
            },

            removeOnlineProfile: (id) => {
                set((state) => ({
                    profiles: state.profiles.filter(p => p.onlineId !== id),
                    activePlayerIds: state.activePlayerIds.filter(pid => {
                        const profile = state.profiles.find(p => p.id === pid);
                        return profile?.onlineId !== id;
                    })
                }));
            }
        }),
        {
            name: 'darts-player-storage-v1', // Force fresh storage
            partialize: (state) => ({ profiles: state.profiles }), // Only persist profiles
        }
    )
);
