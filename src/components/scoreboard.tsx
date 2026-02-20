import { useX01Store } from "@/lib/store";
import { ThrowDisplay } from "./throw-display";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { VoiceControl } from "./voice-control";
import { useEffect } from "react";
import { useMultiplayerStore } from "@/lib/multiplayer-store";
import { useAuthStore } from "@/lib/auth-store";

interface ScoreboardProps {
    inputMode?: 'single' | 'total';
}

export function Scoreboard({ inputMode = 'single' }: ScoreboardProps) {
    const { players, currentTurn, history, winnerId, legWinnerId, nextLeg, resetGame, manualTurn, addThrow, nextPlayer, undoThrow } = useX01Store();
    const { activeSession, onBroadcast } = useMultiplayerStore();

    // Multiplayer Syncing
    useEffect(() => {
        if (!activeSession) return;

        console.log("Multiplayer listeners active for session:", activeSession.id);

        const currentUserId = useAuthStore.getState().user?.id;

        const unsubInit = onBroadcast('init-game', (payload: any) => {
            if (payload.senderId !== currentUserId) {
                useX01Store.getState().initGame(payload.type, payload.playerNames, payload.customScore, payload.matchConfig);
            }
        });

        const unsubThrow = onBroadcast('throw', (payload: any) => {
            if (payload.senderId !== currentUserId) {
                addThrow(payload.throw);
            }
        });

        const unsubNext = onBroadcast('next-player', (payload: any) => {
            if (payload.senderId !== currentUserId) {
                nextPlayer();
            }
        });

        const unsubUndo = onBroadcast('undo', (payload: any) => {
            if (payload.senderId !== currentUserId) {
                undoThrow();
            }
        });

        const unsubManual = onBroadcast('manual-turn', (payload: any) => {
            if (payload.senderId !== currentUserId) {
                manualTurn(payload.amount);
            }
        });

        return () => {
            unsubInit();
            unsubThrow();
            unsubNext();
            unsubUndo();
            unsubManual();
        };
    }, [activeSession, onBroadcast, addThrow, nextPlayer, undoThrow, manualTurn]);

    if (players.length === 0) {
        return <div className="p-8 text-center text-muted-foreground">No game active</div>;
    }

    // ... existing derived state ...

    // We need to find the "active" player for display purposes. 
    // If game is won, winnerId is set. 
    // If leg is won, legWinnerId is set.

    const activePlayerId = winnerId || legWinnerId || currentTurn?.playerId;

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex justify-between items-center p-4 border-b bg-muted/5 flex-none">
                <Button variant="ghost" size="sm" onClick={() => {
                    useMultiplayerStore.getState().leaveSession();
                    resetGame();
                }} className="text-muted-foreground hover:text-destructive">
                    Exit Game
                </Button>
                <div className="font-mono text-sm opacity-50">501</div>
            </div>

            <div className="flex flex-col flex-1 overflow-hidden relative">
                {/* Winner Overlay (Match) */}
                {winnerId && (
                    <div className="absolute inset-0 bg-background/95 z-50 flex flex-col items-center justify-center animate-in fade-in zoom-in duration-300">
                        <div className="text-6xl mb-4">🏆</div>
                        <h2 className="text-4xl font-bold mb-2">MATCH WINNER</h2>
                        <div className="text-6xl font-black text-primary mb-8">
                            {players.find(p => p.id === winnerId)?.name}
                        </div>
                        <Button size="lg" onClick={() => {
                            useMultiplayerStore.getState().leaveSession();
                            resetGame();
                        }}>
                            Back to Menu
                        </Button>
                    </div>
                )}

                {/* Leg Winner Overlay */}
                {legWinnerId && !winnerId && (
                    <div className="absolute inset-0 bg-background/90 z-40 flex flex-col items-center justify-center animate-in fade-in zoom-in duration-300">
                        <div className="text-5xl mb-4">🎯</div>
                        <h2 className="text-3xl font-bold mb-2">LEG FINISHED</h2>
                        <div className="text-5xl font-black text-primary mb-8">
                            {players.find(p => p.id === legWinnerId)?.name}
                        </div>
                        <p className="text-muted-foreground mb-8">won the leg!</p>
                        <Button size="lg" className="h-16 text-xl px-8" onClick={nextLeg}>
                            Start Next Leg
                        </Button>
                    </div>
                )}

                {/* Players Grid */}
                <div className="flex-1 grid grid-cols-2 gap-px bg-muted/20">
                    {(() => {
                        const currentPlayerIndex = players.findIndex(p => p.id === (activePlayerId || currentTurn?.playerId));
                        let playersToShow = players;

                        if (players.length > 2) {
                            const nextPlayerIndex = (currentPlayerIndex + 1) % players.length;
                            playersToShow = [players[currentPlayerIndex], players[nextPlayerIndex]];
                        }

                        return playersToShow.map((p) => {
                            const isActive = p.id === (activePlayerId || currentTurn?.playerId);
                            const isNext = players.length > 2 && p.id === players[(currentPlayerIndex + 1) % players.length].id && !isActive;
                            const pHistory = history.filter(h => h.playerId === p.id).slice(-3).reverse();
                            const gridColsClass = playersToShow.length === 1 ? 'col-span-2' : 'col-span-1';

                            return (
                                <div key={p.id} className={`flex flex-col items-center justify-center p-2 transition-all duration-300 relative ${gridColsClass} ${isActive
                                    ? 'bg-background text-foreground border-b-2 border-primary/20'
                                    : isNext ? 'bg-muted/10 text-muted-foreground/80 scale-95 opacity-80' : 'bg-muted/5 text-muted-foreground opacity-60 scale-95'
                                    }`}>
                                    {isNext && <div className="absolute top-1 right-2 text-[10px] font-bold uppercase tracking-tighter opacity-50">Next</div>}

                                    <div className="text-xl font-medium mb-1 opacity-80">{p.name}</div>

                                    {/* Legs Won Indicator */}
                                    <div className="flex items-center gap-1 mb-2">
                                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Legs:</span>
                                        <span className="text-lg font-bold">{p.legsWon}</span>
                                    </div>

                                    <div className={`text-6xl font-bold tabular-nums tracking-tighter ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>
                                        {p.score}
                                    </div>

                                    {/* History Display */}
                                    <div className="flex gap-1 h-6 items-center opacity-80 mt-2">
                                        {pHistory.map((turn, i) => {
                                            const turnScore = turn.scoreBefore - turn.scoreAfter;
                                            return (
                                                <div key={turn.id} className={`flex items-center justify-center border rounded-md px-1 min-w-[2rem] text-xs font-mono
                                                    ${i === 0 ? 'bg-muted/50 border-muted-foreground/30 font-bold' : 'bg-transparent border-transparent text-muted-foreground/50'}`}>
                                                    {turn.isBust ? "X" : turnScore}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {isActive && !legWinnerId && !winnerId && (
                                        <div className="absolute bottom-4 text-xs font-medium text-primary animate-pulse">
                                        </div>
                                    )}
                                </div>
                            );
                        });
                    })()}
                </div>

                {/* Active Turn Visualization (Bottom) */}
                <div className="flex-none p-4 pt-1 bg-background border-t min-h-[4rem] flex justify-center items-center gap-4">
                    {/* Persistent Voice Control */}
                    {(!legWinnerId && !winnerId) && (
                        <VoiceControl
                            inputMode={inputMode}
                            mini={true}
                            className="h-14 w-14 bg-secondary/80 hover:bg-secondary"
                            // Stores handles auto-advance
                            onTotalScore={(val: number) => manualTurn(val)}
                        />
                    )}

                    {(inputMode === 'single' && !legWinnerId && !winnerId) ? (
                        <>
                            {[0, 1, 2].map(i => {
                                const t = currentTurn?.throws[i];
                                return (
                                    <ThrowDisplay
                                        key={i}
                                        throwData={t || null}
                                        active={currentTurn?.throws.length === i}
                                        size="lg"
                                    />
                                );
                            })}

                            {/* Submit / Next Player Button */}
                            <div className="flex items-center ml-2">
                                <Button
                                    size="icon"
                                    className="h-14 w-14 rounded-full bg-green-600 hover:bg-green-700 shadow-sm"
                                    disabled={!currentTurn}
                                    onClick={(winnerId || legWinnerId) ? nextLeg : useX01Store.getState().nextPlayer}
                                >
                                    <Check className="w-8 h-8" />
                                </Button>
                            </div>
                        </>
                    ) : inputMode === 'total' && !legWinnerId && !winnerId ? (
                        <div className="text-sm text-muted-foreground opacity-50">
                            Enter Total Score
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
