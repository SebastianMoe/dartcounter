import { ArrowLeft, TrendingUp, Target, Trophy, Clock, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useHistoryStore } from "@/lib/history-store";
import { useAuthStore } from "@/lib/auth-store";
import { useState, useMemo } from "react";
import { ConfirmDialog } from "./confirm-dialog";
import { cn } from "@/lib/utils";

export function StatsPage({ onBack }: { onBack: () => void }) {
    const { matchHistory, getGlobalStats, clearHistory } = useHistoryStore();
    const { profile: userProfile } = useAuthStore();
    const [days, setDays] = useState<number | undefined>(undefined);
    const [showResetConfirm, setShowResetConfirm] = useState(false);

    // Filter stats by logged in user or most frequent
    const playerName = useMemo(() => {
        if (userProfile) return userProfile.name;
        if (matchHistory.length === 0) return "No data";
        const counts: Record<string, number> = {};
        matchHistory.forEach(m => m.players.forEach(p => {
            counts[p.playerName] = (counts[p.playerName] || 0) + 1;
        }));
        return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
    }, [matchHistory, userProfile]);

    const stats = useMemo(() => getGlobalStats(playerName, days), [playerName, days, matchHistory]);

    if (!userProfile) {
        return (
            <div className="flex flex-col h-[100dvh] bg-[#131E18] text-white">
                <Header onBack={onBack} title="Statistics" />
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                    <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-4">
                        <Trophy className="w-10 h-10 text-white/20" />
                    </div>
                    <h2 className="text-2xl font-black font-oswald uppercase mb-2">Login Required</h2>
                    <p className="text-white/40 mb-8">Please log in to track and view your personal statistics.</p>
                    <Button onClick={onBack} className="bg-dart-green text-white font-black px-8">Back to Menu</Button>
                </div>
            </div>
        );
    }

    if (!stats) {
        return (
            <div className="flex flex-col h-[100dvh] bg-[#131E18] text-white">
                <Header onBack={onBack} title="Statistics" />
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                    <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-4">
                        <TrendingUp className="w-10 h-10 text-white/20" />
                    </div>
                    <h2 className="text-2xl font-black font-oswald uppercase mb-2">No Stats Yet</h2>
                    <p className="text-white/40 mb-8">Play some matches to see your performance history here.</p>
                    <Button onClick={onBack} className="bg-dart-green text-white font-black px-8">Back to Menu</Button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-[100dvh] bg-[#131E18] text-white overflow-hidden">
            <Header onBack={onBack} title="Statistics" onReset={() => setShowResetConfirm(true)} />

            <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-6 pb-24">
                {/* ... existing content ... */}
                {/* (I'll need to keep the content inside) */}
                {/* Time Selector */}
                <div className="flex gap-2 p-1 bg-white/5 rounded-2xl">
                    <FilterTab active={days === 7} onClick={() => setDays(7)} label="7 Days" />
                    <FilterTab active={days === 30} onClick={() => setDays(30)} label="30 Days" />
                    <FilterTab active={days === undefined} onClick={() => setDays(undefined)} label="All Time" />
                </div>

                {/* Main Stats Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <StatCard label="Career Avg" value={stats.avg.toFixed(1)} icon={<TrendingUp className="w-4 h-4" />} color="text-dart-green" />
                    <StatCard label="Highest Finish" value={stats.highestFinish || "-"} icon={<Target className="w-4 h-4" />} color="text-dart-red" />
                    <StatCard label="Matches" value={stats.totalMatches} icon={<Clock className="w-4 h-4" />} color="text-dart-orange" />
                    <StatCard label="Wins" value={stats.totalWins} icon={<Trophy className="w-4 h-4" />} color="text-yellow-500" />
                </div>

                {/* Graph Card */}
                <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="text-sm font-black text-white/40 uppercase tracking-widest leading-none mb-1">Average Progress</h3>
                            <p className="text-xs text-white/20">3-dart average over time</p>
                        </div>
                        <TrendingUp className="w-5 h-5 text-dart-green" />
                    </div>

                    <div className="h-48 w-full relative group">
                        <SimpleLineChart data={stats.historyData} />
                    </div>
                </div>

                {/* Score Distribution */}
                <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
                    <h3 className="text-sm font-black text-white/40 uppercase tracking-widest leading-none mb-6">Score Distribution</h3>
                    <div className="space-y-4">
                        {Object.entries(stats.scoreDistribution).reverse().map(([label, count]) => {
                            // Find max for scaling
                            const max = Math.max(...Object.values(stats.scoreDistribution));
                            const percent = max > 0 ? (count / max) * 100 : 0;
                            return (
                                <div key={label} className="space-y-1">
                                    <div className="flex justify-between text-xs font-black">
                                        <span className={cn(
                                            label === '180' ? 'text-dart-red' : 'text-white/60'
                                        )}>{label}</span>
                                        <span className="text-white">{count}</span>
                                    </div>
                                    <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-dart-green transition-all duration-1000 ease-out"
                                            style={{ width: `${percent}%` }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            <ConfirmDialog
                isOpen={showResetConfirm}
                title="Wipe All History?"
                description="This will permanently delete ALL match statistics. This cannot be undone."
                onConfirm={() => {
                    clearHistory();
                    setShowResetConfirm(false);
                }}
                onCancel={() => setShowResetConfirm(false)}
                variant="destructive"
                confirmText="Delete All"
            />
        </div>
    );
}

function Header({ onBack, title, onReset }: { onBack: () => void, title: string, onReset?: () => void }) {
    return (
        <div className="flex items-center justify-between p-4 flex-none border-b border-white/10">
            <Button variant="ghost" size="icon" onClick={onBack} className="text-white hover:bg-white/10">
                <ArrowLeft className="w-6 h-6" />
            </Button>
            <h1 className="text-2xl font-black font-oswald tracking-tighter uppercase">{title}</h1>
            {onReset ? (
                <Button variant="ghost" size="icon" onClick={onReset} className="text-dart-red hover:bg-dart-red/10">
                    <Trash2 className="w-5 h-5" />
                </Button>
            ) : (
                <div className="w-10"></div>
            )}
        </div>
    );
}

function FilterTab({ active, onClick, label }: { active: boolean, onClick: () => void, label: string }) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "flex-1 h-10 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                active ? "bg-white/10 text-white" : "text-white/30 hover:text-white/50"
            )}
        >
            {label}
        </button>
    );
}

function StatCard({ label, value, icon, color }: { label: string, value: string | number, icon: React.ReactNode, color: string }) {
    return (
        <div className="bg-white/5 border border-white/5 p-4 rounded-3xl">
            <div className="flex items-center gap-1.5 text-[8px] font-black text-white/30 uppercase tracking-widest mb-2">
                {icon}
                {label}
            </div>
            <div className={cn("text-2xl font-black font-oswald leading-none", color)}>{value}</div>
        </div>
    );
}

function SimpleLineChart({ data }: { data: { date: string, avg: number }[] }) {
    if (data.length < 2) return (
        <div className="w-full h-full flex flex-col items-center justify-center opacity-20">
            <div className="w-full h-px bg-white/10 mb-8" />
            <p className="text-[10px] font-black uppercase tracking-widest">More matches needed</p>
        </div>
    );

    const minAvg = Math.min(...data.map(d => d.avg)) - 5;
    const maxAvg = Math.max(...data.map(d => d.avg)) + 5;
    const range = maxAvg - minAvg;

    // Create points
    const pointsData = data.map((d, i) => {
        const x = (i / (data.length - 1)) * 100;
        const y = 100 - ((d.avg - minAvg) / range) * 100;
        return { x, y, avg: d.avg };
    });

    const pointsPath = pointsData.map(p => `${p.x},${p.y}`).join(' ');

    return (
        <svg viewBox="0 0 100 100" className="w-full h-full preserve-3d" preserveAspectRatio="none">
            <defs>
                <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#24C781" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#24C781" stopOpacity="0" />
                </linearGradient>
            </defs>
            {/* Area */}
            <path
                d={`M 0,100 L ${pointsPath} L 100,100 Z`}
                fill="url(#chartGradient)"
                className="animate-in fade-in slide-in-from-bottom-2 duration-1000"
            />
            {/* Line */}
            <polyline
                fill="none"
                stroke="#24C781"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={pointsPath}
                className="animate-in fade-in duration-1000"
                strokeDasharray="400"
                strokeDashoffset="0"
            />
            {/* Value Labels */}
            {pointsData.map((p, i) => (
                <g key={i}>
                    <circle cx={p.x} cy={p.y} r="1.5" fill="#24C781" />
                    <text
                        x={p.x}
                        y={p.y - 4}
                        fontSize="3"
                        fill="white"
                        textAnchor="middle"
                        fontWeight="black"
                        className="animate-in fade-in duration-500 delay-500"
                    >
                        {p.avg.toFixed(1)}
                    </text>
                </g>
            ))}
        </svg>
    );
}
