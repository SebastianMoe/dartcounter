export type GameType = '301' | '501' | '701' | 'Custom' | 'Cricket';

export interface Player {
    id: string;
    name: string;
    score: number; // Current remaining score or cricket points
    legsWon: number;
    setsWon: number;
    cricketData?: CricketMarks; // Tracks marks for 15-20 and Bull
}

export type CricketNumber = 15 | 16 | 17 | 18 | 19 | 20 | 25;

export interface CricketMarks {
    [key: number]: number; // 0, 1, 2, or 3 marks
}

export interface Throw {
    score: number;
    multiplier: 1 | 2 | 3;
    segment: number; // 0-20, 25
    isDouble: boolean;
    isTriple: boolean;
    isOuterBull: boolean;
    isInnerBull: boolean;
    isManual?: boolean;
}

export interface Turn {
    id: string; // Unique turn ID
    playerId: string;
    throws: Throw[];
    scoreBefore: number;
    scoreAfter: number;
    isBust: boolean;
}

export interface GameState {
    id: string;
    type: GameType;
    players: Player[];
    currentPlayerId: string;
    winnerId: string | null;
    turns: Turn[];
    // X01 specific
    startingScore?: number;
    matchConfig?: MatchConfig;
    legWinnerId?: string | null;
}

export type MatchMode = 'firstTo' | 'bestOf';

export interface MatchConfig {
    mode: MatchMode;
    target: number; // e.g. 3 legs
}
// Player Management Types
export type PlayerType = 'local' | 'guest' | 'online';

export interface PlayerProfile {
    id: string;
    name: string;
    type: PlayerType;
    isOnline?: boolean;
    onlineId?: string;
    createdAt: number;
    email?: string;
    onlineStatus?: 'online' | 'offline' | 'in-game';
    stats?: {
        gamesPlayed: number;
        gamesWon: number;
        // extended stats later
    }
}

export interface OnlineGameSession {
    id: string;
    hostId: string;
    guestId: string;
    status: 'pending' | 'accepted' | 'declined' | 'active' | 'finished';
    gameType: GameType;
    config: any;
}
