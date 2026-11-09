import { BarChart3, ChevronRight, Globe, Play, Plus, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, Section } from '@/components/ui/kit';
import { navigate } from '@/lib/router';
import { useMatch, useMatchState } from '@/stores/match';
import { useHistory } from '@/stores/history';
import { useOnline } from '@/stores/online';
import { useAuth } from '@/stores/auth';
import { settingsLabel } from '@/components/settings-form';
import { describeFormat } from '@/game/types';
import { formatDate } from '@/lib/utils';
import { MatchListItem } from './stats';
import { scoreText } from '@/game/engine';
import { legacyMatchCount } from '@/stores/legacy-history';

export function HomeScreen() {
    const active = useMatch(s => s.active);
    const state = useMatchState();
    const matches = useHistory(s => s.matches);
    const incoming = useOnline(s => s.incoming.length);
    const user = useAuth(s => s.user);
    const running = active && state && state.winner === null;

    return (
        <div className="flex h-[100dvh] flex-col">
            <div className="pt-safe mx-auto w-full max-w-2xl flex-1 overflow-y-auto px-4">
                <div className="flex items-center justify-between py-4">
                    <div>
                        <h1 className="text-3xl font-black tracking-tight">Darts</h1>
                        <p className="text-sm text-muted-foreground">{user ? `Angemeldet als ${user.name || user.username}` : 'Scoreboard'}</p>
                    </div>
                    <button className="flex h-11 w-11 items-center justify-center rounded-full bg-card" onClick={() => navigate('/settings')} aria-label="Einstellungen">
                        <Settings className="h-5 w-5" />
                    </button>
                </div>

                {running && (
                    <Card onClick={() => navigate('/game')} className="mb-4 border-primary/50 bg-primary/10">
                        <div className="flex items-center gap-3">
                            <div className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-primary text-primary-foreground">
                                <Play className="h-6 w-6 fill-current" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="font-semibold">Spiel fortsetzen</div>
                                <div className="truncate text-sm text-muted-foreground">
                                    {settingsLabel(active.settings)} · {active.players.map((p, i) =>
                                        `${p.name} ${scoreText(state, i)}`).join(' – ')}
                                </div>
                            </div>
                            <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        </div>
                    </Card>
                )}

                <Button size="xl" className="mb-3 h-16 w-full text-xl" onClick={() => navigate('/new')}>
                    <Plus className="mr-2 h-6 w-6" /> Neues Spiel
                </Button>

                <div className="mb-6 grid grid-cols-2 gap-3">
                    <Card onClick={() => navigate('/online')} className="relative">
                        <Globe className="mb-2 h-6 w-6 text-primary" />
                        <div className="font-semibold">Online</div>
                        <div className="text-xs text-muted-foreground">Gegen Freunde</div>
                        {incoming > 0 && (
                            <span className="absolute right-3 top-3 flex h-6 min-w-6 items-center justify-center rounded-full bg-destructive px-1.5 text-xs font-bold">{incoming}</span>
                        )}
                    </Card>
                    <Card onClick={() => navigate('/stats')}>
                        <BarChart3 className="mb-2 h-6 w-6 text-primary" />
                        <div className="font-semibold">Statistik</div>
                        <div className="text-xs text-muted-foreground">{matches.length + legacyMatchCount()} Spiele</div>
                    </Card>
                </div>

                <Section title="Letzte Spiele">
                    {matches.length === 0 ? (
                        <p className="px-1 text-sm text-muted-foreground">Noch keine Spiele gespeichert.</p>
                    ) : (
                        <div className="space-y-2">
                            {matches.slice(0, 5).map(m => <MatchListItem key={m.id} match={m} />)}
                        </div>
                    )}
                </Section>
                {active && !running && (
                    <p className="pb-6 text-center text-xs text-muted-foreground">
                        Letztes Spiel: {describeFormat(active.settings)} · {formatDate(active.createdAt)}
                    </p>
                )}
            </div>
        </div>
    );
}
