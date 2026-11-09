import { useEffect } from 'react';
import { useRoute } from '@/lib/router';
import { useAuth } from '@/stores/auth';
import { resumeOnlineMatch, useOnline } from '@/stores/online';
import { HomeScreen } from '@/screens/home';
import { SetupScreen } from '@/screens/setup';
import { GameScreen } from '@/screens/game/game-screen';
import { MatchDetailScreen, ProfileStatsScreen, StatsScreen } from '@/screens/stats';
import { OnlineScreen, InvitationCard } from '@/screens/online';
import { SettingsScreen } from '@/screens/settings';
import { pullSharedMatches, syncPendingShares } from '@/stores/sync';

function Screen({ route }: { route: string[] }) {
    switch (route[0]) {
        case 'new': return <SetupScreen />;
        case 'game': return <GameScreen />;
        case 'stats': return route[1] ? <ProfileStatsScreen id={route[1]} /> : <StatsScreen />;
        case 'match': return <MatchDetailScreen id={route[1]} />;
        case 'online': return <OnlineScreen />;
        case 'settings': return <SettingsScreen />;
        default: return <HomeScreen />;
    }
}

/** Incoming invitation shown on top of every screen except the online page. */
function InvitePopup({ route }: { route: string[] }) {
    const incoming = useOnline(s => s.incoming);
    if (incoming.length === 0 || route[0] === 'online' || route[0] === 'game') return null;
    return (
        <div className="pb-safe fixed inset-x-0 bottom-0 z-40 mx-auto max-w-lg px-3 animate-in slide-in-from-bottom-8">
            <div className="rounded-2xl bg-background shadow-2xl"><InvitationCard inv={incoming[0]} /></div>
        </div>
    );
}

export default function App() {
    const route = useRoute();
    const user = useAuth(s => s.user);

    useEffect(() => {
        useAuth.getState().init();
        void syncPendingShares();
        const onOnline = () => void syncPendingShares();
        window.addEventListener('online', onOnline);
        return () => window.removeEventListener('online', onOnline);
    }, []);

    useEffect(() => {
        if (!user) { useOnline.getState().stop(); return; }
        useOnline.getState().init();
        resumeOnlineMatch();
        void pullSharedMatches().then(() => syncPendingShares());
    }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <>
            <Screen route={route} />
            <InvitePopup route={route} />
        </>
    );
}
