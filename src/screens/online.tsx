import { useEffect, useMemo, useState } from 'react';
import { Check, Loader2, LogOut, QrCode, Search, Send, X } from 'lucide-react';
import { MyCodeSheet } from '@/components/pairing';
import { Button } from '@/components/ui/button';
import { Card, Empty, Field, Page, Section, Segmented, Sheet, Toast } from '@/components/ui/kit';
import { SettingsForm, settingsLabel } from '@/components/settings-form';
import { useAuth } from '@/stores/auth';
import { useOnline, type Invitation } from '@/stores/online';
import { usePrefs } from '@/stores/prefs';
import { useProfiles } from '@/stores/profiles';
import { displayName, isRecentlyOnline, pb, type UserRecord } from '@/lib/pocketbase';
import { navigate } from '@/lib/router';
import { describeFormat, type MatchSettings } from '@/game/types';
import { cn } from '@/lib/utils';

function AuthForm() {
    const { login, register, busy } = useAuth();
    const [mode, setMode] = useState<'login' | 'register'>('login');
    const [username, setUsername] = useState('');
    const [name, setName] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        const err = mode === 'login' ? await login(username, password) : await register(username, name, password);
        if (err) setError(err);
    };

    return (
        <Card>
            <Segmented value={mode} onChange={setMode} className="mb-4"
                options={[{ value: 'login', label: 'Anmelden' }, { value: 'register', label: 'Registrieren' }]} />
            <form className="space-y-3" onSubmit={submit}>
                <Field placeholder="Benutzername" autoCapitalize="none" autoCorrect="off" autoComplete="username"
                    value={username} onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} />
                {mode === 'register' && (
                    <Field placeholder="Anzeigename (optional)" value={name} onChange={e => setName(e.target.value)} maxLength={20} />
                )}
                <Field type="password" placeholder="Passwort (min. 8 Zeichen)" autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    value={password} onChange={e => setPassword(e.target.value)} />
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" size="xl" className="w-full" disabled={busy || username.length < 3 || password.length < 8}>
                    {busy && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                    {mode === 'login' ? 'Anmelden' : 'Konto erstellen'}
                </Button>
            </form>
            <p className="mt-3 text-xs text-muted-foreground">
                Für Online-Spiele brauchst du ein Konto auf deinem Darts-Server. Lokale Spiele funktionieren ohne Anmeldung.
            </p>
        </Card>
    );
}

function UserRow({ user, onInvite }: { user: UserRecord; onInvite: () => void }) {
    const online = isRecentlyOnline(user);
    return (
        <div className="flex h-16 items-center gap-3 rounded-2xl border bg-card px-4">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-muted font-bold uppercase">
                {displayName(user).slice(0, 1)}
                <span className={cn('absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-card', online ? 'bg-primary' : 'bg-muted-foreground/40')} />
            </div>
            <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{displayName(user)}</div>
                <div className="text-xs text-muted-foreground">@{user.username} · {online ? 'online' : 'offline'}</div>
            </div>
            <Button size="sm" onClick={onInvite}><Send className="mr-1 h-4 w-4" />Einladen</Button>
        </div>
    );
}

export function InvitationCard({ inv }: { inv: Invitation }) {
    const { accept, decline } = useOnline();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    return (
        <Card className="border-primary/50 bg-primary/10">
            <div className="mb-3">
                <div className="font-semibold">{displayName(inv.expand?.from)} lädt dich ein</div>
                <div className="text-sm text-muted-foreground">{settingsLabel(inv.settings)} · {describeFormat(inv.settings)}</div>
                {error && <div className="text-sm text-destructive">{error}</div>}
            </div>
            <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary" size="lg" onClick={() => decline(inv)}><X className="mr-1 h-5 w-5" />Ablehnen</Button>
                <Button size="lg" disabled={busy} onClick={async () => {
                    setBusy(true);
                    const err = await accept(inv);
                    setBusy(false);
                    if (err) setError(err); else navigate('/game');
                }}>
                    {busy ? <Loader2 className="mr-1 h-5 w-5 animate-spin" /> : <Check className="mr-1 h-5 w-5" />}Annehmen
                </Button>
            </div>
        </Card>
    );
}

export function OnlineScreen() {
    const user = useAuth(s => s.user);
    const logout = useAuth(s => s.logout);
    const { incoming, outgoing, invite, cancel, notice, clearNotice } = useOnline();
    const prefs = usePrefs();
    const profiles = useProfiles(s => s.profiles);
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<UserRecord[]>([]);
    const [recent, setRecent] = useState<UserRecord[]>([]);
    const [target, setTarget] = useState<UserRecord | null>(null);
    const [settings, setSettings] = useState<MatchSettings>(prefs.settings);
    const [msg, setMsg] = useState<string | null>(null);
    const [myCode, setMyCode] = useState(false);

    const knownIds = useMemo(() => profiles.map(p => p.userId).filter((id): id is string => !!id && id !== user?.id), [profiles, user]);

    // Players you've played against before (fresh online status)
    useEffect(() => {
        if (!user || knownIds.length === 0) return;
        pb.collection('users').getFullList<UserRecord>({ filter: knownIds.map(id => `id="${id}"`).join('||') })
            .then(setRecent).catch(() => { });
    }, [user, knownIds]);

    useEffect(() => {
        if (!user || query.trim().length < 2) return;
        const t = setTimeout(() => {
            pb.collection('users').getList<UserRecord>(1, 10, {
                filter: pb.filter('id != {:me} && (username ~ {:q} || name ~ {:q})', { me: user.id, q: query.trim() }),
                sort: '-lastSeen',
            }).then(r => setResults(r.items)).catch(() => setResults([]));
        }, 250);
        return () => clearTimeout(t);
    }, [query, user]);

    if (!user) return <Page title="Online" back><AuthForm /></Page>;

    const sendInvite = async () => {
        if (!target) return;
        prefs.setSettings(settings);
        const err = await invite(target, settings);
        setMsg(err ?? `Einladung an ${displayName(target)} gesendet.`);
        setTarget(null);
    };

    return (
        <Page
            title="Online"
            back
            actions={<button className="flex h-11 w-11 items-center justify-center text-muted-foreground" onClick={logout} aria-label="Abmelden"><LogOut className="h-5 w-5" /></button>}
        >
            <div className="mb-4 flex items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">Angemeldet als <b className="text-foreground">{displayName(user)}</b> (@{user.username})</p>
                <Button size="sm" variant="secondary" onClick={() => setMyCode(true)}><QrCode className="mr-1 h-4 w-4" />Mein Code</Button>
            </div>
            <MyCodeSheet open={myCode} onClose={() => setMyCode(false)} />

            {incoming.length > 0 && (
                <Section title="Einladungen">
                    <div className="space-y-2">{incoming.map(inv => <InvitationCard key={inv.id} inv={inv} />)}</div>
                </Section>
            )}

            {outgoing.length > 0 && (
                <Section title="Warte auf Antwort">
                    <div className="space-y-2">
                        {outgoing.map(inv => (
                            <div key={inv.id} className="flex h-14 items-center gap-3 rounded-2xl border bg-card px-4">
                                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                <span className="flex-1 truncate">{displayName(inv.expand?.to)} · {settingsLabel(inv.settings)}</span>
                                <Button size="sm" variant="ghost" onClick={() => cancel(inv)}>Zurückziehen</Button>
                            </div>
                        ))}
                    </div>
                </Section>
            )}

            <Section title="Spieler suchen">
                <div className="relative mb-2">
                    <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                    <Field className="pl-11" placeholder="Name oder Benutzername" value={query} onChange={e => setQuery(e.target.value)} autoCapitalize="none" />
                </div>
                <div className="space-y-2">
                    {(query.trim().length >= 2 ? results : []).map(u => <UserRow key={u.id} user={u} onInvite={() => setTarget(u)} />)}
                    {query.trim().length >= 2 && results.length === 0 && <p className="px-1 text-sm text-muted-foreground">Niemand gefunden.</p>}
                </div>
            </Section>

            <Section title="Bekannte Gegner">
                {recent.length === 0 ? <Empty>Gegner aus Online-Spielen erscheinen hier.</Empty> : (
                    <div className="space-y-2">
                        {[...recent].sort((a, b) => Number(isRecentlyOnline(b)) - Number(isRecentlyOnline(a)))
                            .map(u => <UserRow key={u.id} user={u} onInvite={() => setTarget(u)} />)}
                    </div>
                )}
            </Section>

            <Sheet open={!!target} onClose={() => setTarget(null)} title={`${displayName(target)} einladen`}>
                <SettingsForm value={settings} onChange={setSettings} />
                <Button size="xl" className="my-3 w-full" onClick={sendInvite}><Send className="mr-2 h-5 w-5" />Einladung senden</Button>
            </Sheet>
            <Toast message={msg ?? notice} onClose={() => { setMsg(null); clearNotice(); }} />
        </Page>
    );
}
