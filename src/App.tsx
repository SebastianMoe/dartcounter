import { lazy, Suspense, useState, useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { Button } from "@/components/ui/button"
import { useX01Store } from "@/lib/store"
import { usePlayerStore } from "@/lib/player-store"
import { PlayerSelection } from "@/components/player-selection"
import { GameMenu } from "@/components/game-menu"
import { GameSetup } from "@/components/game-setup"
import type { GameType, MatchConfig } from '@/lib/types';
import { useCricketStore } from '@/lib/cricket-store'
import { useAuthStore } from '@/lib/auth-store'
import { useMultiplayerStore } from '@/lib/multiplayer-store'
import { useAroundTheClockStore } from '@/lib/around-the-clock-store'
import { InvitationOverlay } from '@/components/invitation-overlay'
import { useRealtimeSync } from '@/hooks/useRealtimeSync'
import { PinOverlay } from '@/components/pin-overlay'
import { LineChart, Clock, LogOut, HelpCircle, ShieldCheck, Mic, User, X, Smartphone } from 'lucide-react'
import { Login } from '@/components/login'

const Scoreboard = lazy(() => import("@/components/scoreboard").then(module => ({ default: module.Scoreboard })))
const CricketScoreboard = lazy(() => import("@/components/cricket-scoreboard").then(module => ({ default: module.CricketScoreboard })))
const AroundTheClockScoreboard = lazy(() => import("@/components/around-the-clock-scoreboard").then(module => ({ default: module.AroundTheClockScoreboard })))
const Numpad = lazy(() => import("@/components/numpad").then(module => ({ default: module.Numpad })))
const StatsPage = lazy(() => import("@/components/stats-page").then(module => ({ default: module.StatsPage })))

function App() {
  const { gameId: x01Id, initGame: initX01 } = useX01Store()
  const { gameId: cricketId, initGame: initCricket } = useCricketStore()
  const { gameId: clockId, initGame: initClock } = useAroundTheClockStore()
  const { activePlayerIds, getProfile } = usePlayerStore()
  const { initialize: initAuth, user, signOut } = useAuthStore()
  const { initialize: initMultiplayer, activeSession } = useMultiplayerStore()

  useRealtimeSync();

  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('darts_app_authenticated') === 'true';
  });

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r: ServiceWorkerRegistration | undefined) {
      console.log('SW Registered: ' + r)
    },
    onRegisterError(error: any) {
      console.log('SW registration error', error)
    },
  })

  useEffect(() => {
    if (needRefresh) {
      updateServiceWorker(true)
    }
  }, [needRefresh, updateServiceWorker])

  const [view, setView] = useState<'home' | 'menu' | 'game-setup' | 'add-player' | 'stats'>('home')
  const [isOnlineFlow, setIsOnlineFlow] = useState(false)
  const [selectedGameType, setSelectedGameType] = useState<GameType>('501')
  const [showLogin, setShowLogin] = useState(false)
  const [showHelp, setShowHelp] = useState(false)

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  useEffect(() => {
    if (user) {
      initMultiplayer();
    }
  }, [user, initMultiplayer]);
  useEffect(() => {
    if (isAuthenticated && !localStorage.getItem('darts_help_shown_v1')) {
      setShowHelp(true);
      localStorage.setItem('darts_help_shown_v1', 'true');
    }
  }, [isAuthenticated]);

  const [inputMode, setInputMode] = useState<'single' | 'total'>('single')

  const gameId = x01Id || cricketId || clockId;
  const isCricket = !!cricketId;
  const isClock = !!clockId;


  const handleStartGame = (type: GameType, customScore?: number, matchConfig?: MatchConfig) => {
    // Collect selected profileNames
    const selectedProfiles = activePlayerIds
      .map(id => getProfile(id))
      .filter((p): p is NonNullable<typeof p> => !!p);

    const players = selectedProfiles.map(p => ({
      id: p.id,
      name: p.name,
      isOnline: p.isOnline,
      onlineId: p.onlineId
    }));

    if (players.length > 0) {
      if (type === 'Cricket') {
        initCricket(players, matchConfig);
      } else if (type === 'Around the Clock') {
        initClock(players, matchConfig as any);
      } else {
        initX01(type, players, customScore, matchConfig);
      }
    }
  };

  // 2. Navigation State & Synchronization
  useEffect(() => {
    if (activeSession && view !== 'game-setup' && !gameId) {
      const isHost = activeSession.host_id === user?.id;
      if (isHost && view === 'add-player') {
        setView('menu');
      }
    }
  }, [activeSession, user, view, gameId]);

  // 2. Game Active? Show Game View
  if (gameId) {
    return (
      <div className="h-[100dvh] w-full flex flex-col bg-background">
        <InvitationOverlay />
        <Suspense fallback={<div className="p-4 text-center">Loading Game...</div>}>
          <div className="flex-1 overflow-y-auto min-h-0">
            {isClock ? <AroundTheClockScoreboard /> : isCricket ? <CricketScoreboard /> : <Scoreboard />}
          </div>
          {!isCricket && (
            <div className="flex-none safe-area-bottom bg-[#131E18]">
              <Numpad mode={inputMode} setMode={setInputMode} />
            </div>
          )}
        </Suspense>
      </div>
    )
  }

  // 1. PIN Protection
  if (!isAuthenticated) {
    return <PinOverlay onAuthenticated={() => setIsAuthenticated(true)} />;
  }

  if (activeSession && !gameId && activeSession.target_id === user?.id) {
    return (
      <div className="h-[100dvh] w-full flex flex-col items-center justify-center bg-[#131E18] text-white p-8 text-center animate-in fade-in">
        <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6 animate-pulse">
          <Clock className="w-10 h-10 text-primary" />
        </div>
        <h1 className="text-3xl font-black font-oswald uppercase tracking-tighter mb-2">Connected!</h1>
        <p className="text-white/60 mb-8 max-w-xs mx-auto">Please wait for the host to select the game mode and start the match.</p>
        <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-full border border-white/10">
          <div className="w-2 h-2 bg-dart-green rounded-full animate-ping" />
          <span className="text-[10px] font-black uppercase tracking-widest opacity-50">Stable Connection</span>
        </div>
        <Button
          variant="ghost"
          className="mt-12 text-white/30 hover:text-white"
          onClick={() => useMultiplayerStore.getState().leaveSession()}
        >
          Cancel
        </Button>
      </div>
    );
  }

  if (view === 'menu') {
    return (
      <GameMenu
        onBack={() => setView('home')}
        onSelectMatch={() => {
          setSelectedGameType('501');
          setIsOnlineFlow(false);
          setView('game-setup');
        }}
        onSelectCricket={() => {
          setSelectedGameType('Cricket');
          setIsOnlineFlow(false);
          setView('game-setup');
        }}
        onSelectClock={() => {
          setSelectedGameType('Around the Clock');
          setIsOnlineFlow(false);
          setView('game-setup');
        }}
      />
    );
  }

  if (view === 'stats') {
    return <Suspense fallback={null}><StatsPage onBack={() => setView('home')} /></Suspense>;
  }

  if (view === 'add-player') {
    return <PlayerSelection isOnlineFlow={isOnlineFlow} onStart={() => setView('game-setup')} onBack={() => setView(isOnlineFlow ? 'home' : 'game-setup')} />;
  }

  if (view === 'game-setup') {
    return <GameSetup initialGameType={selectedGameType} onStart={handleStartGame} onBack={() => setView('menu')} onAddPlayer={() => setView('add-player')} />;
  }

  // 3. Landing / Home View
  return (
    <div className="h-[100dvh] w-full flex flex-col bg-background text-foreground overflow-hidden relative">
      {/* Help Button - Top Right */}
      <div className="absolute top-4 right-4 z-50">
        <Button
          variant="ghost"
          size="icon"
          className="text-white opacity-40 hover:opacity-100 transition-opacity"
          onClick={() => setShowHelp(true)}
        >
          <HelpCircle className="w-6 h-6" />
        </Button>
      </div>

      {/* Top Header */}
      <div className="flex items-center justify-center p-4">
        <div className="font-extrabold text-xl tracking-tighter uppercase">Moe Dart</div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {/* Profile Section */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            {user ? (
              <div className="w-12 h-12 bg-card rounded-full flex items-center justify-center text-xl font-bold border border-border">
                {user.email?.[0].toUpperCase() || 'S'}
              </div>
            ) : null}
            <div>
              {user ? (
                <div className="flex items-center gap-2">
                  <div className="font-bold text-lg leading-tight">{user.email?.split('@')[0] || 'Player'}</div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-white/30 hover:text-white hover:bg-white/10"
                    onClick={() => signOut()}
                    title="Ausloggen"
                  >
                    <LogOut className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <Button onClick={() => setShowLogin(true)} variant="outline" className="h-8 px-4 font-bold text-xs uppercase tracking-wider rounded-full mb-1">
                  Einloggen
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Main Actions */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div
            onClick={() => setView('menu')}
            className="bg-[var(--dart-red)] bg-gradient-to-br from-[var(--dart-red)] to-red-600 rounded-xl p-4 flex flex-col justify-center items-center aspect-square cursor-pointer active:scale-95 transition-transform border-4 border-[var(--dart-red)]"
          >
            <div className="font-black tracking-tighter text-2xl leading-none uppercase text-white text-center">Play<br />Local</div>
          </div>

          <div
            onClick={() => {
              setIsOnlineFlow(true);
              setView('add-player');
            }}
            className="bg-[var(--dart-orange)] bg-gradient-to-br from-[var(--dart-orange)] to-amber-500 rounded-xl p-4 flex flex-col justify-center items-center aspect-square cursor-pointer active:scale-95 transition-transform border-4 border-orange-500"
          >
            <div className="font-black tracking-tighter text-2xl leading-none uppercase text-white text-center">Play<br />Online</div>
          </div>
        </div>

        <div
          onClick={() => setView('stats')}
          className="bg-card rounded-xl p-4 flex justify-between items-center cursor-pointer active:scale-[0.98] transition-transform border border-white/5 hover:bg-white/10"
        >
          <div className="flex items-center gap-3">
            <LineChart className="w-5 h-5 text-dart-green" />
            <div>
              <div className="font-black tracking-tighter text-lg leading-none uppercase text-white mb-1">Statistics</div>
              <div className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Performance History</div>
            </div>
          </div>
          <div className="text-white/20">→</div>
        </div>
      </div>

      {showLogin && !user && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-md relative">
            <Button
              variant="ghost"
              className="absolute -top-12 right-0 text-white font-bold tracking-wider"
              onClick={() => setShowLogin(false)}
            >
              Schließen
            </Button>
            <Login />
          </div>
        </div>
      )}

      {/* Help Dialog Overlay */}
      {showHelp && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setShowHelp(false)}
          />
          <div className="bg-[#1a2620] border border-white/10 rounded-3xl w-full max-w-sm p-6 shadow-2xl relative animate-in zoom-in-95 duration-200">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-3 right-3 text-white/50"
              onClick={() => setShowHelp(false)}
            >
              <X className="w-5 h-5" />
            </Button>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-dart-orange rounded-xl flex items-center justify-center text-white">
                <HelpCircle className="w-6 h-6" />
              </div>
              <div className="text-left">
                <h2 className="text-xl font-black font-oswald uppercase tracking-tighter">Hilfe & FAQ</h2>
                <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold">Willkommen beim DartCounter</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex gap-4 items-start">
                <div className="w-8 h-8 shrink-0 rounded-lg bg-white/5 flex items-center justify-center text-dart-green">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <h3 className="font-bold text-sm mb-1 uppercase tracking-wider">PIN Schutz</h3>
                  <p className="text-[11px] text-white/60 leading-relaxed">
                    Macht die App privat und hilft, rechtliche Hürden (Impressum & DSGVO) zu umgehen.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <div className="w-8 h-8 shrink-0 rounded-lg bg-white/5 flex items-center justify-center text-dart-orange">
                  <User className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <h3 className="font-bold text-sm mb-1 uppercase tracking-wider">Login & Multi</h3>
                  <p className="text-[11px] text-white/60 leading-relaxed">
                    <strong>Lokal:</strong> Spiele offline (Freunde können sich am Gerät einloggen).<br />
                    <strong>Online:</strong> Freunde suchen & einladen für gemeinsames Spiel.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <div className="w-8 h-8 shrink-0 rounded-lg bg-white/5 flex items-center justify-center text-blue-400">
                  <Mic className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <h3 className="font-bold text-sm mb-1 uppercase tracking-wider">Sprachsteuerung</h3>
                  <p className="text-[11px] text-white/60 leading-relaxed">
                    Tippe einfach auf das Mikro im Numpad. Sage z.B. <strong>"Score 60"</strong> für die Summe der 3 Darts.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <div className="w-8 h-8 shrink-0 rounded-lg bg-white/5 flex items-center justify-center text-purple-400">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <h3 className="font-bold text-sm mb-1 uppercase tracking-wider">App Funktion</h3>
                  <p className="text-[11px] text-white/60 leading-relaxed">
                    <strong>iOS:</strong> Teilen → "Zum Home-Bildschirm".<br />
                    <strong>Android:</strong> Menü → "App installieren".
                  </p>
                </div>
              </div>
            </div>

            <Button
              className="w-full mt-8 bg-white/5 hover:bg-white/10 text-white font-bold h-12 rounded-xl border border-white/5"
              onClick={() => setShowHelp(false)}
            >
              Alles Klar!
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
