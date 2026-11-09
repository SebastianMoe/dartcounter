import PocketBase, { type RecordModel } from 'pocketbase';
import { parsePbDate } from './utils';

// The frontend is served by PocketBase itself, so the API lives on the same origin.
// In development Vite proxies /api to a local PocketBase (see vite.config.ts).
const url = import.meta.env.VITE_PB_URL || window.location.origin;

export const pb = new PocketBase(url);
pb.autoCancellation(false);

export interface UserRecord extends RecordModel {
    username: string;
    name: string;
    lastSeen?: string;
}

export const displayName = (u?: Partial<UserRecord> | null) => (u ? u.name || u.username || '?' : '?');

export function isRecentlyOnline(u?: Partial<UserRecord> | null): boolean {
    const d = parsePbDate(u?.lastSeen);
    return !!d && Date.now() - d.getTime() < 3 * 60 * 1000;
}

/** Translates PocketBase errors into short German messages. */
export function pbError(err: unknown): string {
    const e = err as { status?: number; response?: { data?: Record<string, { message?: string; code?: string }>; message?: string } };
    if (e?.status === 0) return 'Server nicht erreichbar.';
    const data = e?.response?.data;
    if (data && Object.keys(data).length) {
        const [field, info] = Object.entries(data)[0];
        if (field === 'username' && info.code === 'validation_not_unique') return 'Benutzername ist schon vergeben.';
        if (field === 'username') return 'Benutzername: 3–24 Zeichen, nur a–z, 0–9 und _.';
        if (field === 'password') return 'Passwort muss mindestens 8 Zeichen haben.';
        if (field === 'passwordConfirm') return 'Passwörter stimmen nicht überein.';
        return `${field}: ${info.message ?? 'ungültig'}`;
    }
    if (e?.status === 400 && /authenticate/i.test(e?.response?.message ?? '')) return 'Benutzername oder Passwort falsch.';
    return e?.response?.message || 'Unbekannter Fehler.';
}
