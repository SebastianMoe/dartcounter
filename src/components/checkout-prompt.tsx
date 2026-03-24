import { useX01Store } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Target } from "lucide-react";

export function CheckoutPrompt() {
    const { showCheckoutPrompt, submitCheckoutAttempts, players } = useX01Store();

    if (!showCheckoutPrompt) return null;

    const { playerId, wasFinish } = showCheckoutPrompt;
    const player = players.find(p => p.id === playerId);

    // If wasFinish, we had at least 1 dart at double. 
    // Minimum is 1, maximum is what was available in the turn.
    const minDarts = wasFinish ? 1 : 0;
    const options = [];
    for (let i = minDarts; i <= 3; i++) {
        options.push(i);
    }

    return (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-300">
            <div className="w-full max-w-sm bg-[#1C2822] border border-white/10 rounded-[2.5rem] p-8 shadow-2xl scale-in-center">
                <div className="flex flex-col items-center text-center">
                    <div className="w-16 h-16 bg-dart-green/20 rounded-full flex items-center justify-center mb-6">
                        <Target className="w-8 h-8 text-dart-green" />
                    </div>

                    <h2 className="text-2xl font-black font-oswald uppercase tracking-tight text-white mb-2">
                        Checkout Attempts
                    </h2>
                    <p className="text-white/40 text-sm font-bold mb-8">
                        {player?.name}, how many darts did you throw at a double in this turn?
                    </p>

                    <div className="grid grid-cols-2 gap-3 w-full">
                        {options.map(opt => (
                            <Button
                                key={opt}
                                onClick={() => submitCheckoutAttempts(opt)}
                                className={cn(
                                    "h-20 rounded-2xl text-2xl font-black font-oswald border-2 transition-all active:scale-95",
                                    opt > 0
                                        ? "bg-dart-green border-dart-green hover:bg-dart-green/90 text-white shadow-lg shadow-dart-green/20"
                                        : "bg-white/5 border-white/10 text-white/40 hover:bg-white/10"
                                )}
                            >
                                {opt}
                            </Button>
                        ))}
                    </div>

                    {wasFinish && (
                        <div className="mt-6 text-[10px] font-black text-dart-green uppercase tracking-widest opacity-50">
                            Leg finished! Great job.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
