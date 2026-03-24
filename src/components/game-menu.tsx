import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface GameMenuProps {
    onBack: () => void;
    onSelectMatch: () => void;
    onSelectCricket: () => void;
    onSelectClock: () => void;
}

export function GameMenu({ onBack, onSelectMatch, onSelectCricket, onSelectClock }: GameMenuProps) {
    return (
        <div className="flex flex-col h-[100dvh] bg-[#131E18] text-foreground overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 flex-none border-b border-border">
                <Button variant="ghost" size="icon" onClick={onBack} className="text-white hover:bg-white/10">
                    <ArrowLeft className="w-6 h-6" />
                </Button>
                <h1 className="text-2xl font-black font-oswald tracking-tighter uppercase">New Game</h1>
                <div className="w-10"></div> {/* Spacer to center title */}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-24">
                <div
                    onClick={onSelectMatch}
                    className="bg-[#1C2822] rounded-xl p-5 flex justify-between items-center cursor-pointer active:scale-[0.98] transition-all border border-transparent hover:border-white/10"
                >
                    <span className="font-black font-oswald text-2xl uppercase tracking-tighter text-white">Match</span>
                    <ArrowLeft className="w-6 h-6 text-white rotate-180" />
                </div>

                <div
                    onClick={onSelectCricket}
                    className="bg-[#1C2822] rounded-xl p-5 flex justify-between items-center cursor-pointer active:scale-[0.98] transition-all border border-transparent hover:border-white/10"
                >
                    <span className="font-black font-oswald text-2xl uppercase tracking-tighter text-white">Cricket / Tactics</span>
                    <ArrowLeft className="w-6 h-6 text-white rotate-180" />
                </div>

                <div
                    onClick={onSelectClock}
                    className="bg-[#1C2822] rounded-xl p-5 flex justify-between items-center cursor-pointer active:scale-[0.98] transition-all border border-transparent hover:border-white/10"
                >
                    <span className="font-black font-oswald text-2xl uppercase tracking-tighter text-white">Around the Clock</span>
                    <ArrowLeft className="w-6 h-6 text-white rotate-180" />
                </div>

                <div className="h-4" /> {/* Spacer */}

            </div>
        </div>
    );
}
