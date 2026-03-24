import { Trophy, RefreshCcw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useX01Store } from "@/lib/store";
import { useHistoryStore } from "@/lib/history-store";
import { useAuthStore } from "@/lib/auth-store";
import { useEffect, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";

export function MatchSummary() {
    const { players, winnerId, history, rematch, resetGame, gameType, startingScore, matchConfig, currentTurn } = useX01Store();
    const { addMatchResult } = useHistoryStore();

    const winner = players.find(p => p.id === winnerId);

    // Calculate stats for each player
    const stats = useMemo(() => {
        return players.map(p => {
            const playerTurns = [
                ...history.filter(h => h.playerId === p.id),
                ...(currentTurn && currentTurn.playerId === p.id && (currentTurn.throws.length > 0 || currentTurn.isBust) ? [currentTurn] : [])
            ];
            const totalScore = playerTurns.reduce((sum, h) => sum + (h.scoreBefore - h.scoreAfter), 0);

            // Total darts logic: each turn in history is 3 darts (unless it was a finish).
            const totalDarts = playerTurns.reduce((sum, h) => {
                const isFinish = h.scoreAfter === 0;
                return sum + (isFinish ? h.throws.length : 3);
            }, 0);

            const avg = totalDarts > 0 ? (totalScore / totalDarts) * 3 : 0;
            const first9Sum = (p.first9Scores || []).reduce((a, b) => a + b, 0);
            const first9Avg = (p.first9Scores || []).length > 0 ? first9Sum / (p.first9Scores || []).length : 0;

            const checkoutRate = (p.checkoutAttempts || 0) > 0
                ? ((p.legsWon / p.checkoutAttempts!) * 100)
                : 0;

            // Score Distribution
            const dist = { '180': 0, '140+': 0, '120+': 0, '100+': 0, '80+': 0, '60+': 0 };
            playerTurns.forEach(h => {
                const s = h.scoreBefore - h.scoreAfter;
                if (s === 180) dist['180']++;
                else if (s >= 140) dist['140+']++;
                else if (s >= 120) dist['120+']++;
                else if (s >= 100) dist['100+']++;
                else if (s >= 80) dist['80+']++;
                else if (s >= 60) dist['60+']++;
            });

            return {
                ...p,
                average: avg,
                first9Avg: first9Avg,
                checkoutRate: checkoutRate,
                scoreDist: dist
            };
        });
    }, [players, history]);

    const hasSaved = useRef<string | null>(null);

    const { profile: userProfile } = useAuthStore();

    // Save to history once on mount
    useEffect(() => {
        if (winnerId && hasSaved.current !== winnerId && stats.length > 0 && userProfile) {
            hasSaved.current = winnerId;
            addMatchResult({
                id: crypto.randomUUID(),
                timestamp: new Date().toISOString(),
                matchType: 'X01',
                winnerId: winnerId,
                players: stats.map(s => ({
                    playerId: s.id,
                    onlineId: s.onlineId,
                    playerName: s.name,
                    average: s.average,
                    first9Avg: s.first9Avg,
                    dartsThrown: [
                        ...history.filter(h => h.playerId === s.id),
                        ...(currentTurn && currentTurn.playerId === s.id && (currentTurn.throws.length > 0 || currentTurn.isBust) ? [currentTurn] : [])
                    ].reduce((sum, h) => {
                        const isFinish = h.scoreAfter === 0;
                        return sum + (isFinish ? h.throws.length : 3);
                    }, 0),
                    checkoutRate: s.checkoutRate,
                    highFinish: s.highFinish || 0,
                    scores: s.scoreDist
                })),
                config: { gameType, startingScore, matchConfig }
            });
        }
    }, [winnerId, stats, addMatchResult, gameType, startingScore, matchConfig, history, currentTurn, userProfile]);

    if (!winnerId) return null;

    return (
        <div className="fixed inset-0 z-[100] bg-[#131E18]/95 backdrop-blur-xl flex flex-col items-center justify-center p-4 sm:p-8 animate-in fade-in zoom-in-95 duration-500">
            <div className="w-full max-w-4xl bg-white/5 border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="p-8 text-center bg-gradient-to-b from-dart-green/20 to-transparent border-b border-white/5">
                    <Trophy className="w-16 h-16 text-dart-green mx-auto mb-4 animate-bounce" />
                    <h1 className="text-4xl sm:text-6xl font-black text-white font-oswald tracking-tighter uppercase">
                        {winner?.name} Wins!
                    </h1>
                    <p className="text-white/40 font-bold tracking-widest uppercase mt-2">Match Summary</p>
                </div>

                {/* Stats Grid */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {stats.map(s => (
                            <div key={s.id} className={cn(
                                "p-6 rounded-3xl border transition-all",
                                s.id === winnerId ? "bg-dart-green/10 border-dart-green/20" : "bg-white/5 border-white/5"
                            )}>
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center font-black text-white">
                                        {s.name[0].toUpperCase()}
                                    </div>
                                    <div className="text-2xl font-black text-white font-oswald">{s.name}</div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 mb-8">
                                    <StatItem label="3-Dart Avg" value={s.average.toFixed(1)} />
                                    <StatItem label="First 9 Avg" value={s.first9Avg.toFixed(1)} />
                                    <StatItem label="Checkout %" value={s.checkoutRate.toFixed(1) + "%"} />
                                    <StatItem label="High Finish" value={s.highFinish || "-"} />
                                </div>

                                {/* Distribution */}
                                <div className="space-y-2">
                                    <div className="text-[10px] font-black uppercase text-white/30 tracking-widest mb-2">Score Distribution</div>
                                    <div className="grid grid-cols-6 gap-2">
                                        {Object.entries(s.scoreDist).reverse().map(([label, count]) => (
                                            <div key={label} className="flex flex-col items-center">
                                                <div className="text-xs font-black text-white mb-1">{count}</div>
                                                <div className="w-full bg-white/5 rounded-full h-1 relative overflow-hidden">
                                                    <div
                                                        className="absolute inset-y-0 left-0 bg-dart-green rounded-full transition-all duration-1000"
                                                        style={{ width: `${Math.min(count * 20, 100)}%` }}
                                                    />
                                                </div>
                                                <div className="text-[8px] font-black text-white/20 mt-1">{label}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Actions */}
                <div className="p-8 bg-black/20 border-t border-white/5 flex gap-4 justify-center">
                    <div className="flex gap-4 w-full max-w-md">
                        <Button
                            onClick={rematch}
                            className="flex-1 h-14 bg-dart-green hover:bg-dart-green/90 text-white rounded-2xl font-black text-lg gap-2 shadow-lg active:scale-95 transition-all"
                        >
                            <RefreshCcw className="w-5 h-5" />
                            Rematch
                        </Button>
                        <Button
                            variant="outline"
                            onClick={resetGame}
                            className="flex-1 h-14 bg-white/5 border-white/10 hover:bg-white/10 text-white rounded-2xl font-black text-lg gap-2 active:scale-95 transition-all text-ellipsis overflow-hidden"
                        >
                            <Home className="w-5 h-5 flex-none" />
                            <span className="truncate">Menu</span>
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function StatItem({ label, value }: { label: string, value: string | number }) {
    return (
        <div className="bg-black/20 p-3 rounded-2xl border border-white/5">
            <div className="text-[10px] font-black text-white/30 uppercase tracking-widest leading-none mb-1">{label}</div>
            <div className="text-2xl font-black text-white font-oswald leading-none">{value}</div>
        </div>
    );
}
