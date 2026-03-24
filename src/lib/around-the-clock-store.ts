import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import type { Player, Throw, Turn, ClockConfig } from './types';
import { useMultiplayerStore } from './multiplayer-store';

interface ClockState {
    gameId: string;
    gameType: 'Around the Clock';
    players: Player[];
    currentTurn: Turn | null;
    history: Turn[];
    currentPlayerIndex: number;
    winnerId: string | null;
    config: ClockConfig;
    turnSnapshots: Player[][];

    // Actions
    initGame: (players: { id: string, name: string }[], config?: ClockConfig) => void;
    addThrow: (t: Throw) => void;
    undoThrow: () => void;
    nextPlayer: () => void;
    resetGame: () => void;
}

export const useAroundTheClockStore = create<ClockState>()(
    persist(
        (set, get) => ({
            gameId: '',
            gameType: 'Around the Clock',
            players: [],
            currentTurn: null,
            history: [],
            currentPlayerIndex: 0,
            winnerId: null,
            config: { useSkips: true, finishMode: 'bull' },
            turnSnapshots: [],

            initGame: (selectedPlayers, config) => {
                const players: Player[] = selectedPlayers.map(p => ({
                    id: p.id,
                    name: p.name,
                    score: 0,
                    legsWon: 0,
                    setsWon: 0,
                    hasCheckedIn: true,
                    clockTarget: 1,
                    clockFinished: false
                }));

                const initialConfig = config || { useSkips: true, finishMode: 'bull' };

                set({
                    gameId: uuidv4(),
                    gameType: 'Around the Clock',
                    players,
                    currentTurn: {
                        id: uuidv4(),
                        playerId: players[0].id,
                        throws: [],
                        scoreBefore: 1,
                        scoreAfter: 1,
                        isBust: false
                    },
                    history: [],
                    currentPlayerIndex: 0,
                    winnerId: null,
                    config: initialConfig,
                    turnSnapshots: []
                });
            },

            addThrow: (t) => {
                const state = get();
                if (state.winnerId || !state.currentTurn) return;

                // Broadcast if online
                const mp = useMultiplayerStore.getState();
                if (mp.activeSession) {
                    mp.broadcast('throw', { throw: t });
                }

                if (state.currentTurn.throws.length >= 3) return;

                // Save snapshot
                const snapshots = [...state.turnSnapshots, JSON.parse(JSON.stringify(state.players))];

                const player = state.players[state.currentPlayerIndex];
                let currentTarget = player.clockTarget || 1;
                let clockFinished = player.clockFinished || false;

                const hitTarget = t.segment === currentTarget ||
                    (currentTarget === 21 && (t.isOuterBull || t.isInnerBull)) ||
                    (currentTarget === 22 && t.isInnerBull);

                if (hitTarget && !clockFinished) {
                    if (currentTarget === 21) {
                        // Bull logic
                        if (state.config.finishMode === 'bull' || t.isInnerBull) {
                            clockFinished = true;
                        } else {
                            // Outer + Bull logic
                            currentTarget = 22;
                        }
                    } else if (currentTarget === 22) {
                        clockFinished = true;
                    } else {
                        // Regular number hit
                        let skip = 1;
                        if (state.config.useSkips) {
                            if (t.isDouble) skip = 2;
                            if (t.isTriple) skip = 3;
                        }

                        currentTarget += skip;
                        if (currentTarget > 20) currentTarget = 21; // Reach Bull
                    }
                }

                const updatedPlayers = state.players.map((p, idx) =>
                    idx === state.currentPlayerIndex
                        ? { ...p, clockTarget: currentTarget, clockFinished }
                        : p
                );

                const updatedTurn: Turn = {
                    ...state.currentTurn,
                    throws: [...state.currentTurn.throws, t],
                    scoreAfter: currentTarget // Visual representation of current target
                };

                let winnerId = null;
                if (clockFinished) {
                    winnerId = player.id;
                }

                set({
                    players: updatedPlayers,
                    currentTurn: updatedTurn,
                    turnSnapshots: snapshots,
                    winnerId
                });
            },

            undoThrow: () => {
                const state = get();
                if (state.currentTurn && state.currentTurn.throws.length > 0) {
                    const lastSnapshot = state.turnSnapshots[state.turnSnapshots.length - 1];
                    const remainingSnapshots = state.turnSnapshots.slice(0, -1);
                    const remainingThrows = state.currentTurn.throws.slice(0, -1);

                    set({
                        players: lastSnapshot,
                        currentTurn: {
                            ...state.currentTurn,
                            throws: remainingThrows,
                            scoreAfter: lastSnapshot[state.currentPlayerIndex].clockTarget || 1
                        },
                        turnSnapshots: remainingSnapshots,
                        winnerId: null
                    });
                    return;
                }

                if (state.history.length > 0) {
                    const previousTurn = state.history[state.history.length - 1];
                    const prevPlayerIndex = state.players.findIndex(p => p.id === previousTurn.playerId);

                    set({
                        history: state.history.slice(0, -1),
                        currentTurn: previousTurn,
                        currentPlayerIndex: prevPlayerIndex,
                        winnerId: null,
                        turnSnapshots: previousTurn.cricketSnapshots || [] // Repurposing the field for Around the Clock
                    });
                }
            },

            nextPlayer: () => {
                const state = get();
                if (!state.currentTurn || state.winnerId) return;

                const mp = useMultiplayerStore.getState();
                if (mp.activeSession) mp.broadcast('next-player', {});

                const finishedTurn: Turn = {
                    ...state.currentTurn,
                    cricketSnapshots: JSON.parse(JSON.stringify(state.turnSnapshots))
                };

                const nextIndex = (state.currentPlayerIndex + 1) % state.players.length;
                const nextPlayer = state.players[nextIndex];

                set({
                    history: [...state.history, finishedTurn],
                    currentPlayerIndex: nextIndex,
                    currentTurn: {
                        id: uuidv4(),
                        playerId: nextPlayer.id,
                        throws: [],
                        scoreBefore: nextPlayer.clockTarget || 1,
                        scoreAfter: nextPlayer.clockTarget || 1,
                        isBust: false
                    },
                    turnSnapshots: []
                });
            },

            resetGame: () => {
                set({
                    gameId: '',
                    players: [],
                    currentTurn: null,
                    history: [],
                    winnerId: null,
                    turnSnapshots: []
                });
            }
        }),
        {
            name: 'darts-clock-storage',
        }
    )
);
