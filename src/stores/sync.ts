import { pb, pbError } from '@/lib/pocketbase';
import type { MatchRecord } from '@/game/engine';
import { useHistory } from './history';
import { hasValidLink, useProfiles } from './profiles';

// Sharing finished local games with the online accounts of the players
// (paired visitors and the logged-in owner), and pulling games that other
// devices shared with me into my local statistics.

export interface PairResult { userId: string; username: string; name: string; token: string; expires: number }

export async function requestPairCode(): Promise<{ code: string; username: string; ttlMinutes: number }> {
    return pb.send('/api/darts/pair-code', { method: 'POST' });
}

/** Redeems a visitor's code and creates/links their local profile. Returns the profile id. */
export async function pairVisitor(username: string, code: string): Promise<{ profileId?: string; error?: string }> {
    try {
        const r = await pb.send<PairResult>('/api/darts/pair', {
            method: 'POST',
            body: { username: username.trim().toLowerCase(), code: code.replace(/\D/g, '') },
        });
        const p = useProfiles.getState().ensureForUser(r.userId, r.name, {
            username: r.username, linkToken: r.token, linkExpires: r.expires,
        });
        return { profileId: p.id };
    } catch (e) {
        return { error: pbError(e) };
    }
}

/** Which players of this match can be shared, and with which credentials. */
function shareLinks(m: MatchRecord) {
    const me = pb.authStore.isValid ? pb.authStore.record?.id : undefined;
    const profiles = useProfiles.getState().profiles;
    const players = m.players.map(p => {
        const prof = profiles.find(x => x.id === p.profileId);
        return { ...p, userId: prof?.userId ?? p.userId };
    });
    const links = players.flatMap(p => {
        const prof = profiles.find(x => x.id === p.profileId);
        return prof && prof.userId && hasValidLink(prof) && prof.userId !== me ? [{ userId: prof.userId, token: prof.linkToken! }] : [];
    });
    const shareable = players.some(p => p.userId && (p.userId === me || links.some(l => l.userId === p.userId)));
    return { players, links, shareable };
}

export async function shareMatch(m: MatchRecord): Promise<void> {
    if (m.onlineId || !m.finishedAt) return; // online matches already live on the server
    const history = useHistory.getState();
    if (history.shared[m.id]) return;
    const { players, links, shareable } = shareLinks(m);
    if (!shareable) return;
    try {
        await pb.send('/api/darts/share-match', { method: 'POST', body: { match: { ...m, players }, links } });
        history.markShared(m.id);
    } catch (e) {
        const status = (e as { status?: number }).status;
        if (status === 400 || status === 403) history.markShared(m.id); // not shareable – don't retry forever
    }
}

/** Retry uploads that failed (e.g. no network at the end of the game). */
export async function syncPendingShares() {
    const { matches, shared } = useHistory.getState();
    for (const m of matches.slice(0, 50)) {
        if (!shared[m.id] && m.finishedAt && !m.onlineId) await shareMatch(m);
    }
}

interface SharedRecord { id: string; matchId: string; match: MatchRecord }

/** Import games other devices recorded for me into my local history (once). */
export async function pullSharedMatches(): Promise<number> {
    if (!pb.authStore.isValid) return 0;
    const me = pb.authStore.record?.id;
    let list: SharedRecord[];
    try {
        list = await pb.collection('shared_matches').getFullList<SharedRecord>({ sort: '-created', batch: 200 });
    } catch {
        return 0;
    }
    const history = useHistory.getState();
    const known = new Set(history.matches.map(m => m.id));
    let added = 0;
    for (const rec of list) {
        if (known.has(rec.matchId)) continue;
        const m = rec.match;
        const players = m.players.map(p => {
            if (!p.userId) return { ...p, profileId: undefined };
            const prof = useProfiles.getState().ensureForUser(p.userId, p.name, { adoptByName: p.userId === me });
            return { ...p, profileId: prof.id };
        });
        history.save({ ...m, players });
        history.markShared(m.id);
        added++;
    }
    return added;
}
