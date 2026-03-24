import { useAroundTheClockStore } from "@/lib/around-the-clock-store";
import { Button } from "@/components/ui/button";
import { ArrowLeft, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect } from "react";

export function AroundTheClockScoreboard() {
    const { players, currentTurn, winnerId, resetGame, nextPlayer, history, currentPlayerIndex, config } = useAroundTheClockStore();

    // Auto-switch effect
    useEffect(() => {
        if (!currentTurn || winnerId) return;
        if (currentTurn.throws.length === 3) {
            const timer = setTimeout(() => nextPlayer(), 1000);
            return () => clearTimeout(timer);
        }
    }, [currentTurn?.throws.length, winnerId, nextPlayer]);

    if (players.length === 0) return null;

    const currentPlayerId = currentTurn?.playerId || winnerId;

    return (
        <div className="flex flex-col h-full bg-[#131E18]">
            {/* Header - Fixed Height Viewport Based */}
            <div className="flex justify-between items-center px-4 h-[7vh] min-h-[44px] max-h-[64px] flex-none border-b border-white/10">
                <Button variant="ghost" size="icon" onClick={resetGame} className="text-white hover:bg-white/10 h-8 w-8">
                    <ArrowLeft className="w-5 h-5" />
                </Button>
                <div className="text-[4.5vw] max-text-xl font-black font-oswald tracking-tighter uppercase whitespace-nowrap overflow-hidden text-ellipsis px-2 text-white">
                    AROUND THE CLOCK
                </div>
                <div className="w-8 h-8 flex items-center justify-center">
                    <HelpCircle className="w-5 h-5 text-white/30" />
                </div>
            </div>

            <div className="flex flex-col flex-1 overflow-hidden relative">
                {/* Winner Overlay */}
                {winnerId && (
                    <div className="fixed inset-0 bg-background/95 z-[100] flex flex-col items-center justify-center animate-in fade-in zoom-in duration-300">
                        <div className="text-6xl mb-4">🏆</div>
                        <h2 className="text-4xl font-bold mb-2 text-white">MATCH WINNER</h2>
                        <div className="text-6xl font-black text-dart-orange mb-8 text-white">
                            {players.find(p => p.id === winnerId)?.name}
                        </div>
                        <Button size="lg" onClick={resetGame}>Back to Menu</Button>
                    </div>
                )}

                {/* Scoreboard Content Area - Side by Side layout */}
                <div className="flex flex-col flex-1 justify-center items-center px-4 overflow-hidden min-h-0">
                    <div className={cn(
                        "flex w-full rounded-[24px] overflow-hidden shadow-2xl border-2 border-white/5 transition-all duration-300 flex-1 min-h-[160px] max-h-[18rem] sm:max-h-[30rem]",
                        players.length === 1 ? "max-w-xl h-full" : "h-full"
                    )}>
                        {(() => {
                            let playersToShow = players;
                            if (players.length > 2) {
                                const nextPlayerIndex = (currentPlayerIndex + 1) % players.length;
                                playersToShow = [players[currentPlayerIndex], players[nextPlayerIndex]];
                            }

                            return playersToShow.map((p, index) => {
                                const isActive = p.id === currentPlayerId;
                                const bgColor = isActive ? "bg-dart-green shadow-[0_0_40px_-10px_rgba(34,197,94,0.3)]" : "bg-white/5 opacity-40 grayscale-[0.5]";

                                // Stats
                                const threw = history.filter(h => h.playerId === p.id);
                                const totalThrows = threw.length * 3 + (isActive ? (currentTurn?.throws.length || 0) : 0);
                                const target = p.clockTarget || 1;
                                const label = target === 21 ? "BULL" : target === 22 ? "INNER" : target.toString();

                                return (
                                    <div key={p.id + index} className={cn("flex-1 px-4 py-4 sm:py-8 flex flex-col justify-center relative transition-colors duration-500", bgColor)}>
                                        <div className="w-full">
                                            {/* Player Header */}
                                            <div className="flex items-center gap-3 mb-4 sm:mb-8">
                                                <div className="w-8 sm:w-16 h-8 sm:h-16 bg-white/30 rounded-full flex items-center justify-center font-black text-white text-base sm:text-2xl">
                                                    {p.name[0]?.toUpperCase()}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-extrabold text-white text-base sm:text-3xl leading-none truncate">{p.name}</div>
                                                </div>
                                            </div>

                                            {/* Target Section */}
                                            <div className="flex justify-between items-start mb-6 sm:mb-12">
                                                <div className="text-[14vw] sm:text-[10rem] leading-[0.6] font-oswald font-black text-white tracking-tighter">
                                                    {label}
                                                </div>
                                            </div>

                                            {/* Stats Container */}
                                            <div className="space-y-1 pb-1 border-t border-white/10 pt-4 sm:pt-8 bg-black/5 mx-[-16px] px-4">
                                                <div className="flex justify-between font-bold text-[10px] sm:text-lg uppercase tracking-widest text-white/70">
                                                    <span>Darts thrown</span>
                                                    <span className="text-white font-black">{totalThrows}</span>
                                                </div>
                                                <div className="flex justify-between font-bold text-[10px] sm:text-lg uppercase tracking-widest text-white/70">
                                                    <span>Multipliers</span>
                                                    <span className="text-white font-black">{config.useSkips ? "ON" : "OFF"}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Active Triangle Indicator */}
                                        {isActive && (
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
