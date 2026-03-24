import { useX01Store } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { ArrowLeft, HelpCircle, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useMultiplayerStore } from "@/lib/multiplayer-store";
import { useAuthStore } from "@/lib/auth-store";
import { cn } from "@/lib/utils";
import { getCheckout } from "@/lib/checkout-utils";
import { MatchSummary } from "./match-summary";
import { CheckoutPrompt } from "./checkout-prompt";

// Scoreboard component
export function Scoreboard() {
    const { players, currentTurn, history, winnerId, legWinnerId, nextLeg, resetGame, manualTurn, addThrow, nextPlayer, undoThrow, matchConfig, startingScore } = useX01Store();
    const [showHelp, setShowHelp] = useState(false);
    const { activeSession, onBroadcast } = useMultiplayerStore();

    // Multiplayer Syncing
    useEffect(() => {
        if (!activeSession) return;

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

    const activePlayerId = winnerId || legWinnerId || currentTurn?.playerId;

    return (
        <div className="flex flex-col h-full bg-[#131E18]">
            {/* Header - Fixed Height Viewport Based */}
            <div className="flex justify-between items-center px-4 h-[7vh] min-h-[44px] max-h-[64px] flex-none border-b border-white/10">
                <Button variant="ghost" size="icon" onClick={() => {
                    useMultiplayerStore.getState().leaveSession();
                    resetGame();
                }} className="text-white hover:bg-white/10 h-8 w-8">
                    <ArrowLeft className="w-5 h-5" />
                </Button>
                <div className="text-[4.5vw] max-text-xl font-black font-oswald tracking-tighter uppercase whitespace-nowrap overflow-hidden text-ellipsis px-2 text-white">
                    {matchConfig.mode === 'firstTo' ? 'FIRST TO' : 'BEST OF'}{" "}
                    {matchConfig.target} {matchConfig.lengthType === 'sets' ? (matchConfig.target === 1 ? 'SET' : 'SETS') : (matchConfig.target === 1 ? 'LEG' : 'LEGS')}
                </div>
                <Button variant="ghost" size="icon" onClick={() => setShowHelp(true)} className="text-white hover:bg-white/10 h-8 w-8">
                    <HelpCircle className="w-5 h-5" />
                </Button>
            </div>

            <div className="flex flex-col flex-1 overflow-hidden relative">
                {/* Overlays */}
                <MatchSummary />
                <CheckoutPrompt />

                {legWinnerId && !winnerId && (
                    <div className="fixed inset-0 bg-background/90 z-[90] flex flex-col items-center justify-center animate-in fade-in zoom-in duration-300 border-4 border-dart-green rounded-[3rem] m-6 overflow-hidden shadow-2xl">
                        <div className="text-5xl mb-4">🎯</div>
                        <h2 className="text-3xl font-bold mb-2 text-white uppercase tracking-tighter">Leg Finished</h2>
                        <div className="text-5xl font-black text-dart-green mb-8 uppercase tracking-tighter">
                            {players.find(p => p.id === legWinnerId)?.name}
                        </div>
                        <Button size="lg" className="h-16 text-xl px-12 bg-dart-green text-white hover:bg-dart-green/90 font-black uppercase tracking-tighter rounded-2xl" onClick={nextLeg}>
                            Next Leg
                        </Button>
                    </div>
                )}

                {/* Help Overlay */}
                {showHelp && (
                    <div className="fixed inset-0 bg-background/98 z-[200] flex flex-col items-center justify-center p-6 animate-in fade-in slide-in-from-bottom duration-300">
                        <div className="w-full max-sm:px-4 max-w-sm bg-card border border-border rounded-[2.5rem] p-10 shadow-2xl relative text-white border-white/10">
                            <Button variant="ghost" size="icon" onClick={() => setShowHelp(false)} className="absolute top-6 right-6 text-muted-foreground hover:text-white">
                                <X className="w-8 h-8" />
                            </Button>
                            <h2 className="text-3xl font-black font-oswald tracking-tighter uppercase mb-8 text-center text-dart-orange">Voice Help</h2>
                            <div className="space-y-6">
                                <div className="p-5 bg-white/5 rounded-3xl border border-white/10">
                                    <p className="text-xs font-bold opacity-70 mb-2 uppercase tracking-widest text-white/50">Command:</p>
                                    <p className="text-2xl font-black font-oswald tracking-tight">Say <span className="text-dart-green mr-1">"SCORE"</span> [Value]</p>
                                    <p className="text-sm opacity-50 mt-3 italic font-bold">Example: "Score 140"</p>
                                </div>
                            </div>
                            <Button className="w-full mt-10 h-16 rounded-2xl font-black text-xl bg-dart-green hover:bg-dart-green/90 text-white shadow-xl uppercase tracking-wider" onClick={() => setShowHelp(false)}>Got it!</Button>
                        </div>
                    </div>
                )}

                {/* Scoreboard Content Area - Centered Stack */}
                <div className="flex flex-col flex-1 justify-center items-center px-4 overflow-hidden min-h-0">
                    <div className={cn(
                        "flex w-full rounded-[24px] overflow-hidden shadow-2xl border-2 border-white/5 transition-all duration-300 flex-1 min-h-[160px] max-h-[18rem] sm:max-h-[30rem]",
                        players.length === 1 ? "max-w-xl h-full" : "h-full"
                    )}>
                        {(() => {
                            const currentPlayerId = activePlayerId || currentTurn?.playerId;
                            const currentPlayerIndex = players.findIndex(p => p.id === currentPlayerId);
                            let playersToShow = players;

                            if (players.length > 2) {
                                const nextPlayerIndex = (currentPlayerIndex + 1) % players.length;
                                playersToShow = [players[currentPlayerIndex], players[nextPlayerIndex]];
                            } else if (players.length === 1) {
                                playersToShow = [players[0]];
                            }

                            return playersToShow.map((p, index) => {
                                const isActive = p.id === currentPlayerId;
                                const isDummy = p.id === 'dummy';
                                const bgColor = isActive && !isDummy ? "bg-dart-green shadow-[0_0_40px_-10px_rgba(34,197,94,0.3)]" : "bg-white/5 opacity-40 grayscale-[0.5]";

                                // Basic Stats
                                const threw = history.filter(h => h.playerId === p.id);
                                const dartsThrownCount = threw.length * 3;
                                const scoreThrown = startingScore - p.score;
                                const avg = dartsThrownCount > 0 ? ((scoreThrown / dartsThrownCount) * 3).toFixed(2) : "0.00";
                                const lastThrow = threw.length > 0 ? (threw[threw.length - 1].scoreBefore - threw[threw.length - 1].scoreAfter) : "-";

                                // Checkout logic
                                const dartsLeft = isActive ? 3 - (currentTurn?.throws.length || 0) : 3;
                                const checkoutPath = isActive ? getCheckout(p.score, matchConfig.outMode, dartsLeft) : null;
                                const noCheckout = isActive && p.score <= 170 && !checkoutPath;

                                return (
                                    <div key={p.id + index} className={cn("flex-1 px-4 py-4 sm:py-8 flex flex-col justify-center relative transition-colors duration-500", bgColor)}>
                                        <div className="w-full">
                                            {/* Player Header */}
                                            <div className="flex items-center gap-3 mb-2">
                                                {index === 0 && <div className="w-1.5 h-1.5 bg-black/40 rounded-full" />}
                                                <div className="relative">
                                                    <div className="w-8 sm:w-16 h-8 sm:h-16 bg-white/30 rounded-full flex items-center justify-center font-black text-white text-base sm:text-2xl">
                                                        {p.name[0]?.toUpperCase()}
                                                    </div>
                                                    {matchConfig.lengthType === 'sets' && (
                                                        <div className="absolute -top-1 -right-1 bg-white text-black text-[8px] sm:text-xs font-black px-1 rounded border border-black/10 shadow-sm">
                                                            {p.setsWon}S
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-extrabold text-white text-base sm:text-3xl leading-none truncate">{p.name}</div>
                                                    {!p.hasCheckedIn && isActive && (
                                                        <div className="text-[8px] sm:text-xs font-black text-white/50 uppercase tracking-widest mt-0.5 animate-pulse">
                                                            {matchConfig.inMode === 'double' ? 'Double In Required' : 'Master In Required'}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Score Section - Balanced margin */}
                                            <div className={cn(
                                                "flex justify-between items-start transition-all duration-300",
                                                (isActive && (p.score <= 170 || noCheckout)) ? "mb-4 sm:mb-6" : "mb-4 sm:mb-8"
                                            )}>
                                                <div className="text-[14vw] sm:text-[10rem] leading-[0.6] font-oswald font-black text-white tracking-tighter">
                                                    {isDummy ? "0" : p.score}
                                                </div>
                                                <div className="bg-black/30 text-white font-black px-2 sm:px-6 py-1 sm:py-4 rounded-lg sm:rounded-2xl text-xs sm:text-3xl border border-white/10 shadow-inner">
                                                    {p.legsWon}
                                                </div>
                                            </div>

                                            {/* Checkout Section - Three Boxes */}
                                            {isActive && (p.score <= 170 || noCheckout) && (
                                                <div className="mb-4 sm:mb-8 animate-in fade-in slide-in-from-top-2">
                                                    {noCheckout ? (
                                                        <div className="text-[10px] sm:text-sm font-black text-white/50 uppercase tracking-widest text-center">No Checkout</div>
                                                    ) : checkoutPath ? (
                                                        <div className="flex justify-center gap-1.5 sm:gap-4">
                                                            {[0, 1, 2].map((i) => (
                                                                <div key={i} className={cn(
                                                                    "w-10 sm:w-20 aspect-square rounded-xl sm:rounded-2xl flex items-center justify-center border-2 shadow-lg transition-transform hover:scale-105",
                                                                    checkoutPath[i] ? "bg-white border-white text-black" : "bg-black/10 border-white/10 text-transparent"
                                                                )}>
                                                                    <span className="text-xs sm:text-2xl font-black font-oswald uppercase">{checkoutPath[i] || "-"}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : null}
                                                </div>
                                            )}

                                            {/* Stats Container - Balanced padding */}
                                            <div className={cn(
                                                "space-y-1 pb-1 border-t border-white/10 bg-black/5 mx-[-16px] px-4 transition-all duration-300",
                                                (isActive && (p.score <= 170 || noCheckout)) ? "pt-2 sm:pt-4" : "pt-4 sm:pt-8"
                                            )}>
                                                <div className="flex justify-between font-bold text-[10px] sm:text-lg uppercase tracking-widest text-white/70">
                                                    <span>3-dart avg.</span>
                                                    <span className="text-white font-black">{isDummy ? "0.00" : avg}</span>
                                                </div>
                                                <div className="flex justify-between font-bold text-[10px] sm:text-lg uppercase tracking-widest text-white/70">
                                                    <span>Last score</span>
                                                    <span className="text-white font-black">{isDummy ? "-" : lastThrow}</span>
                                                </div>
                                                <div className="flex justify-between font-bold text-[10px] sm:text-lg uppercase tracking-widest text-white/70">
                                                    <span>Darts thrown</span>
                                                    <span className="text-white font-black">{isDummy ? "0" : dartsThrownCount}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Active Triangle Indicator */}
                                        {isActive && !isDummy && (
                                            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 sm:w-12 h-8 sm:h-12 bg-[#131E18] rotate-45 transform translate-y-1/2 rounded-sm" />
                                        )}
                                    </div>
                                );
                            });
                        })()}
                    </div>
                </div>
            </div>
        </div>
    );
}
