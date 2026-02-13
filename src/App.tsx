import { lazy, Suspense, useState } from 'react'
import { Button } from "@/components/ui/button"
import { useX01Store } from "@/lib/store"
import { usePlayerStore } from "@/lib/player-store"
import { PlayerSelection } from "@/components/player-selection"

import { GameSetup } from "@/components/game-setup"
import type { GameType, MatchMode } from "@/lib/types"

const Scoreboard = lazy(() => import("@/components/scoreboard").then(module => ({ default: module.Scoreboard })))
const CricketScoreboard = lazy(() => import("@/components/cricket-scoreboard").then(module => ({ default: module.CricketScoreboard })))
const Numpad = lazy(() => import("@/components/numpad").then(module => ({ default: module.Numpad })))
import { useCricketStore } from '@/lib/cricket-store'
import { useAuthStore } from '@/lib/auth-store'
import { useMultiplayerStore } from '@/lib/multiplayer-store'
import { InvitationOverlay } from '@/components/invitation-overlay'
import { useRealtimeSync } from '@/hooks/useRealtimeSync'
import { useEffect } from 'react'

function App() {
  const { gameId: x01Id, initGame: initX01 } = useX01Store()
  const { gameId: cricketId, initGame: initCricket } = useCricketStore()
  const { activePlayerIds, getProfile } = usePlayerStore()
  const { initialize: initAuth, user } = useAuthStore()
  const { initialize: initMultiplayer } = useMultiplayerStore()

  useRealtimeSync();

  const [view, setView] = useState<'home' | 'players' | 'game-setup'>('home')

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  useEffect(() => {
    if (user) {
      initMultiplayer();
    }
  }, [user, initMultiplayer]);
  const [inputMode, setInputMode] = useState<'single' | 'total'>('single')

  const gameId = x01Id || cricketId;
  const isCricket = !!cricketId;

  const handlePlayerSelectionComplete = () => {
    setView('game-setup');
  };

  const handleStartGame = (type: GameType, customScore?: number, matchConfig?: { mode: MatchMode, target: number }) => {
    // Collect selected profile names
    const selectedProfiles = activePlayerIds
      .map(id => getProfile(id))
      .filter((p): p is NonNullable<typeof p> => !!p);

    const names = selectedProfiles.map(p => p.name);

    if (names.length > 0) {
      if (type === 'Cricket') {
        initCricket(names, matchConfig);
      } else {
        initX01(type, names, customScore, matchConfig);
      }
    }
  };

  // 1. Game Active? Show Game View
  if (gameId) {
    return (
      <div className="h-[100dvh] w-full flex flex-col bg-background">
        <InvitationOverlay />
        <Suspense fallback={<div className="p-4 text-center">Loading Game...</div>}>
          <div className="flex-1 overflow-y-auto min-h-0">
            {isCricket ? <CricketScoreboard /> : <Scoreboard inputMode={inputMode} />}
          </div>
          {!isCricket && (
            <div className="flex-none bg-card border-t p-2 safe-area-bottom">
              <Numpad mode={inputMode} setMode={setInputMode} />
            </div>
          )}
        </Suspense>
      </div>
    )
  }

  // 2. Navigation State
  if (view === 'players') {
    return <PlayerSelection onStart={handlePlayerSelectionComplete} onBack={() => setView('home')} />;
  }

  if (view === 'game-setup') {
    return <GameSetup onStart={handleStartGame} onBack={() => setView('players')} />;
  }

  // 3. Landing / Home View
  return (
    <div className="h-[100dvh] w-full flex flex-col items-center justify-center p-4 gap-4 bg-background">
      <h1 className="text-4xl font-bold tracking-tight mb-8">Darts PWA</h1>
      <Button size="lg" className="h-16 w-full max-w-sm text-xl font-bold" onClick={() => setView('players')}>
        New Game
      </Button>
      <Button variant="outline" size="lg" className="h-16 w-full max-w-sm text-xl" disabled>
        Statistics (Soon)
      </Button>
    </div>
  )
}

export default App
