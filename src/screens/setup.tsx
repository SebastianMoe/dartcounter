import { useMemo, useState } from 'react';
import { Check, Play, QrCode, Shuffle, UserPlus, X } from 'lucide-react';
import { SortableList } from '@/components/sortable-list';
import { PairGuestSheet } from '@/components/pairing';
import { Button } from '@/components/ui/button';
import { Field, Page, Section, Sheet } from '@/components/ui/kit';
import { SettingsForm } from '@/components/settings-form';
import { usePrefs } from '@/stores/prefs';
import { useProfiles } from '@/stores/profiles';
import { useMatch } from '@/stores/match';
import { navigate } from '@/lib/router';
import { cn, haptic, uid } from '@/lib/utils';
import type { MatchPlayer } from '@/game/types';

interface Slot { key: string; profileId?: string; guestName?: string }

export function SetupScreen() {
    const prefs = usePrefs();
    const { profiles, add } = useProfiles();
    const start = useMatch(s => s.start);
    const [settings, setSettings] = useState(prefs.settings);
    const [slots, setSlots] = useState<Slot[]>(() =>
        prefs.playerIds.filter(id => profiles.some(p => p.id === id)).map(id => ({ key: id, profileId: id })));
    const [picker, setPicker] = useState(false);
    const [newName, setNewName] = useState('');
    const [pairing, setPairing] = useState(false);

    const nameOf = (s: Slot) => s.guestName ?? profiles.find(p => p.id === s.profileId)?.name ?? '?';
    const selected = useMemo(() => new Set(slots.map(s => s.profileId).filter(Boolean)), [slots]);

    const toggle = (profileId: string) => {
        haptic();
        setSlots(prev => prev.some(s => s.profileId === profileId)
            ? prev.filter(s => s.profileId !== profileId)
            : [...prev, { key: profileId, profileId }]);
    };
    const shuffle = () => setSlots(prev => [...prev].sort(() => Math.random() - 0.5));
    const addNew = () => {
        if (!newName.trim()) return;
        const p = add(newName);
        setSlots(prev => [...prev, { key: p.id, profileId: p.id }]);
        setNewName('');
    };
    const addGuest = () => {
        const n = slots.filter(s => s.guestName).length + 1;
        setSlots(prev => [...prev, { key: uid(), guestName: `Gast ${n}` }]);
    };

    const startGame = () => {
        const players: MatchPlayer[] = slots.map(s => ({ id: s.key, name: nameOf(s), profileId: s.profileId }));
        prefs.setSettings(settings);
        prefs.setPlayerIds(slots.flatMap(s => (s.profileId ? [s.profileId] : [])));
        start(settings, players);
        navigate('/game', true);
    };

    return (
        <Page
            title="Neues Spiel"
            back
            footer={
                <Button size="xl" className="mb-1 w-full" disabled={slots.length === 0} onClick={startGame}>
                    <Play className="mr-2 h-5 w-5 fill-current" />
                    {slots.length === 0 ? 'Spieler wählen' : `Starten · ${slots.length} ${slots.length === 1 ? 'Spieler' : 'Spieler'}`}
                </Button>
            }
        >
            <Section
                title="Spieler"
                right={slots.length > 1 && (
                    <button onClick={shuffle} className="flex items-center gap-1 text-xs font-semibold text-primary">
                        <Shuffle className="h-4 w-4" /> Mischen
                    </button>
                )}
            >
                <div className="space-y-2">
                    <SortableList
                        items={slots}
                        getKey={x => x.key}
                        onChange={setSlots}
                        renderItem={(s, i) => {
                            const prof = profiles.find(p => p.id === s.profileId);
                            return (
                                <>
                                    <span className="w-5 text-sm font-bold text-muted-foreground">{i + 1}</span>
                                    <span className="min-w-0 flex-1 truncate font-semibold">
                                        {nameOf(s)}
                                        {prof?.username && <span className="ml-2 text-xs font-normal text-muted-foreground">@{prof.username}</span>}
                                    </span>
                                    <button className="flex h-12 w-12 items-center justify-center text-muted-foreground" onClick={() => setSlots(prev => prev.filter(x => x.key !== s.key))} aria-label="entfernen"><X className="h-5 w-5" /></button>
                                </>
                            );
                        }}
                    />
                    <Button variant="secondary" size="lg" className="w-full" onClick={() => setPicker(true)}>
                        <UserPlus className="mr-2 h-5 w-5" /> Spieler hinzufügen
                    </Button>
                </div>
            </Section>

            <Section title="Spielmodus">
                <SettingsForm value={settings} onChange={setSettings} />
            </Section>

            <Sheet open={picker} onClose={() => setPicker(false)} title="Spieler">
                <form className="mb-3 flex gap-2" onSubmit={e => { e.preventDefault(); addNew(); }}>
                    <Field placeholder="Neuer Spieler" value={newName} onChange={e => setNewName(e.target.value)} maxLength={20} />
                    <Button type="submit" size="lg" disabled={!newName.trim()}>Anlegen</Button>
                </form>
                <div className="mb-3 max-h-[45dvh] space-y-2 overflow-y-auto">
                    {profiles.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">Noch keine Spieler angelegt.</p>}
                    {[...profiles].sort((a, b) => a.name.localeCompare(b.name)).map(p => (
                        <button key={p.id} onClick={() => toggle(p.id)}
                            className={cn('flex h-14 w-full items-center gap-3 rounded-2xl border px-4 text-left', selected.has(p.id) ? 'border-primary bg-primary/10' : 'bg-card')}>
                            <span className={cn('flex h-6 w-6 items-center justify-center rounded-full border-2', selected.has(p.id) && 'border-primary bg-primary text-primary-foreground')}>
                                {selected.has(p.id) && <Check className="h-4 w-4" />}
                            </span>
                            <span className="flex-1 font-semibold">{p.name}</span>
                            {p.username && <span className="text-xs text-muted-foreground">@{p.username}</span>}
                        </button>
                    ))}
                </div>
                <Button variant="secondary" size="lg" className="mb-2 w-full" onClick={() => { setPicker(false); setPairing(true); }}>
                    <QrCode className="mr-2 h-5 w-5" /> Besuch mit Online-Konto
                </Button>
                <div className="grid grid-cols-2 gap-2 pb-2">
                    <Button variant="secondary" size="lg" onClick={addGuest}>+ Gast</Button>
                    <Button size="lg" onClick={() => setPicker(false)}>Fertig</Button>
                </div>
            </Sheet>

            <PairGuestSheet
                open={pairing}
                onClose={() => setPairing(false)}
                onPaired={profileId => {
                    setSlots(prev => (prev.some(x => x.profileId === profileId) ? prev : [...prev, { key: profileId, profileId }]));
                    setPairing(false);
                }}
            />
        </Page>
    );
}
