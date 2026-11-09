import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** crypto.randomUUID is only available in secure contexts (HTTPS / localhost). */
export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto && window.isSecureContext) return crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

export function haptic(ms = 12) {
  try {
    if (localStorage.getItem('darts-haptics') === 'off') return;
    navigator.vibrate?.(ms);
  } catch { /* not supported */ }
}

export const fmt1 = (n: number) => (Number.isFinite(n) ? n.toFixed(1) : '–');
export const pct = (n: number | null) => (n === null ? '–' : `${(n * 100).toFixed(1)} %`);

/** PocketBase returns "2026-11-09 10:47:36.156Z" which Safari can't parse. */
export const parsePbDate = (s?: string) => (s ? new Date(s.replace(' ', 'T')) : null);

export function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}
