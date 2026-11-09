import { useState } from 'react';
import { Combine, Pencil, QrCode, Trash2 } from 'lucide-react';
import { MyCodeSheet } from '@/components/pairing';
import { Button } from '@/components/ui/button';
import { Field, Page, Row, Section, Sheet, Toggle } from '@/components/ui/kit';
import { usePrefs } from '@/stores/prefs';
import { useProfiles, type Profile } from '@/stores/profiles';
import { useAuth } from '@/stores/auth';
import { navigate } from '@/lib/router';

export function SettingsScreen() {
    const prefs = usePrefs();
    const { profiles, rename, remove, merge } = useProfiles();
    const user = useAuth(s => s.user);
    const [edit, setEdit] = useState<Profile | null>(null);
    const [name, setName] = useState('');
    const [del, setDel] = useState<Profile | null>(null);
    const [mergeFrom, setMergeFrom] = useState<Profile | null>(null);
    const [myCode, setMyCode] = useState(false);

    return (
        <Page title="Einstellungen" back>
            <Section title="Spiel">
                <div className="rounded-2xl border bg-card px-3">
                    <Row label="Vibration" hint="Kurzes Feedback bei jedem Tipp"><Toggle checked={prefs.haptics} onChange={haptics => prefs.set({ haptics })} /></Row>
                    <Row label="Ansage" hint="Punkte werden vorgelesen"><Toggle checked={prefs.caller} onChange={caller => prefs.set({ caller })} /></Row>
                    <Row label="Bildschirm anlassen" hint="Während eines Spiels"><Toggle checked={prefs.keepAwake} onChange={keepAwake => prefs.set({ keepAwake })} /></Row>
                </div>
            </Section>

            <Section title="Online-Konto">
                <div className="rounded-2xl border bg-card px-3">
                    <Row label={user ? (user.name || user.username) : 'Nicht angemeldet'} hint={user ? `@${user.username}` : 'Für Spiele gegen Freunde'}>
                        <Button variant="secondary" size="sm" onClick={() => navigate('/online')}>{user ? 'Öffnen' : 'Anmelden'}</Button>
                    </Row>
                    {user && (
                        <Row label="Bei Freunden mitspielen" hint="Code zeigen, damit dein Konto auf ihrem Handy mitspielt">
                            <Button variant="secondary" size="sm" onClick={() => setMyCode(true)}><QrCode className="mr-1 h-4 w-4" />Mein Code</Button>
                        </Row>
                    )}
                </div>
            </Section>

            <Section title="Spieler">
                <div className="rounded-2xl border bg-card px-3">
                    {profiles.length === 0 && <p className="py-4 text-sm text-muted-foreground">Spieler legst du beim Starten eines Spiels an.</p>}
                    {profiles.map(p => (
                        <Row key={p.id} label={p.name} hint={p.userId ? `Online-Konto @${p.username ?? '…'}${p.userId === user?.id ? ' (du)' : ''}` : undefined}>
                            <div className="flex">
                                {profiles.length > 1 && (
                                    <button className="flex h-10 w-10 items-center justify-center text-muted-foreground" onClick={() => setMergeFrom(p)} aria-label="Zusammenführen"><Combine className="h-4 w-4" /></button>
                                )}
                                <button className="flex h-10 w-10 items-center justify-center text-muted-foreground" onClick={() => { setEdit(p); setName(p.name); }} aria-label="Umbenennen"><Pencil className="h-4 w-4" /></button>
                                <button className="flex h-10 w-10 items-center justify-center text-muted-foreground" onClick={() => setDel(p)} aria-label="Löschen"><Trash2 className="h-4 w-4" /></button>
                            </div>
                        </Row>
                    ))}
                </div>
            </Section>

            <p className="pb-4 text-center text-xs text-muted-foreground">Darts Scoreboard · Daten liegen auf diesem Gerät und deinem eigenen Server.</p>

            <Sheet open={!!edit} onClose={() => setEdit(null)} title="Spieler umbenennen">
                <form className="pb-2" onSubmit={e => { e.preventDefault(); if (edit && name.trim()) rename(edit.id, name); setEdit(null); }}>
                    <Field value={name} onChange={e => setName(e.target.value)} maxLength={20} autoFocus />
                    <Button type="submit" size="xl" className="mt-3 w-full">Speichern</Button>
                </form>
            </Sheet>
            <Sheet open={!!mergeFrom} onClose={() => setMergeFrom(null)} title={`„${mergeFrom?.name}“ zusammenführen mit …`}>
                <p className="mb-3 text-sm text-muted-foreground">
                    Alle Spiele von „{mergeFrom?.name}“ werden dem gewählten Spieler zugeordnet, danach wird „{mergeFrom?.name}“ gelöscht.
                    Ein Online-Konto bleibt erhalten.
                </p>
                <div className="mb-2 max-h-[50dvh] space-y-2 overflow-y-auto pb-2">
                    {profiles.filter(p => p.id !== mergeFrom?.id).map(p => (
                        <button key={p.id} className="flex h-14 w-full items-center justify-between rounded-2xl border bg-card px-4 text-left active:bg-accent"
                            onClick={() => { if (mergeFrom) merge(mergeFrom.id, p.id); setMergeFrom(null); }}>
                            <span className="font-semibold">{p.name}</span>
                            {p.username && <span className="text-xs text-muted-foreground">@{p.username}</span>}
                        </button>
                    ))}
                </div>
            </Sheet>
            <MyCodeSheet open={myCode} onClose={() => setMyCode(false)} />

            <Sheet open={!!del} onClose={() => setDel(null)} title={`${del?.name} löschen?`}>
                <p className="mb-4 text-sm text-muted-foreground">Gespielte Spiele bleiben erhalten, erscheinen aber nicht mehr in der Spielerstatistik.</p>
                <div className="grid grid-cols-2 gap-2 pb-2">
                    <Button variant="secondary" size="xl" onClick={() => setDel(null)}>Abbrechen</Button>
                    <Button variant="destructive" size="xl" onClick={() => { if (del) remove(del.id); setDel(null); }}>Löschen</Button>
                </div>
            </Sheet>
        </Page>
    );
}
