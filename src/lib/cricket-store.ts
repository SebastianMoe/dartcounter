import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import type { Player, Throw, Turn } from './types';
import { useMultiplayerStore } from './multiplayer-store';

interface CricketState {
    gameId: string;
    gameType: 'Cricket';
    players: Player[];
    currentTurn: Turn | null;
    history: Turn[];
    currentPlayerIndex: number;
    winnerId: string | null;
    legWinnerId: string | null;
    matchConfig: { mode: 'firstTo' | 'bestOf', target: number };
    turnSnapshots: Player[][]; // Snapshots of players state BEFORE each throw in current turn

    // Actions
    initGame: (playerNames: string[], matchConfig?: { mode: 'firstTo' | 'bestOf', target: number }) => void;
    addThrow: (t: Throw) => void;
    undoThrow: () => void;
    nextPlayer: () => void;
    resetGame: () => void;
    manualTurn: (amount: number) => void;
}

export const useCricketStore = create<CricketState>()(
    persist(
        (set, get) => ({
            gameId: '',
            gameType: 'Cricket',
            players: [],
            currentTurn: null,
            history: [],
            currentPlayerIndex: 0,
            winnerId: null,
            legWinnerId: null,
            matchConfig: { mode: 'firstTo', target: 1 },
            turnSnapshots: [],

            initGame: (playerNames, matchConfig) => {
                const players: Player[] = playerNames.map(name => ({
                    id: uuidv4(),
                    name,
                    score: 0,
                    legsWon: 0,
                    setsWon: 0,
                    cricketData: { 15: 0, 16: 0, 17: 0, 18: 0, 19: 0, 20: 0, 25: 0 }
                }));

                set({
                    gameId: uuidv4(),
                    gameType: 'Cricket',
                    players,
                    currentTurn: {
                        id: uuidv4(),
                        playerId: players[0].id,
                        throws: [],
                        scoreBefore: 0,
                        scoreAfter: 0,
                        isBust: false
                    },
                    history: [],
                    currentPlayerIndex: 0,
                    winnerId: null,
                    legWinnerId: null,
                    matchConfig: matchConfig || { mode: 'firstTo', target: 1 },
                    turnSnapshots: []
                });
            },

            addThrow: (t) => {
                const state = get();
                if (state.winnerId || state.legWinnerId || !state.currentTurn) return;

                // Broadcast if online
                const mp = useMultiplayerStore.getState();
                if (mp.activeSession) {
                    mp.broadcast('throw', { throw: t });
                }

                const currentTurn = { ...state.currentTurn };
                if (currentTurn.throws.length >= 3) return;

                // Save snapshot before modifications
                const snapshots = [...state.turnSnapshots, state.players];

                const playerId = state.players[state.currentPlayerIndex].id;
                const player = state.players[state.currentPlayerIndex];
                const marks = { ...player.cricketData };
                let pointsGained = 0;

                const segment = t.segment;
                const multiplier = t.multiplier;

                if ((segment >= 15 && segment <= 20) || segment === 25) {
                    const currentMarks = marks[segment] || 0;
                    const totalMarks = currentMarks + multiplier;

                    if (currentMarks < 3) {
                        const newMarks = Math.min(3, totalMarks);
                        marks[segment] = newMarks;

                        if (totalMarks > 3) {
                            const remainingMultiplier = totalMarks - 3;
                            const everyoneElseClosed = state.players.every(p =>
                                p.id === playerId || (p.cricketData && (p.cricketData[segment] ?? 0) >= 3)
                            );

                            if (!everyoneElseClosed) {
                                pointsGained = segment * remainingMultiplier;
                            }
                        }
                    } else {
                        const everyoneElseClosed = state.players.every(p =>
                            p.id === playerId || (p.cricketData && (p.cricketData[segment] ?? 0) >= 3)
                        );
                        if (!everyoneElseClosed) {
                            pointsGained = segment * multiplier;
                        }
                    }
                }

                const updatedPlayers = state.players.map(p =>
                    p.id === playerId
                        ? { ...p, score: p.score + pointsGained, cricketData: marks }
                        : p
                );

                const updatedTurn = {
                    ...currentTurn,
                    throws: [...currentTurn.throws, t],
                    scoreAfter: currentTurn.scoreAfter + pointsGained
                };

                // Check Win Condition
                let matchWinnerId: string | null = null;
                const updatedPlayer = updatedPlayers[state.currentPlayerIndex];
                const allClosed = [15, 16, 17, 18, 19, 20, 25].every(num =>
                    updatedPlayer.cricketData && (updatedPlayer.cricketData[num] ?? 0) >= 3
                );

                if (allClosed) {
                    const hasHighestScore = updatedPlayers.every(p => p.score <= updatedPlayer.score);
                    if (hasHighestScore) {
                        matchWinnerId = playerId;
                    }
                }

                set({
                    players: updatedPlayers,
                    currentTurn: updatedTurn,
                    winnerId: matchWinnerId,
                    turnSnapshots: snapshots
                });
            },

            undoThrow: () => {
                const state = get();

                // 1. If we have throws in current turn, revert to last snapshot
                if (state.currentTurn && state.currentTurn.throws.length > 0) {
                    const lastSnapshot = state.turnSnapshots[state.turnSnapshots.length - 1];
                    const remainingSnapshots = state.turnSnapshots.slice(0, -1);
                    const remainingThrows = state.currentTurn.throws.slice(0, -1);

                    set({
                        players: lastSnapshot,
                        currentTurn: {
                            ...state.currentTurn,
                            throws: remainingThrows,
                            scoreAfter: remainingThrows.reduce((sum, t) => sum + (t.score * t.multiplier), state.currentTurn?.scoreBefore || 0)
                            // Actually scoreAfter in Cricket is complex because of 'everyoneElseClosed' check.
                            // But since we restore players state from snapshot, scoreAfter only matters for visual.
                            // Let's just recalculate from snapshots if needed, but restoring players is key.
                        },
                        turnSnapshots: remainingSnapshots,
                        winnerId: null
                    });

                    // Fixed scoreAfter calculation for visual consistency
                    const updatedState = get();
                    if (updatedState.currentTurn) {
                        const turnPlayer = lastSnapshot[state.currentPlayerIndex];
                        set({
                            currentTurn: {
                                ...updatedState.currentTurn,
                                scoreAfter: turnPlayer.score
                            }
                        });
                    }
                    return;
                }

                // 2. If at turn start, go back to previous turn in history
                if (state.history.length > 0) {
                    const previousTurn = state.history[state.history.length - 1];
                    const prevPlayerIndex = state.players.findIndex(p => p.id === previousTurn.playerId);

                    set({
                        history: state.history.slice(0, -1),
                        currentTurn: previousTurn,
                        currentPlayerIndex: prevPlayerIndex,
                        winnerId: null,
                        turnSnapshots: [] // We don't save per-throw snapshots across turns for now to save storage
                    });
                }
            },

            nextPlayer: () => {
                const state = get();
                if (!state.currentTurn || state.winnerId) return;

                // Broadcast if online
                const mp = useMultiplayerStore.getState();
                if (mp.activeSession) {
                    mp.broadcast('next-player', {});
                }

                const history = [...state.history, state.currentTurn];
                const nextIndex = (state.currentPlayerIndex + 1) % state.players.length;
                const nextPlayer = state.players[nextIndex];

                set({
                    history,
                    currentPlayerIndex: nextIndex,
                    currentTurn: {
                        id: uuidv4(),
                        playerId: nextPlayer.id,
                        throws: [],
                        scoreBefore: nextPlayer.score,
                        scoreAfter: nextPlayer.score,
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
            },

            manualTurn: () => {
                // No-op for Cricket
            }
        }),
        {
            name: 'darts-cricket-storage',
        }
    )
);
