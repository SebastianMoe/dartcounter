import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, Users, SlidersHorizontal, X } from "lucide-react";
import type { GameType, MatchMode, InMode, OutMode, MatchLengthType } from '@/lib/types';
import { usePlayerStore } from '@/lib/player-store';
import { useAuthStore } from '@/lib/auth-store';
import { cn } from "@/lib/utils";
import { useMultiplayerStore } from '@/lib/multiplayer-store';

interface GameSetupProps {
    initialGameType?: GameType;
    onStart: (type: GameType, customScore?: number, matchConfig?: any) => void;
    onBack: () => void;
    onAddPlayer?: () => void;
}

export function GameSetup({ initialGameType = '501', onStart, onBack, onAddPlayer }: GameSetupProps) {
    const { activePlayerIds, getProfile, togglePlayerSelection } = usePlayerStore();
    const { user } = useAuthStore();
    const activeProfiles = activePlayerIds.map(id => getProfile(id)).filter(Boolean);

    const [gameType, setGameType] = useState<GameType>(initialGameType);
    const [customScore] = useState<string>("170");

    // Match Config State
    const [matchMode, setMatchMode] = useState<MatchMode>('firstTo');
    const [matchTarget, setMatchTarget] = useState<number>(1); // Default 1 leg
    const [lengthType, setLengthType] = useState<MatchLengthType>('legs');
    const [inMode, setInMode] = useState<InMode>('single');
    const [outMode, setOutMode] = useState<OutMode>('double');

    // Around the Clock State
    const [useSkips, setUseSkips] = useState(true);
    const [finishMode, setFinishMode] = useState<'bull' | 'outer-bull'>('bull');

    const { activeSession } = useMultiplayerStore();
    const isHost = activeSession?.host_id === user?.id;

    // Auto-add logged in user AND guest if online
    useEffect(() => {
        if (user && !activePlayerIds.includes(user.id)) {
            togglePlayerSelection(user.id);
        }

        // Auto-add guest if I am host
        if (isHost && activeSession?.target_id && !activePlayerIds.includes(activeSession.target_id)) {
            togglePlayerSelection(activeSession.target_id);
        }
    }, [user, activePlayerIds, togglePlayerSelection, isHost, activeSession]);

    const handleStart = () => {
        let config: any = {
            mode: matchMode,
            target: matchTarget,
            lengthType,
            inMode,
            outMode
        };

        if (gameType === 'Custom') {
            const score = parseInt(customScore);
            if (!isNaN(score) && score > 0) {
                onStart('Custom', score, config);
            }
        } else if (gameType === 'Around the Clock') {
            config = { useSkips, finishMode };
            onStart('Around the Clock', undefined, config);
        } else {
            onStart(gameType, undefined, config);
        }
    };

    const adjustTarget = (delta: number) => {
        setMatchTarget(prev => Math.max(1, Math.min(21, prev + delta)));
    };

    return (
        <div className="flex flex-col h-[100dvh] bg-background text-foreground overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 flex-none">
                <Button variant="ghost" size="icon" onClick={onBack} className="text-white hover:bg-white/10">
                    <ArrowLeft className="w-6 h-6" />
                </Button>
                <h1 className="text-2xl font-black font-oswald tracking-tighter uppercase text-white">
                    {gameType === 'Cricket' ? 'Cricket' : gameType === 'Around the Clock' ? 'Around the Clock' : 'Match'}
                </h1>
                <div className="w-10"></div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24">

                {/* PLAYER DETAILS SECTION */}
                <div className="bg-card rounded-2xl p-4 border border-border text-white">
                    <div className="flex items-center gap-2 mb-4">
                        <Users className="w-5 h-5" />
                        <h2 className="text-xl font-black tracking-tighter uppercase">Player Details</h2>
                    </div>

                    <div className="grid grid-cols-2 gap-2 bg-[#131E18] p-1 rounded-xl mb-6">
                        <Button variant="secondary" className="rounded-lg font-bold text-white bg-card hover:bg-card/80">Single players</Button>
                        <Button variant="ghost" className="rounded-lg font-bold text-muted-foreground whitespace-nowrap">
                            Teams <span className="text-[10px] opacity-70 ml-1">(coming soon)</span>
                        </Button>
                    </div>

                    <div className="flex gap-4 overflow-x-auto pb-2 snap-x">
                        {activeProfiles.map(p => (
                            <div key={p!.id} className="flex flex-col items-center gap-2 min-w-[72px] shrink-0 snap-center">
                                <div className="w-16 h-16 rounded-full bg-blue-200 text-blue-900 flex items-center justify-center font-black text-3xl border-2 border-white/20 relative">
                                    {p?.name[0].toUpperCase()}
                                    <div
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            togglePlayerSelection(p!.id);
                                        }}
                                        className="absolute -top-1 -right-1 w-6 h-6 bg-dart-red rounded-full flex items-center justify-center border border-background cursor-pointer hover:scale-110 transition-transform"
                                    >
                                        <X className="w-4 h-4 text-white" />
                                    </div>
                                </div>
                                <span className="font-bold text-sm truncate w-full text-center text-white">{p?.name.substring(0, 5)}...</span>
                            </div>
                        ))}
                        {!activeSession && (
                            <div className="flex flex-col items-center gap-2 min-w-[72px] shrink-0 snap-center justify-center" onClick={onAddPlayer}>
                                <div className="w-16 h-16 rounded-full border-2 border-dashed border-border flex items-center justify-center text-muted-foreground hover:bg-white/5 cursor-pointer">
                                    <Plus className="w-6 h-6" />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* GAME SETTINGS SECTION */}
                <div className="bg-card rounded-2xl p-4 border border-border text-white">
                    <div className="flex items-center gap-2 mb-6">
                        <SlidersHorizontal className="w-5 h-5" />
                        <h2 className="text-xl font-black tracking-tighter uppercase">Game Settings</h2>
                    </div>

                    {/* Match Length Grid */}
                    <div className="grid grid-cols-[1fr_auto_1fr] gap-3 mb-6 items-stretch">
                        <div className="flex flex-col gap-2">
                            <Button variant="ghost" className={cn("rounded-xl font-bold h-12 bg-[#131E18]", matchMode === 'bestOf' ? "text-white ring-1 ring-border" : "text-muted-foreground")} onClick={() => setMatchMode('bestOf')}>Best of</Button>
                            <Button variant="ghost" className={cn("rounded-xl font-bold h-12 bg-[#131E18]", matchMode === 'firstTo' ? "text-white ring-1 ring-border" : "text-muted-foreground")} onClick={() => setMatchMode('firstTo')}>First to</Button>
                        </div>

                        <div className="bg-dart-orange rounded-xl w-14 flex flex-col items-center justify-between py-2 text-white font-black text-2xl">
                            <ArrowLeft className="w-6 h-6 rotate-90 cursor-pointer opacity-70 hover:opacity-100" onClick={() => adjustTarget(1)} />
                            <span>{matchTarget}</span>
                            <ArrowLeft className="w-6 h-6 -rotate-90 cursor-pointer opacity-70 hover:opacity-100" onClick={() => adjustTarget(-1)} />
                        </div>

                        <div className="flex flex-col gap-2">
                            <Button variant="ghost" className={cn("rounded-xl font-bold h-12 bg-[#131E18]", lengthType === 'legs' ? "text-white ring-1 ring-border" : "text-muted-foreground")} onClick={() => setLengthType('legs')}>Legs</Button>
                            <Button variant="ghost" className={cn("rounded-xl font-bold h-12 bg-[#131E18]", lengthType === 'sets' ? "text-white ring-1 ring-border" : "text-muted-foreground")} onClick={() => setLengthType('sets')}>Sets</Button>
                        </div>
                    </div>

                    {gameType !== 'Cricket' && (
                        <>
                            <div className="grid grid-cols-4 gap-2 bg-[#131E18] p-1 rounded-xl mb-6">
                                {['301', '501', '701'].map(t => (
                                    <Button key={t} variant={gameType === t ? "secondary" : "ghost"} onClick={() => setGameType(t as GameType)} className={cn("rounded-lg font-bold", gameType === t ? "bg-card text-white" : "text-muted-foreground")}>
                                        {t}
                                    </Button>
                                ))}
                                <Button
                                    variant={gameType === 'Around the Clock' ? "secondary" : "ghost"}
                                    onClick={() => setGameType('Around the Clock')}
                                    className={cn("rounded-lg font-bold", gameType === 'Around the Clock' ? "bg-card text-white" : "text-muted-foreground")}
                                >
                                    Clock
                                </Button>
                            </div>

                            {gameType === 'Around the Clock' ? (
                                <div className="space-y-4 animate-in fade-in slide-in-from-top-4">
                                    <Button
                                        variant={useSkips ? "secondary" : "ghost"}
                                        onClick={() => setUseSkips(!useSkips)}
                                        className={cn("w-full h-12 rounded-xl font-bold bg-[#131E18]", useSkips ? "text-white ring-1 ring-white/20" : "text-muted-foreground")}
                                    >
                                        Multipliers count (+2/+3)
                                    </Button>
                                    <div className="grid grid-cols-2 gap-2 bg-[#131E18] p-1 rounded-xl">
                                        <Button
                                            variant={finishMode === 'bull' ? "secondary" : "ghost"}
                                            onClick={() => setFinishMode('bull')}
                                            className={cn("rounded-lg font-bold", finishMode === 'bull' ? "bg-card text-white" : "text-muted-foreground")}
                                        >
                                            Any Bull
                                        </Button>
                                        <Button
                                            variant={finishMode === 'outer-bull' ? "secondary" : "ghost"}
                                            onClick={() => setFinishMode('outer-bull')}
                                            className={cn("rounded-lg font-bold", finishMode === 'outer-bull' ? "bg-card text-white" : "text-muted-foreground")}
                                        >
                                            Inner Bull
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="grid grid-cols-3 gap-2 bg-[#131E18] p-1 rounded-xl mb-6">
                                        <Button variant={inMode === 'single' ? "secondary" : "ghost"} onClick={() => setInMode('single')} className={cn("rounded-lg font-bold", inMode === 'single' ? "bg-card text-white" : "text-muted-foreground")}>Straight in</Button>
                                        <Button variant={inMode === 'double' ? "secondary" : "ghost"} onClick={() => setInMode('double')} className={cn("rounded-lg font-bold", inMode === 'double' ? "bg-card text-white" : "text-muted-foreground")}>Double in</Button>
                                        <Button variant={inMode === 'master' ? "secondary" : "ghost"} onClick={() => setInMode('master')} className={cn("rounded-lg font-bold", inMode === 'master' ? "bg-card text-white" : "text-muted-foreground")}>Master in</Button>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 bg-[#131E18] p-1 rounded-xl mb-6">
                                        <Button variant={outMode === 'double' ? "secondary" : "ghost"} onClick={() => setOutMode('double')} className={cn("rounded-lg font-bold", outMode === 'double' ? "bg-card text-white" : "text-muted-foreground")}>Double out</Button>
                                        <Button variant={outMode === 'master' ? "secondary" : "ghost"} onClick={() => setOutMode('master')} className={cn("rounded-lg font-bold", outMode === 'master' ? "bg-card text-white" : "text-muted-foreground")}>Master out</Button>
                                        <Button variant={outMode === 'single' ? "secondary" : "ghost"} onClick={() => setOutMode('single')} className={cn("rounded-lg font-bold", outMode === 'single' ? "bg-card text-white" : "text-muted-foreground")}>Straight out</Button>
                                    </div>
                                </>
                            )}
                        </>
                    )}
                </div>
            </div>

            <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-sm border-t border-border z-50">
                <Button
                    size="lg"
                    className="w-full h-14 text-xl font-black uppercase tracking-tighter bg-dart-orange hover:bg-dart-orange/90 text-white shadow-lg"
                    onClick={handleStart}
                    disabled={activeSession && !isHost}
                >
                    {activeSession && !isHost ? "Waiting for Host..." : "Start Match"}
                </Button>
            </div>
        </div>
    );
}
