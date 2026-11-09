import { RotateCcw, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Page, Section } from '@/components/ui/kit';
import { settingsLabel } from '@/components/settings-form';
import { describeFormat } from '@/game/types';
import type { MatchRecord, MatchState } from '@/game/engine';
import { useMatch } from '@/stores/match';
import { navigate } from '@/lib/router';
import { MatchStats } from './stats-table';
import { LegList } from './leg-list';

export function MatchSummary({ state, record, onUndo, onClose }: {
    state: MatchState;
    record: MatchRecord;
    onUndo?: () => void;
    onClose: () => void;
}) {
    const winner = state.winner !== null ? state.players[state.winner] : null;
    const score = state.settings.sets ? state.progress.setsWon.join(' : ') : state.progress.totalLegsWon.join(' : ');

    const rematch = () => {
        // Rotate the player order so somebody else throws first
        const players = [...record.players.slice(1), record.players[0]];
        useMatch.getState().start(record.settings, players);
        navigate('/game', true);
    };

    return (
        <Page
            title="Match beendet"
            back={onClose}
            footer={
                <div className="mb-1 grid grid-cols-2 gap-2">
                    {record.onlineId ? (
                        <Button variant="secondary" size="xl" onClick={() => { onClose(); navigate('/online'); }}>Online</Button>
                    ) : (
                        <Button variant="secondary" size="xl" onClick={rematch}><RotateCcw className="mr-2 h-5 w-5" />Revanche</Button>
                    )}
                    <Button size="xl" onClick={onClose}>Fertig</Button>
                </div>
            }
        >
            <div className="mb-6 flex flex-col items-center rounded-3xl border bg-gradient-to-b from-primary/20 to-card p-6 text-center">
                <Trophy className="mb-2 h-12 w-12 text-primary" />
                <div className="text-3xl font-black">{winner?.name}</div>
                <div className="text-sm text-muted-foreground">gewinnt {settingsLabel(state.settings)} · {describeFormat(state.settings)}</div>
                {state.players.length > 1 && <div className="mt-2 text-4xl font-black tabular-nums">{score}</div>}
                {onUndo && (
                    <button className="mt-3 text-xs font-semibold text-muted-foreground underline" onClick={onUndo}>
                        Letzten Wurf zurücknehmen
                    </button>
                )}
            </div>
            <Section title="Statistik"><MatchStats state={state} /></Section>
            <Section title="Legs"><LegList state={state} /></Section>
        </Page>
    );
}
