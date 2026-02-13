import { useCricketStore } from "@/lib/cricket-store";
import { Button } from "@/components/ui/button";
import { Undo, UserPlus } from "lucide-react";

export function CricketScoreboard() {
    const { players, currentTurn, winnerId, resetGame, addThrow, undoThrow, nextPlayer } = useCricketStore();

    if (players.length === 0) {
        return <div className="p-8 text-center text-muted-foreground">No game active</div>;
    }

    const cricketNumbers = [20, 19, 18, 17, 16, 15, 25];

    const getMarkSymbol = (marks: number) => {
        if (marks === 1) return "/";
        if (marks === 2) return "X";
        if (marks >= 3) return "⦻";
        return "";
    };

    const handleInput = (segment: number, multiplier: 1 | 2 | 3) => {
        addThrow({
            score: segment,
            multiplier,
            segment,
            isDouble: multiplier === 2,
            isTriple: multiplier === 3,
            isOuterBull: segment === 25 && multiplier === 1,
            isInnerBull: segment === 25 && multiplier === 2
        });
    };

    return (
        <div className="flex flex-col h-full bg-background">
            {/* Header */}
            <div className="flex justify-between items-center p-3 border-b bg-muted/5 flex-none">
                <Button variant="ghost" size="sm" onClick={resetGame} className="text-muted-foreground hover:text-destructive">
                    Exit Game
                </Button>
                <div className="font-mono text-sm font-bold opacity-30 uppercase tracking-widest">Cricket</div>
                <div className="w-16" /> {/* Spacer */}
            </div>

            <div className="flex flex-col flex-1 overflow-hidden relative">
                {/* Winner Overlay */}
                {winnerId && (
                    <div className="absolute inset-0 bg-background/95 z-50 flex flex-col items-center justify-center animate-in fade-in zoom-in duration-300">
                        <div className="text-6xl mb-4">🏆</div>
                        <h2 className="text-4xl font-bold mb-2 text-center uppercase">Cricket Winner</h2>
                        <div className="text-6xl font-black text-primary mb-8 text-center">
                            {players.find(p => p.id === winnerId)?.name}
                        </div>
                        <Button size="lg" onClick={resetGame}>
                            Back to Menu
                        </Button>
                    </div>
                )}

                {/* Main Scoreboard Area */}
                <div className="flex-1 flex flex-col">
                    {/* Dynamic Players Row */}
                    <div className="flex-none grid grid-cols-2 gap-px bg-muted/20 border-b">
                        {(() => {
                            const currentPlayerIndex = players.findIndex(p => p.id === (currentTurn?.playerId || winnerId));
                            let playersToShow = players;
                            if (players.length > 2) {
                                const nextPlayerIndex = (currentPlayerIndex + 1) % players.length;
                                playersToShow = [players[currentPlayerIndex], players[nextPlayerIndex]];
                            }

                            return playersToShow.map((p) => {
                                const isActive = p.id === (currentTurn?.playerId || winnerId);
                                const isNext = players.length > 2 && p.id === players[(currentPlayerIndex + 1) % players.length].id && !isActive;
                                const gridColsClass = playersToShow.length === 1 ? 'col-span-2' : 'col-span-1';

                                return (
                                    <div key={p.id} className={`flex flex-col items-center justify-center p-2 transition-all duration-300 relative ${gridColsClass} ${isActive
                                        ? 'bg-background text-foreground border-b-2 border-primary/20'
                                        : isNext ? 'bg-muted/10 text-muted-foreground/80 scale-95 opacity-80' : 'bg-muted/5 text-muted-foreground opacity-60 scale-95'
                                        }`}>
                                        <div className="text-sm font-medium opacity-80">{p.name}</div>
                                        <div className="text-3xl font-black tabular-nums tracking-tighter text-primary">
                                            {p.score}
                                        </div>
                                    </div>
                                );
                            });
                        })()}
                    </div>

                    {/* Cricket Marks Grid */}
                    <div className="flex-1 overflow-y-auto p-2 space-y-2">
                        {cricketNumbers.map(num => {
                            const label = num === 25 ? "B" : num.toString();
                            const isBull = num === 25;
                            const currentPlayerIndex = players.findIndex(p => p.id === (currentTurn?.playerId || winnerId));

                            let p1 = players[0];
                            if (players.length > 2) p1 = players[currentPlayerIndex];

                            let p2 = players[1];
                            if (players.length > 2) p2 = players[(currentPlayerIndex + 1) % players.length];

                            return (
                                <div key={num} className="grid grid-cols-[1fr_2fr_1fr] items-center gap-1">
                                    {/* Left Marks */}
                                    <div className="flex justify-center text-2xl font-black text-primary min-w-[2rem] bg-muted/5 py-1 rounded">
                                        {getMarkSymbol(p1.cricketData?.[num] || 0)}
                                    </div>

                                    {/* Center: Number + Buttons Stack */}
                                    <div className="flex flex-col items-center gap-0.5 bg-background border rounded px-1 py-1 shadow-sm">
                                        <div className="text-[10px] font-bold text-muted-foreground uppercase leading-none tracking-wider">{label}</div>
                                        <div className="flex-1 grid grid-cols-3 gap-1 w-full">
                                            <Button variant="secondary" size="sm" className="h-8 font-bold text-[10px] p-0" onClick={() => handleInput(num, 1)}>S</Button>
                                            <Button variant="secondary" size="sm" className="h-8 font-bold text-[10px] p-0" onClick={() => handleInput(num, 2)}>D</Button>
                                            {isBull ? (
                                                <div className="bg-muted/10 rounded h-8 w-full border border-dashed border-muted-foreground/10" />
                                            ) : (
                                                <Button variant="secondary" size="sm" className="h-8 font-bold text-[10px] p-0" onClick={() => handleInput(num, 3)}>T</Button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Right Marks */}
                                    <div className="flex justify-center text-2xl font-black text-primary min-w-[2rem] bg-muted/5 py-1 rounded">
                                        {players.length > 1 ? getMarkSymbol(p2.cricketData?.[num] || 0) : "-"}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="flex-none p-4 grid grid-cols-2 gap-4 bg-muted/5 border-t safe-area-bottom">
                    <Button variant="outline" size="lg" className="h-14 gap-2 font-bold text-muted-foreground" onClick={undoThrow}>
                        <Undo className="w-5 h-5" />
                        UNDO
                    </Button>
                    <Button size="lg" className="h-14 gap-2 font-bold bg-green-600 hover:bg-green-700 text-white"
                        onClick={nextPlayer}
                        disabled={!currentTurn || !!winnerId}
                    >
                        <UserPlus className="w-5 h-5" />
                        NEXT
                    </Button>
                </div>
            </div>
        </div>
    );
}
