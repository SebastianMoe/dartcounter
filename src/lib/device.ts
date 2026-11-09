// Screen wake lock + spoken score caller.

let lock: WakeLockSentinel | null = null;
let wanted = false;

async function acquire() {
    if (!wanted || lock || !('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
    try {
        lock = await navigator.wakeLock.request('screen');
        lock.addEventListener('release', () => { lock = null; });
    } catch { /* not allowed (e.g. no HTTPS) */ }
}

document.addEventListener('visibilitychange', acquire);

export function keepScreenOn(on: boolean) {
    wanted = on;
    if (on) acquire();
    else { lock?.release(); lock = null; }
}

// Listeners get notified while the app is talking, so voice input can pause
// and doesn't hear its own announcements.
const speakingListeners = new Set<(speaking: boolean) => void>();
export function onSpeaking(cb: (speaking: boolean) => void) {
    speakingListeners.add(cb);
    return () => { speakingListeners.delete(cb); };
}
const notify = (v: boolean) => speakingListeners.forEach(cb => cb(v));

export function speak(text: string) {
    try {
        if (!('speechSynthesis' in window)) return;
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'de-DE';
        u.rate = 1.05;
        notify(true);
        let done = false;
        const end = () => { if (!done) { done = true; setTimeout(() => notify(false), 250); } };
        u.onend = end;
        u.onerror = end;
        setTimeout(end, 4000); // safety net: some browsers never fire onend
        window.speechSynthesis.speak(u);
    } catch { /* ignore */ }
}
