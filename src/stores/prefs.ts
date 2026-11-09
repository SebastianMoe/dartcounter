import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { MatchSettings } from '@/game/types';

export type InputMode = 'darts' | 'total';

export const DEFAULT_SETTINGS: MatchSettings = {
    kind: 'x01',
    startScore: 501,
    inRule: 'straight',
    outRule: 'double',
    format: 'firstTo',
    legs: 3,
    sets: 0,
    cricketMode: 'cutthroat',
};

interface PrefsState {
    settings: MatchSettings;
    playerIds: string[];
    inputMode: InputMode;
    haptics: boolean;
    caller: boolean;
    keepAwake: boolean;
    setSettings: (s: MatchSettings) => void;
    setPlayerIds: (ids: string[]) => void;
    set: (p: Partial<Pick<PrefsState, 'inputMode' | 'haptics' | 'caller' | 'keepAwake'>>) => void;
}

export const usePrefs = create<PrefsState>()(
    persist(
        (set) => ({
            settings: DEFAULT_SETTINGS,
            playerIds: [],
            inputMode: 'darts',
            haptics: true,
            caller: false,
            keepAwake: true,
            setSettings: (settings) => set({ settings }),
            setPlayerIds: (playerIds) => set({ playerIds }),
            set: (p) => {
                if (p.haptics !== undefined) localStorage.setItem('darts-haptics', p.haptics ? 'on' : 'off');
                set(p);
            },
        }),
        { name: 'darts-prefs' },
    ),
);
