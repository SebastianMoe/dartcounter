import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';

import type { GameType, Player, Throw, Turn, MatchConfig } from './types';
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
    matchConfig: MatchConfig;
    showCheckoutPrompt: { playerId: string, maxDarts: number, wasFinish: boolean } | null;

    // Actions
    initGame: (type: GameType, players: { id: string, name: string }[], customScore?: number, matchConfig?: MatchConfig, isRemote?: boolean) => void;
    addThrow: (t: Throw) => void;
    manualTurn: (amount: number) => void;
    undoThrow: () => void;
    nextPlayer: () => void;
    nextLeg: () => void;
    rematch: () => void;
    submitCheckoutAttempts: (count: number) => void;
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
            matchConfig: { mode: 'firstTo', target: 1, outMode: 'double' },
            showCheckoutPrompt: null,

            initGame: (type, selectedPlayers, customScore, matchConfig, isRemote) => {
                let startScore = 501;
                if (type === '301') startScore = 301;
                else if (type === '701') startScore = 701;
                else if (type === 'Custom' && customScore) startScore = customScore;

                const players: Player[] = selectedPlayers.map(p => ({
                    id: p.id,
                    name: p.name,
                    score: startScore,
                    legsWon: 0,
                    setsWon: 0,
                    hasCheckedIn: (matchConfig?.inMode || 'single') === 'single',
                    checkoutAttempts: 0,
                    highFinish: 0,
                    first9Scores: []
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
                    matchConfig: matchConfig || { mode: 'firstTo', target: 1, outMode: 'double', inMode: 'single', lengthType: 'legs' }
                });

                // Broadcast if online and NOT a remote initialization
                const mp = useMultiplayerStore.getState();
                if (mp.activeSession && !isRemote) {
                    mp.broadcast('init-game', { type, playerNames: selectedPlayers.map(p => p.name), customScore, matchConfig });
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

                const currentPlayer = state.players.find(p => p.id === state.currentTurn!.playerId)!;
                let hasCheckedIn = currentPlayer.hasCheckedIn;
                let throwEffectScore = t.score * t.multiplier;

                // CHECK IN LOGIC
                if (!hasCheckedIn) {
                    const inMode = state.matchConfig.inMode || 'single';
                    if (inMode === 'double') {
                        if (t.isDouble) hasCheckedIn = true;
                        else throwEffectScore = 0;
                    } else if (inMode === 'master') {
                        if (t.isDouble || t.isTriple) hasCheckedIn = true;
                        else throwEffectScore = 0;
                    } else {
                        hasCheckedIn = true;
                    }
                }

                const newScoreAfter = currentTurn.scoreAfter - throwEffectScore;

                let isBust = false;
                if (newScoreAfter < 0) {
                    isBust = true;
                } else if (newScoreAfter === 0) {
                    // Out-mode check (Double Out / Master Out)
                    const outMode = state.matchConfig.outMode || 'double';
                    if (outMode === 'double' && !t.isDouble) isBust = true;
                    else if (outMode === 'master' && !t.isDouble && !t.isTriple) isBust = true;
                } else if (newScoreAfter === 1) {
                    // Cannot finish with 1 if double/master out is active
                    const outMode = state.matchConfig.outMode || 'double';
                    if (outMode !== 'single') isBust = true;
                }

                const updatedTurn: Turn = {
                    ...currentTurn,
                    throws: [...currentTurn.throws, t],
                    scoreAfter: isBust ? currentTurn.scoreBefore : newScoreAfter,
                    isBust
                };

                let legWinnerId: string | null = null;
                let matchWinnerId: string | null = null;

                // Track state changes to players
                let updatedPlayers = state.players.map(p => {
                    if (p.id === state.currentTurn!.playerId) {
                        const isFirstFinish = newScoreAfter === 0 && !isBust;
                        const isManual = t.isManual;
                        // For single darts, we check the score BEFORE the dart was thrown
                        const inCheckoutRange = currentTurn.scoreAfter <= 50;

                        return {
                            ...p,
                            score: isBust ? p.score : newScoreAfter,
                            hasCheckedIn: isBust ? p.hasCheckedIn : hasCheckedIn,
                            // Automatic tracking for single-dart entry
                            checkoutAttempts: (!isManual && inCheckoutRange)
                                ? (p.checkoutAttempts || 0) + 1
                                : (p.checkoutAttempts || 0),
                            highFinish: isFirstFinish ? Math.max(p.highFinish || 0, currentTurn.scoreBefore) : (p.highFinish || 0)
                        };
                    }
                    return p;
                });

                if (newScoreAfter === 0 && !isBust) {
                    legWinnerId = state.currentTurn.playerId;
                    // ... (Sets/Legs logic)
                    const winnerPlayer = updatedPlayers.find(p => p.id === legWinnerId)!;
                    const isSets = state.matchConfig.lengthType === 'sets';
                    const target = state.matchConfig.target;
                    const mode = state.matchConfig.mode;

                    if (isSets) {
                        winnerPlayer.legsWon += 1;
                        if (winnerPlayer.legsWon >= 2) {
                            winnerPlayer.setsWon += 1;
                            updatedPlayers = updatedPlayers.map(p => ({ ...p, legsWon: 0 }));
                            const winSetsNeeded = mode === 'firstTo' ? target : Math.floor(target / 2) + 1;
                            if (winnerPlayer.setsWon >= winSetsNeeded) matchWinnerId = legWinnerId;
                        }
                    } else {
                        winnerPlayer.legsWon += 1;
                        const winLegsNeeded = mode === 'firstTo' ? target : Math.floor(target / 2) + 1;
                        if (winnerPlayer.legsWon >= winLegsNeeded) matchWinnerId = legWinnerId;
                    }

                    // TRIGGER PROMPT ONLY ON MANUAL FINISH
                    if (t.isManual) {
                        set({
                            showCheckoutPrompt: {
                                playerId: state.currentTurn.playerId,
                                maxDarts: 3 - currentTurn.throws.length,
                                wasFinish: true
                            }
                        });
                    }
                }

                set({
                    currentTurn: updatedTurn,
                    players: updatedPlayers,
                    winnerId: matchWinnerId,
                    legWinnerId: matchWinnerId ? null : legWinnerId
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

                const isFinish = newScoreAfter === 0 && !isBust;
                let legWinnerId: string | null = null;
                let matchWinnerId: string | null = null;

                if (isFinish) {
                    legWinnerId = state.currentTurn.playerId;
                    // Trigger set/leg win logic (refactored or duplicated for now)
                    const winnerPlayer = updatedPlayers.find(p => p.id === legWinnerId)!;
                    const isSets = state.matchConfig.lengthType === 'sets';
                    const target = state.matchConfig.target;
                    const mode = state.matchConfig.mode;

                    if (isSets) {
                        winnerPlayer.legsWon += 1;
                        if (winnerPlayer.legsWon >= 2) {
                            winnerPlayer.setsWon += 1;
                            updatedPlayers.forEach(p => p.legsWon = 0);
                            const winSetsNeeded = mode === 'firstTo' ? target : Math.floor(target / 2) + 1;
                            if (winnerPlayer.setsWon >= winSetsNeeded) matchWinnerId = legWinnerId;
                        }
                    } else {
                        winnerPlayer.legsWon += 1;
                        const winLegsNeeded = mode === 'firstTo' ? target : Math.floor(target / 2) + 1;
                        if (winnerPlayer.legsWon >= winLegsNeeded) matchWinnerId = legWinnerId;
                    }

                    // TRIGGER PROMPT ON MANUAL FINISH
                    set({
                        showCheckoutPrompt: {
                            playerId: state.currentTurn.playerId,
                            maxDarts: 3, // assume 3 available if manual
                            wasFinish: true
                        }
                    });
                }

                set({
                    currentTurn: updatedTurn,
                    players: updatedPlayers,
                    winnerId: matchWinnerId,
                    legWinnerId: matchWinnerId ? null : legWinnerId
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
                if (state.legWinnerId || state.winnerId) return;

                const finishedTurn = state.currentTurn;
                if (!finishedTurn) return;

                const isManual = finishedTurn.throws.some(th => th.isManual);
                const wasInCheckoutRange = finishedTurn.scoreBefore <= 50;

                // TRIGGER PROMPT on turn end ONLY if manual entry and in checkout range
                if (isManual && wasInCheckoutRange && finishedTurn.scoreAfter > 0) {
                    set({
                        showCheckoutPrompt: {
                            playerId: finishedTurn.playerId,
                            maxDarts: 3,
                            wasFinish: false
                        }
                    });
                }

                // Broadcast if online
                const mp = useMultiplayerStore.getState();
                if (mp.activeSession) {
                    mp.broadcast('next-player', {});
                }

                const history = [...state.history, finishedTurn];

                // First 9 Tracking
                const playerHistoryInLeg = history.filter(h => h.playerId === finishedTurn.playerId);
                const updatedPlayers = state.players.map(p => {
                    if (p.id === finishedTurn.playerId && playerHistoryInLeg.length <= 3) {
                        const turnScore = finishedTurn.scoreBefore - finishedTurn.scoreAfter;
                        return {
                            ...p,
                            first9Scores: [...(p.first9Scores || []), turnScore]
                        };
                    }
                    return p;
                });

                const nextIndex = (state.currentPlayerIndex + 1) % state.players.length;
                const nextPlayer = updatedPlayers[nextIndex];

                set({
                    history,
                    players: updatedPlayers,
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
                if (!state.legWinnerId) return;

                const nextStarterIndex = (state.currentPlayerIndex + 1) % state.players.length;

                const resetPlayers = state.players.map(p => ({
                    ...p,
                    score: state.startingScore,
                    hasCheckedIn: (state.matchConfig.inMode || 'single') === 'single'
                }));

                set({
                    legWinnerId: null,
                    players: resetPlayers,
                    currentPlayerIndex: nextStarterIndex,
                    // history is NOT cleared, it persists for MatchSummary
                    currentTurn: {
                        id: uuidv4(),
                        playerId: resetPlayers[nextStarterIndex].id,
                        throws: [],
                        scoreBefore: state.startingScore,
                        scoreAfter: state.startingScore,
                        isBust: false
                    }
                });
            },

            rematch: () => {
                const state = get();
                const resetPlayers = state.players.map(p => ({
                    ...p,
                    score: state.startingScore,
                    legsWon: 0,
                    setsWon: 0,
                    hasCheckedIn: (state.matchConfig.inMode || 'single') === 'single',
                    checkoutAttempts: 0,
                    highFinish: 0,
                    first9Scores: []
                }));

                set({
                    winnerId: null,
                    legWinnerId: null,
                    players: resetPlayers,
                    currentPlayerIndex: 0,
                    history: [],
                    currentTurn: {
                        id: uuidv4(),
                        playerId: resetPlayers[0].id,
                        throws: [],
                        scoreBefore: state.startingScore,
                        scoreAfter: state.startingScore,
                        isBust: false
                    }
                });
            },

            submitCheckoutAttempts: (count) => {
                const state = get();
                if (!state.showCheckoutPrompt) return;

                const { playerId } = state.showCheckoutPrompt;

                set({
                    players: state.players.map(p =>
                        p.id === playerId ? { ...p, checkoutAttempts: (p.checkoutAttempts || 0) + count } : p
                    ),
                    showCheckoutPrompt: null
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
