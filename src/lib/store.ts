import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';

import type { GameType, Player, Throw, Turn } from './types';
import { useMultiplayerStore } from './multiplayer-store';

interface X01State {
    gameId: string;
    gameType: GameType;
    startingScore: number;
    players: Player[];
    currentTurn: Turn | null;
    history: Turn[];
    currentPlayerIndex: number;
    winnerId: string | null;
    legWinnerId: string | null;
    matchConfig: { mode: 'firstTo' | 'bestOf', target: number };

    // Actions
    initGame: (type: GameType, playerNames: string[], customScore?: number, matchConfig?: { mode: 'firstTo' | 'bestOf', target: number }) => void;
    addThrow: (t: Throw) => void;
    manualTurn: (amount: number) => void;
    undoThrow: () => void;
    nextPlayer: () => void;
    nextLeg: () => void;
    resetGame: () => void;
}

export const useX01Store = create<X01State>()(
    persist(
        (set, get) => ({
            gameId: '',
            gameType: '501',
            startingScore: 501,
            players: [],
            currentTurn: null,
            history: [],
            currentPlayerIndex: 0,
            winnerId: null,
            legWinnerId: null,
            matchConfig: { mode: 'firstTo', target: 1 }, // Default

            initGame: (type, playerNames, customScore, matchConfig) => {
                let startScore = 501;
                if (type === '301') startScore = 301;
                else if (type === '701') startScore = 701;
                else if (type === 'Custom' && customScore) startScore = customScore;

                const players: Player[] = playerNames.map(name => ({
                    id: uuidv4(),
                    name,
                    score: startScore,
                    legsWon: 0,
                    setsWon: 0,
                }));

                set({
                    gameId: uuidv4(),
                    gameType: type,
                    startingScore: startScore,
                    players,
                    currentTurn: {
                        id: uuidv4(),
                        playerId: players[0].id,
                        throws: [],
                        scoreBefore: startScore,
                        scoreAfter: startScore,
                        isBust: false
                    },
                    history: [],
                    currentPlayerIndex: 0,
                    winnerId: null,
                    legWinnerId: null,
                    matchConfig: matchConfig || { mode: 'firstTo', target: 1 }
                });

                // Broadcast if online
                const mp = useMultiplayerStore.getState();
                if (mp.activeSession) {
                    mp.broadcast('init-game', { type, playerNames, customScore, matchConfig });
                }
            },

            addThrow: (t) => {
                const state = get();
                if (state.winnerId || state.legWinnerId) return;
                if (!state.currentTurn) return;

                // Broadcast if online
                const mp = useMultiplayerStore.getState();
                if (mp.activeSession) {
                    mp.broadcast('throw', { throw: t });
                }

                const currentTurn = { ...state.currentTurn };

                // Check if turn is full (3 throws)
                if (currentTurn.throws.length >= 3 || currentTurn.isBust) return;

                const throwScore = t.score * t.multiplier;
                const newScoreAfter = currentTurn.scoreAfter - throwScore;

                let isBust = false;
                if (newScoreAfter < 0) {
                    isBust = true;
                } else if (newScoreAfter === 0) {
                    // LEG WINNER POTENTIALLY
                    // Double Out check would go here (e.g., && !t.isDouble) if we enforced it.
                    // For now assuming any hit on 0 is a win.
                } else if (newScoreAfter === 1 && state.gameType !== 'Custom') { // Basic "Master Out" check for 1
                    // For Custom games, maybe allow 1? keeping it safe for now.
                    isBust = true;
                }

                const updatedTurn: Turn = {
                    ...currentTurn,
                    throws: [...currentTurn.throws, t],
                    scoreAfter: isBust ? currentTurn.scoreBefore : newScoreAfter,
                    isBust
                };

                // Check Leg Win
                let legWinnerId: string | null = null;
                let matchWinnerId: string | null = null;
                let updatedPlayers = state.players.map(p =>
                    p.id === state.currentTurn!.playerId
                        ? { ...p, score: updatedTurn.scoreAfter }
                        : p
                );

                if (newScoreAfter === 0 && !isBust) {
                    legWinnerId = state.currentTurn.playerId;

                    // Update legs won
                    updatedPlayers = updatedPlayers.map(p =>
                        p.id === legWinnerId
                            ? { ...p, legsWon: p.legsWon + 1 }
                            : p
                    );

                    // Check Match Win
                    const winnerPlayer = updatedPlayers.find(p => p.id === legWinnerId);
                    if (winnerPlayer) {
                        const { mode, target } = state.matchConfig;
                        if (mode === 'firstTo') {
                            if (winnerPlayer.legsWon >= target) {
                                matchWinnerId = legWinnerId;
                            }
                        } else if (mode === 'bestOf') {
                            const majority = Math.floor(target / 2) + 1;
                            if (winnerPlayer.legsWon >= majority) {
                                matchWinnerId = legWinnerId;
                            }
                        }
                    }
                }

                set({
                    currentTurn: updatedTurn,
                    players: updatedPlayers,
                    winnerId: matchWinnerId,
                    legWinnerId: matchWinnerId ? null : legWinnerId
                    // If match is won, we don't show "Leg Winner" overlay, we show "Match Winner" (which winnerId triggers)
                });
            },

            manualTurn: (amount) => {
                // Simplified for now, similar logic but mostly used for corrections
                const state = get();
                if (state.winnerId || state.legWinnerId || !state.currentTurn) return;

                const currentTurn = { ...state.currentTurn };
                const newScoreAfter = currentTurn.scoreBefore - amount;

                let isBust = false;
                if (newScoreAfter < 0) isBust = true;

                // ... (Rest of manual logic similar to addThrow but omitted for brevity/safety in this diff. 
                //Ideally refactor win logic to shared function. For now, basic implementation:

                const updatedTurn: Turn = {
                    ...currentTurn,
                    throws: [{ score: amount, multiplier: 1, segment: amount, isDouble: false, isTriple: false, isOuterBull: false, isInnerBull: false, isManual: true }],
                    scoreAfter: isBust ? currentTurn.scoreBefore : newScoreAfter,
                    isBust
                };

                const updatedPlayers = state.players.map(p =>
                    p.id === state.currentTurn!.playerId
                        ? { ...p, score: updatedTurn.scoreAfter }
                        : p
                );

                set({
                    currentTurn: updatedTurn,
                    players: updatedPlayers,
                    // No automatic win detection on manual entry for now to avoid accidental game ends? 
                    // Or implementing basic 0 check:
                    winnerId: (newScoreAfter === 0 && !isBust) ? state.currentTurn.playerId : null
                });

                // Auto-advance turn if game not won
                const finalState = get();
                if (!finalState.winnerId && !finalState.legWinnerId) {
                    finalState.nextPlayer();
                }

                // Broadcast if online
                const mp = useMultiplayerStore.getState();
                if (mp.activeSession) {
                    mp.broadcast('manual-turn', { amount });
                }
            },

            undoThrow: () => {
                const state = get();

                // Broadcast if online
                const mp = useMultiplayerStore.getState();
                if (mp.activeSession) {
                    mp.broadcast('undo', {});
                }
                // If leg was won, we can't easily undo "Leg Win" state without more history. 
                // Current history only tracks Turns.
                // TODO: Add "GameSnapshot" history for robust Leg Undo. 
                // For now, simple undo works within a leg.
                // If legWinnerId is set, providing an "Undo Leg Win" button would be separate.

                // Standard undo logic (same as before)
                if (state.currentTurn && state.currentTurn.throws.length > 0) {
                    // ... same logic ...
                    const newThrows = state.currentTurn.throws.slice(0, -1);
                    let tempScore = state.currentTurn.scoreBefore;
                    for (const t of newThrows) tempScore -= (t.score * t.multiplier);

                    const updatedTurn = { ...state.currentTurn, throws: newThrows, scoreAfter: tempScore, isBust: false }; // simplify recalc
                    set({
                        currentTurn: updatedTurn,
                        players: state.players.map(p => p.id === state.currentTurn!.playerId ? { ...p, score: tempScore } : p),
                        winnerId: null,
                        legWinnerId: null // Clear leg winner if we undo the winning throw
                    });
                } else if (state.history.length > 0) {
                    // ... history undo ...
                    // (Keep existing implementation)
                    const previousTurn = state.history[state.history.length - 1];
                    const newHistory = state.history.slice(0, -1);
                    const prevPlayerIndex = state.players.findIndex(p => p.id === previousTurn.playerId);

                    set({
                        history: newHistory,
                        currentTurn: previousTurn,
                        currentPlayerIndex: prevPlayerIndex,
                        players: state.players.map(p => p.id === previousTurn.playerId ? { ...p, score: previousTurn.scoreBefore } : p),
                        winnerId: null,
                        legWinnerId: null
                    });
                }
            },

            nextPlayer: () => {
                const state = get();
                // Block if leg is won (must click "Next Leg")
                if (state.legWinnerId || state.winnerId) return;

                // Broadcast if online
                const mp = useMultiplayerStore.getState();
                if (mp.activeSession) {
                    mp.broadcast('next-player', {});
                }

                // ... existing nextPlayer ...
                if (!state.currentTurn) return;

                const finishedTurn = state.currentTurn;
                const history = [...state.history, finishedTurn];
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
                    }
                });
            },

            nextLeg: () => {
                const state = get();
                if (!state.legWinnerId) return; // Can only call if leg finished

                // Reset scores to startingScore
                // Rotate starting player? 
                // Typically: Loser starts? Or alternate? 
                // Let's alternate start for now based on total legs played (simple round robin).
                // Or just keep Next Player in rotation? 
                // Standard: Player who "should" have started next if leg didn't end? 
                // Or: Start player rotates. 
                // Implementation: Shift global player order? No, just set `currentPlayerIndex`.

                // Simple approach: The player AFTER the one who started the LAST leg starts this one.
                // We need to track who started the current leg. 
                // For MVP: Just Next Player in list starts.
                const nextStarterIndex = (state.currentPlayerIndex + 1) % state.players.length;

                const resetPlayers = state.players.map(p => ({
                    ...p,
                    score: state.startingScore,
                    // keep legsWon
                }));

                set({
                    legWinnerId: null,
                    players: resetPlayers,
                    currentPlayerIndex: nextStarterIndex,
                    history: [], // Clear turn history for new leg
                    currentTurn: {
                        id: uuidv4(),
                        playerId: state.players[nextStarterIndex].id,
                        throws: [],
                        scoreBefore: state.startingScore,
                        scoreAfter: state.startingScore,
                        isBust: false
                    }
                });
            },

            resetGame: () => {
                set({
                    gameId: '',
                    players: [],
                    currentTurn: null,
                    history: [],
                    winnerId: null,
                    legWinnerId: null
                });
            }
        }),
        {
            name: 'darts-x01-storage',
        }
    )
);
