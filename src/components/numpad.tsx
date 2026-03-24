import { Button } from "@/components/ui/button";
import { Undo, LayoutGrid } from "lucide-react";
import { useX01Store } from "@/lib/store";
import { useCricketStore } from "@/lib/cricket-store";
import { useAroundTheClockStore } from "@/lib/around-the-clock-store";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { VoiceControl } from "./voice-control";

interface NumpadProps {
    mode: 'single' | 'total';
    setMode: (mode: 'single' | 'total') => void;
}

export function Numpad({ mode, setMode }: NumpadProps) {
    const x01 = useX01Store();
    const cricket = useCricketStore();
    const clock = useAroundTheClockStore();

    const isClock = !!clock.gameId;
    const isCricket = !!cricket.gameId;
    const store = (isClock ? clock : (isCricket ? cricket : x01)) as any;
    const { currentTurn, winnerId, legWinnerId, nextLeg, nextPlayer } = store;

    const [multiplier, setMultiplier] = useState<1 | 2 | 3>(1);
    const [totalInput, setTotalInput] = useState("");


    const handleNum = (segment: number) => {
        store.addThrow({
            score: segment,
            multiplier: multiplier,
            segment: segment,
            isDouble: multiplier === 2,
            isTriple: multiplier === 3,
            isOuterBull: false,
            isInnerBull: false
        });
        setMultiplier(1);
    };

    const handleBull = (inner: boolean) => {
        store.addThrow({
            score: 25,
            multiplier: inner ? 2 : 1,
            segment: 25,
            isDouble: inner,
            isTriple: false,
            isOuterBull: !inner,
            isInnerBull: inner
        });
    };

    const submitTotal = () => {
        if (!totalInput) return;
        const val = parseInt(totalInput);
        if (!isNaN(val)) {
            if (store.manualTurn) {
                store.manualTurn(val);
            }
            setTotalInput("");
        }
    };

    // Auto-switch effect
    useEffect(() => {
        if (!currentTurn || winnerId || legWinnerId) return;
        const shouldAutoSwitch = (currentTurn.throws.length === 3 || currentTurn.isBust) && !currentTurn.throws.some((t: any) => t.isManual);
        if (shouldAutoSwitch) {
            const timer = setTimeout(() => {
                nextPlayer();
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [currentTurn?.throws.length, currentTurn?.isBust, winnerId, legWinnerId, nextPlayer]);

    const segments = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];

    return (
        <div className="flex flex-col gap-0 w-full bg-[#131E18] select-none rounded-t-[2rem] overflow-hidden shadow-2xl flex-none">

            {/* White Input Bar */}
            <div className="px-4 pt-1 sm:pt-2 pb-1 bg-[#131E18]">
                <div className="bg-white rounded-[1.5rem] h-[6vh] min-h-[44px] sm:min-h-[56px] max-h-[80px] flex items-center justify-between p-1 shadow-xl transition-all">
                    <div className="w-[12vw] max-w-[64px] h-full flex items-center justify-center flex-none">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setMode(mode === 'single' ? 'total' : 'single')}
                            className="w-full h-full rounded-full hover:bg-black/5 active:scale-95 transition-transform"
                        >
                            <LayoutGrid className="w-[5vw] min-w-[20px] max-w-[32px] text-black/40" />
                        </Button>
                    </div>

                    <div className="flex-1 flex justify-center gap-1 overflow-hidden px-1">
                        {mode === 'single' ? (
                            [0, 1, 2].map(i => {
                                const t = currentTurn?.throws[i];
                                return (
                                    <div key={i} className="flex-1 min-w-0 max-w-[64px] h-full flex flex-col justify-center items-center border-x border-black/5">
                                        <span className="text-[5vw] max-text-3xl font-black text-black leading-none font-oswald animate-in zoom-in-50">
                                            {t ? (t.score * t.multiplier) : ""}
                                        </span>
                                        <span className="text-[2vw] max-text-[10px] font-black text-black/30 uppercase truncate px-0.5 tracking-tighter">
                                            {t ? (t.multiplier === 3 ? "T" : t.multiplier === 2 ? "D" : "S") + t.score : ""}
                                        </span>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="flex-1 text-center min-w-0">
                                <span className="text-[7vw] max-text-4xl font-black text-black font-oswald tracking-widest truncate block animate-in slide-in-from-right-4 duration-200">{totalInput || "0"}</span>
                            </div>
                        )}
                    </div>

                    <div className="flex-none pr-1">
                        <Button
                            onClick={(winnerId || legWinnerId) ? nextLeg : (mode === 'total' ? submitTotal : nextPlayer)}
                            className="h-[80%] px-3 sm:px-8 rounded-full bg-[#24C781] hover:bg-[#24C781]/90 text-white font-black text-[3vw] sm:text-lg uppercase tracking-tighter shadow-lg active:scale-95 transition-all"
                        >
                            Submit
                        </Button>
                    </div>
                </div>
            </div>


            {/* Selector Row - Only for single dart mode */}
            {mode === 'single' && (
                <div className="grid grid-cols-5 border-y border-white/5 bg-[#131E18]">
                    {[
                        { label: 'Single', value: 1, active: multiplier === 1 },
                        { label: 'Double', value: 2, active: multiplier === 2 },
                        { label: 'Treble', value: 3, active: multiplier === 3 }
                    ].map((tab) => (
                        <Button
                            key={tab.label}
                            variant="ghost"
                            className={cn(
                                "h-[5vh] min-h-[36px] sm:min-h-[48px] max-h-[72px] rounded-none flex flex-col items-center justify-center gap-0.5 border-b-2 transition-all border-r border-white/5",
                                tab.active ? "border-b-dart-red text-white bg-white/5" : "border-b-transparent text-white/30 hover:text-white"
                            )}
                            onClick={() => setMultiplier(tab.value as 1 | 2 | 3)}
                        >
                            <span className="text-[9px] sm:text-sm font-black uppercase tracking-tighter leading-none">{tab.label}</span>
                        </Button>
                    ))}

                    <Button
                        variant="ghost"
                        className="h-[5vh] min-h-[36px] sm:min-h-[48px] max-h-[72px] rounded-none flex flex-col items-center justify-center gap-0 border-r border-white/5 hover:bg-white/5 transition-all"
                        onClick={() => handleBull(true)}
                    >
                        <span className="text-[3.5vw] max-text-xl font-oswald font-black text-white uppercase tracking-tighter">Bull</span>
                    </Button>
                    <Button
                        variant="ghost"
                        className="h-[5vh] min-h-[36px] sm:min-h-[48px] max-h-[72px] rounded-none flex flex-col items-center justify-center gap-0 hover:bg-white/5 transition-all"
                        onClick={() => handleBull(false)}
                    >
                        <span className="text-[3.5vw] max-text-xl font-oswald font-black text-white uppercase tracking-tighter">Outer</span>
                    </Button>
                </div>
            )}

            {/* Main Numeric Grid */}
            <div className="bg-[#131E18] flex-1 min-h-0">
                {mode === 'single' ? (
                    <div className="grid grid-cols-5 h-[30vh] min-h-[160px] max-h-[450px]">
                        {segments.map((s) => (
                            <Button
                                key={s}
                                variant="ghost"
                                className="h-full rounded-none text-[5vw] max-text-4xl font-oswald font-black text-white hover:bg-white/5 active:bg-white/10 transition-all border-r border-b border-white/5"
                                onClick={() => handleNum(s)}
                            >
                                {s}
                            </Button>
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-3 h-[30vh] min-h-[160px] max-h-[450px]">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                            <Button
                                key={n}
                                variant="ghost"
                                className="h-full rounded-none text-[8vw] max-text-6xl font-oswald font-black text-white hover:bg-white/5 active:bg-white/10 transition-all border-r border-b border-white/5"
                                onClick={() => setTotalInput(prev => (prev.length < 3 ? prev + n : prev))}
                            >
                                {n}
                            </Button>
                        ))}
                        {/* 0 and Undo moved to bottom bar */}
                    </div>
                )}
            </div>

            {/* Bottom Controls */}
            <div className="grid grid-cols-3 border-t border-white/5 h-[10vh] min-h-[60px] max-h-[120px]">
                <Button
                    variant="ghost"
                    onClick={() => mode === 'total' ? setTotalInput(prev => prev.slice(0, -1)) : store.undoThrow()}
                    className="h-full rounded-none text-white/40 hover:text-white hover:bg-white/5 transition-all border-r border-b border-white/5"
                >
                    <Undo className="w-[6vw] min-w-[24px]" />
                </Button>

                {mode === 'single' ? (
                    <Button
                        variant="ghost"
                        className="h-full rounded-none text-[6vw] max-text-4xl font-oswald font-black uppercase tracking-tighter text-white/40 hover:text-white hover:bg-white/5 transition-all border-r border-b border-white/5"
                        onClick={() => handleNum(0)}
                    >
                        Miss
                    </Button>
                ) : (
                    <Button
                        variant="ghost"
                        className="h-full rounded-none text-[8vw] max-text-6xl font-oswald font-black text-white hover:bg-white/5 active:bg-white/10 transition-all border-r border-b border-white/5"
                        onClick={() => setTotalInput(prev => (prev.length < 3 ? prev + "0" : prev))}
                    >
                        0
                    </Button>
                )}

                <VoiceControl
                    mini
                    onTotalScore={(s) => {
                        if (store.manualTurn) store.manualTurn(s);
                        else store.addThrow({ score: s, multiplier: 1, segment: s, isDouble: false, isTriple: false, isOuterBull: false, isInnerBull: false, isManual: true });
                    }}
                    className="h-full w-full rounded-none bg-transparent hover:bg-white/5 border-r border-b border-white/5 flex items-center justify-center p-0 shadow-none ring-0 ring-offset-0"
                />
            </div>

        </div>
    );
}
