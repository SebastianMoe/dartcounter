import { Button } from "@/components/ui/button";
import { ArrowLeft, Undo } from "lucide-react";
import { useX01Store } from "@/lib/store";
import { useCricketStore } from "@/lib/cricket-store";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
// import { VoiceControl } from "./voice-control";

interface NumpadProps {
    mode: 'single' | 'total';
    setMode: (mode: 'single' | 'total') => void;
}

export function Numpad({ mode, setMode }: NumpadProps) {
    const x01 = useX01Store();
    const cricket = useCricketStore();

    const isCricket = !!cricket.gameId;
    const store = isCricket ? cricket : x01;

    // Direct access to common properties for cleaner code
    const currentTurn = store.currentTurn;
    const winnerId = store.winnerId;

    const [multiplier, setMultiplier] = useState<1 | 2 | 3>(1);
    const [totalInput, setTotalInput] = useState("");

    const handleNum = (segment: number) => {
        store.addThrow({
            score: segment,
            multiplier: multiplier,
            segment: segment,
            isDouble: multiplier === 2,
            isTriple: multiplier === 3,
            isOuterBull: segment === 25 && multiplier === 1,
            isInnerBull: segment === 25 && multiplier === 2
        });
        setMultiplier(1);
    };

    const toggleMultiplier = (m: 2 | 3) => {
        setMultiplier(prev => prev === m ? 1 : m);
    };

    const handleTotalInput = (num: number) => {
        if (totalInput.length >= 3) return; // Max 3 digits (180 is max per turn anyway, theoretically more if cheating but let's cap at 3 chars for sanity)
        setTotalInput(prev => prev + num.toString());
    };

    const submitTotal = () => {
        if (!totalInput) return;
        const val = parseInt(totalInput);
        if (!isNaN(val)) {
            if ('manualTurn' in store) {
                store.manualTurn(val);
            }
            setTotalInput("");
        }
    };

    const backspaceTotal = () => {
        setTotalInput(prev => prev.slice(0, -1));
    };

    // Auto-switch effect
    const { nextPlayer } = store;
    useEffect(() => {
        if (!currentTurn || winnerId) return;

        // Only auto-switch if:
        // 1. 3 throws made OR is Bust
        // 2. Not manual mode (Total Score usually has its own submit) - wait, user said "überall" (everywhere). 
        //    But Total Score is one atomic action. Numpad single is 3 actions.
        //    Auto-switch makes sense for 3 single darts.

        const shouldAutoSwitch = (currentTurn.throws.length === 3 || currentTurn.isBust) && !currentTurn.throws.some(t => t.isManual);

        if (shouldAutoSwitch) {
            const timer = setTimeout(() => {
                nextPlayer();
            }, 1000); // 1 second delay to see result
            return () => clearTimeout(timer);
        }
    }, [currentTurn?.throws.length, currentTurn?.isBust, winnerId, nextPlayer]); // Works for both X01 and Cricket as long as they follow the Turn interface

    return (
        <div className="flex flex-col gap-2 p-2 pb-8 max-w-md mx-auto w-full">
            {/* Mode Toggles */}
            <div className="flex gap-2 mb-2">
                <Button
                    variant={mode === 'single' ? 'default' : 'secondary'}
                    className="flex-1"
                    onClick={() => setMode('single')}
                >
                    Single Darts
                </Button>
                <Button
                    variant={mode === 'total' ? 'default' : 'secondary'}
                    className="flex-1"
                    onClick={() => setMode('total')}
                >
                    Total Score
                </Button>
            </div>

            {/* Voice Control Integration Removed - Moved to Scoreboard */}

            {mode === 'single' ? (
                /* Single Darts Layout */
                <div className="grid grid-cols-5 gap-1.5 h-[360px]">
                    {[...Array(20)].map((_, i) => {
                        const val = i + 1;
                        return (
                            <Button
                                key={val}
                                variant="outline"
                                className={cn("h-11 text-base font-bold", multiplier === 2 ? "bg-red-100 text-red-900 border-red-300" : multiplier === 3 ? "bg-green-100 text-green-900 border-green-300" : "")}
                                onClick={() => handleNum(val)}
                            >
                                {val}
                            </Button>
                        )
                    })}

                    <Button variant={multiplier === 2 ? "default" : "secondary"} className="h-11 font-bold text-xs" onClick={() => toggleMultiplier(2)}>
                        Double
                    </Button>
                    <Button variant={multiplier === 3 ? "default" : "secondary"} className="h-11 font-bold text-xs" onClick={() => toggleMultiplier(3)}>
                        Triple
                    </Button>

                    <Button variant="outline" className="h-11 font-bold text-red-600 text-xs" onClick={() => handleNum(25)}>
                        BULL
                    </Button>

                    <Button variant="ghost" className="h-11 text-xs" onClick={() => handleNum(0)}>
                        MISS
                    </Button>

                    <Button variant="destructive" size="icon" className="h-11 w-full col-span-1" onClick={store.undoThrow}>
                        <Undo className="w-4 h-4" />
                    </Button>

                    {/* Note: Next Player button removed from here, moved to Scoreboard as requested */}
                </div>
            ) : (
                /* Total Score Layout */
                <div className="flex flex-col gap-2 h-[360px]">
                    <div className="flex gap-2 h-20">
                        <div className="bg-card border p-4 rounded-lg text-center flex items-center justify-center flex-1">
                            <span className="text-4xl font-mono font-bold tracking-widest">{totalInput || "0"}</span>
                        </div>
                        <Button
                            className="h-full w-24 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl text-xl shrink-0"
                            onClick={submitTotal}
                            disabled={totalInput.length === 0}
                        >
                            ENTER
                        </Button>
                    </div>

                    <div className="grid grid-cols-3 gap-3 flex-1">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                            <Button
                                key={num}
                                variant="outline"
                                className="h-full text-3xl font-bold rounded-xl active:bg-accent/50 hover:bg-background hover:text-foreground focus:bg-background transition-colors touch-manipulation focus:outline-none"
                                onClick={() => handleTotalInput(num)}
                            >
                                {num}
                            </Button>
                        ))}
                        <Button variant="secondary" className="h-full rounded-xl" onClick={backspaceTotal}>
                            <ArrowLeft className="w-8 h-8 opacity-70" />
                        </Button>
                        <Button
                            variant="outline"
                            className="h-full text-3xl font-bold rounded-xl active:bg-accent/50 hover:bg-background hover:text-foreground focus:bg-background transition-colors touch-manipulation focus:outline-none"
                            onClick={() => handleTotalInput(0)}
                        >
                            0
                        </Button>
                        <Button className="w-full h-full" variant="outline" onClick={store.undoThrow}>
                            <Undo className="w-6 h-6" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}
