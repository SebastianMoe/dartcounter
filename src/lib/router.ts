import { useSyncExternalStore } from 'react';

// Minimal hash router: keeps the Android back button working and needs no server config.

const subscribe = (cb: () => void) => {
    window.addEventListener('hashchange', cb);
    return () => window.removeEventListener('hashchange', cb);
};

export function useRoute(): string[] {
    const hash = useSyncExternalStore(subscribe, () => window.location.hash);
    return hash.replace(/^#\/?/, '').split('/').filter(Boolean);
}

export function navigate(path: string, replace = false) {
    const target = '#' + (path.startsWith('/') ? path : '/' + path);
    if (replace) window.location.replace(target);
    else window.location.hash = target;
}

export function goBack(fallback = '/') {
    if (window.history.length > 1) window.history.back();
    else navigate(fallback, true);
}
