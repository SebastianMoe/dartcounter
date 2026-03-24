import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface MatchStats {
    playerId: string;
    onlineId?: string;
    playerName: string;
    average: number;
    first9Avg: number;
    dartsThrown: number;
    checkoutRate: number; // 0-100
    highFinish: number;
    scores: {
        '180': number;
        '140+': number;
        '120+': number;
        '100+': number;
        '80+': number;
        '60+': number;
    };
}

export interface MatchResult {
    id: string;
    timestamp: string; // ISO string
    matchType: 'X01' | 'Cricket' | 'Clock';
    winnerId: string;
    players: MatchStats[];
    config: any;
}

interface HistoryStore {
    matchHistory: MatchResult[];
    addMatchResult: (result: MatchResult) => void;
    clearHistory: () => void;
    getGlobalStats: (playerId: string, days?: number) => {
        avg: number;
        totalDarts: number;
        totalMatches: number;
        totalWins: number;
        highestFinish: number;
        bestAverage: number;
        scoreDistribution: Record<string, number>;
        historyData: { date: string; avg: number }[];
    } | null;
}

export const useHistoryStore = create<HistoryStore>()(
    persist(
        (set, get) => ({
            matchHistory: [],

            addMatchResult: (result) => set((state) => ({
                matchHistory: [result, ...state.matchHistory].slice(0, 1000) // Keep last 1000 matches
            })),

            clearHistory: () => set({ matchHistory: [] }),

            getGlobalStats: (identifier, days) => {
                const now = new Date();
                const filteredHistory = get().matchHistory.filter(m => {
                    if (!days) return true;
                    const matchDate = new Date(m.timestamp);
                    const diffTime = Math.abs(now.getTime() - matchDate.getTime());
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    return diffDays <= days;
                }).filter(m => m.players.some(p => p.playerId === identifier || p.playerName === identifier));

                if (filteredHistory.length === 0) return null;

                let totalAvg = 0;
                let totalDarts = 0;
                let totalWins = 0;
                let highestFinish = 0;
                let bestAverage = 0;
                const scoreDist: Record<string, number> = { '180': 0, '140+': 0, '120+': 0, '100+': 0, '80+': 0, '60+': 0 };
                const historyData: { date: string; avg: number }[] = [];

                filteredHistory.forEach(m => {
                    const p = m.players.find(ps => ps.playerId === identifier || ps.playerName === identifier);
                    if (!p) return;

                    const winner = m.players.find(ps => ps.playerId === m.winnerId);
                    const isWinner = winner && (winner.playerId === identifier || winner.playerName === identifier);

                    totalAvg += p.average;
                    totalDarts += p.dartsThrown;
                    if (isWinner) totalWins++;
                    if (p.highFinish > highestFinish) highestFinish = p.highFinish;
                    if (p.average > bestAverage) bestAverage = p.average;

                    Object.entries(p.scores).forEach(([key, val]) => {
                        scoreDist[key] = (scoreDist[key] || 0) + val;
                    });

                    historyData.push({
                        date: m.timestamp.split('T')[0],
                        avg: p.average
                    });
                });

                return {
                    avg: totalAvg / filteredHistory.length,
                    totalDarts,
                    totalMatches: filteredHistory.length,
                    totalWins,
                    highestFinish,
                    bestAverage,
                    scoreDistribution: scoreDist,
                    historyData: historyData.reverse()
                };
            }
        }),
        {
            name: 'darts-history-storage'
        }
    )
);
