import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { ArrowLeft, Play, Minus, Plus } from "lucide-react";
import type { GameType, MatchMode } from '@/lib/types';

interface GameSetupProps {
    onStart: (type: GameType, customScore?: number, matchConfig?: { mode: MatchMode, target: number }) => void;
    onBack: () => void;
}

export function GameSetup({ onStart, onBack }: GameSetupProps) {
    const [gameType, setGameType] = useState<GameType>('501');
    const [customScore, setCustomScore] = useState<string>("501");

    // Match Config State
    const [matchMode, setMatchMode] = useState<MatchMode>('firstTo');
    const [matchTarget, setMatchTarget] = useState<number>(1); // Default 1 leg

    const handleStart = () => {
        const config = { mode: matchMode, target: matchTarget };

        if (gameType === 'Custom') {
            const score = parseInt(customScore);
            if (!isNaN(score) && score > 0) {
                onStart('Custom', score, config);
            }
        } else {
            onStart(gameType, undefined, config);
        }
    };

    const adjustTarget = (delta: number) => {
        setMatchTarget(prev => Math.max(1, Math.min(21, prev + delta)));
    };

    return (
        <div className="flex flex-col h-full bg-background max-w-md mx-auto w-full animate-in slide-in-from-right">
            {/* Header - Fixed */}
            <div className="flex items-center justify-between p-4 flex-none border-b">
                <Button variant="ghost" size="icon" onClick={onBack}>
                    <ArrowLeft className="w-6 h-6" />
                </Button>
                <h1 className="text-2xl font-bold">Game Setup</h1>
                <div className="w-10" /> {/* Spacer */}
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-8 pb-4">
                {/* Game Mode */}
                <div className="space-y-3">
                    <label className="text-lg font-semibold text-muted-foreground uppercase tracking-wider block">Game Mode</label>
                    <div className="grid grid-cols-2 gap-3">
                        <Button
                            variant={['301', '501', '701', 'Custom'].includes(gameType) ? "default" : "outline"}
                            className="h-20 text-xl font-bold"
                            onClick={() => setGameType('501')}
                        >
                            X01
                        </Button>
                        <Button
                            variant={gameType === 'Cricket' ? "default" : "outline"}
                            className="h-20 text-xl font-bold"
                            onClick={() => setGameType('Cricket')}
                        >
                            Cricket
                        </Button>
                    </div>
                </div>

                {/* X01 Options */}
                {['301', '501', '701', 'Custom'].includes(gameType) && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-4">
                        <label className="text-lg font-semibold text-muted-foreground uppercase tracking-wider block">Starting Score</label>
                        <div className="grid grid-cols-4 gap-2">
                            {(['301', '501', '701'] as GameType[]).map(t => (
                                <Button
                                    key={t}
                                    variant={gameType === t ? "default" : "outline"}
                                    onClick={() => setGameType(t)}
                                    className="font-bold"
                                >
                                    {t}
                                </Button>
                            ))}
                            <Button
                                variant={gameType === 'Custom' ? "default" : "outline"}
                                onClick={() => setGameType('Custom')}
                                className="font-bold"
                            >
                                Custom
                            </Button>
                        </div>

                        {gameType === 'Custom' && (
                            <div className="pt-2 animate-in fade-in">
                                <label className="text-sm font-medium leading-none mb-2 block">Enter Score</label>
                                <input
                                    type="number"
                                    value={customScore}
                                    onChange={(e) => setCustomScore(e.target.value)}
                                    className="flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 text-2xl font-mono"
                                    placeholder="e.g. 1001"
                                />
                            </div>
                        )}
                    </div>
                )}

                {/* Match Config (Legs / Sets) */}
                <div className="space-y-4 pt-4 border-t">
                    <label className="text-lg font-semibold text-muted-foreground uppercase tracking-wider block">Match Length</label>

                    {/* Mode Selector */}
                    <div className="grid grid-cols-2 gap-3">
                        <Button
                            variant={matchMode === 'firstTo' ? "default" : "outline"}
                            onClick={() => setMatchMode('firstTo')}
                            className="flex flex-col h-16"
                        >
                            <span className="font-bold">First To</span>
                            <span className="text-xs opacity-70">Win X Legs</span>
                        </Button>
                        <Button
                            variant={matchMode === 'bestOf' ? "default" : "outline"}
                            onClick={() => setMatchMode('bestOf')}
                            className="flex flex-col h-16"
                        >
                            <span className="font-bold">Best Of</span>
                            <span className="text-xs opacity-70">Majority of X</span>
                        </Button>
                    </div>

                    {/* Counter */}
                    <div className="flex items-center justify-between bg-card p-4 rounded-lg border">
                        <span className="text-xl font-medium">Legs</span>
                        <div className="flex items-center gap-4">
                            <Button
                                variant="outline" size="icon" className="h-12 w-12 rounded-full"
                                onClick={() => adjustTarget(-1)}
                                disabled={matchTarget <= 1}
                            >
                                <Minus className="h-6 w-6" />
                            </Button>
                            <span className="text-3xl font-mono font-bold w-12 text-center">{matchTarget}</span>
                            <Button
                                variant="outline" size="icon" className="h-12 w-12 rounded-full"
                                onClick={() => adjustTarget(1)}
                            >
                                <Plus className="h-6 w-6" />
                            </Button>
                        </div>
                    </div>
                    <p className="text-center text-sm text-muted-foreground">
                        {matchMode === 'firstTo'
                            ? `The first player to win ${matchTarget} legs wins the match.`
                            : `The player who wins ${Math.floor(matchTarget / 2) + 1} legs (out of ${matchTarget}) wins.`
                        }
                    </p>
                </div>
            </div>

            {/* Footer - Fixed */}
            <div className="flex-none p-4 pt-4 border-t bg-background">
                <Button size="lg" className="w-full h-16 text-xl font-bold bg-green-600 hover:bg-green-700 shadow-lg" onClick={handleStart}>
                    <Play className="w-6 h-6 mr-2" />
                    START GAME
                </Button>
            </div>
        </div>
    );
}
