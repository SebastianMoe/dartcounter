import { useCallback, useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { Camera, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, Sheet } from '@/components/ui/kit';
import { pairVisitor, requestPairCode } from '@/stores/sync';
import { pbError } from '@/lib/pocketbase';
import { haptic } from '@/lib/utils';

// QR payload: darts-pair:<username>:<code>
const QR_PREFIX = 'darts-pair:';
export function parsePairQr(text: string): { username: string; code: string } | null {
    if (!text.startsWith(QR_PREFIX)) return null;
    const [username, code] = text.slice(QR_PREFIX.length).split(':');
    return username && /^\d{6}$/.test(code) ? { username, code } : null;
}

/** Shown on the visitor's own phone: 6-digit code + QR, valid for 10 minutes. */
export function MyCodeSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
    const [data, setData] = useState<{ code: string; username: string; until: number } | null>(null);
    const [qr, setQr] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [now, setNow] = useState(() => Date.now());

    const load = useCallback(async () => {
        setError(null);
        setData(null);
        try {
            const r = await requestPairCode();
            const until = Date.now() + r.ttlMinutes * 60_000;
            setData({ code: r.code, username: r.username, until });
            setQr(await QRCode.toDataURL(`${QR_PREFIX}${r.username}:${r.code}`, { margin: 1, width: 480, color: { dark: '#000000', light: '#ffffff' } }));
        } catch (e) {
            setError(pbError(e));
        }
    }, []);

    useEffect(() => {
        if (!open) return;
        void load(); // eslint-disable-line react-hooks/set-state-in-effect
        const t = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(t);
    }, [open, load]);

    const left = data ? Math.max(0, Math.round((data.until - now) / 1000)) : 0;
    const expired = !!data && left === 0;

    return (
        <Sheet open={open} onClose={onClose} title="Mein Code">
            <p className="mb-4 text-sm text-muted-foreground">
                Auf dem Handy deines Freundes: <b>Neues Spiel → Spieler hinzufügen → Besuch mit Online-Konto</b>.
                Dort diesen QR-Code scannen oder Benutzername und Code eintippen. Deine Spiele dort landen dann in deiner Statistik.
            </p>
            {error && <p className="mb-3 text-sm text-destructive">{error}</p>}
            {!data && !error && <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}
            {data && (
                <div className="flex flex-col items-center gap-3 pb-2">
                    {qr && <img src={qr} alt="QR-Code" className={`w-56 rounded-2xl bg-white p-2 ${expired ? 'opacity-20' : ''}`} />}
                    <div className="text-center">
                        <div className="text-sm text-muted-foreground">@{data.username}</div>
                        <div className={`font-mono text-5xl font-black tracking-[0.2em] ${expired ? 'text-muted-foreground line-through' : ''}`}>
                            {data.code.slice(0, 3)} {data.code.slice(3)}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                            {expired ? 'Abgelaufen' : `Gültig noch ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`}
                        </div>
                    </div>
                    <Button variant="secondary" size="lg" onClick={load}><RefreshCw className="mr-2 h-4 w-4" />Neuer Code</Button>
                </div>
            )}
        </Sheet>
    );
}

/** On the host device: link a visitor's online account via username + code or QR scan. */
export function PairGuestSheet({ open, onClose, onPaired }: { open: boolean; onClose: () => void; onPaired: (profileId: string) => void }) {
    const [username, setUsername] = useState('');
    const [code, setCode] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [scanning, setScanning] = useState(false);

    const submit = async (u = username, c = code) => {
        setBusy(true);
        setError(null);
        const r = await pairVisitor(u, c);
        setBusy(false);
        if (r.error) { setError(r.error); haptic(80); return; }
        haptic(30);
        setUsername('');
        setCode('');
        onPaired(r.profileId!);
    };

    return (
        <Sheet open={open} onClose={() => { setScanning(false); onClose(); }} title="Besuch mit Online-Konto">
            {scanning ? (
                <QrScanner
                    onResult={(text) => {
                        const p = parsePairQr(text);
                        if (!p) { setError('Das ist kein Darts-Code.'); return; }
                        setScanning(false);
                        setUsername(p.username);
                        setCode(p.code);
                        void submit(p.username, p.code);
                    }}
                    onCancel={() => setScanning(false)}
                />
            ) : (
                <form className="space-y-3 pb-2" onSubmit={e => { e.preventDefault(); void submit(); }}>
                    <p className="text-sm text-muted-foreground">
                        Dein Besuch öffnet bei sich <b>Einstellungen → Mein Code</b>. Seine Spiele bei dir zählen dann für sein Konto – du bleibst angemeldet.
                    </p>
                    <Button type="button" size="xl" className="w-full" onClick={() => { setError(null); setScanning(true); }}>
                        <Camera className="mr-2 h-5 w-5" /> QR-Code scannen
                    </Button>
                    <div className="text-center text-xs text-muted-foreground">oder eintippen</div>
                    <Field placeholder="Benutzername" autoCapitalize="none" autoCorrect="off" value={username}
                        onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} />
                    <Field placeholder="6-stelliger Code" inputMode="numeric" autoComplete="one-time-code" value={code}
                        className="font-mono text-xl tracking-[0.3em]"
                        onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} />
                    {error && <p className="text-sm text-destructive">{error}</p>}
                    <Button type="submit" size="xl" variant="secondary" className="w-full" disabled={busy || username.length < 3 || code.length !== 6}>
                        {busy && <Loader2 className="mr-2 h-5 w-5 animate-spin" />} Verbinden
                    </Button>
                </form>
            )}
        </Sheet>
    );
}

function QrScanner({ onResult, onCancel }: { onResult: (text: string) => void; onCancel: () => void }) {
    const video = useRef<HTMLVideoElement>(null);
    const [error, setError] = useState<string | null>(null);
    const done = useRef(false);
    const resultRef = useRef(onResult);
    useEffect(() => { resultRef.current = onResult; }, [onResult]);

    useEffect(() => {
        let stream: MediaStream | null = null;
        let timer: number | undefined;
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        const tick = () => {
            const v = video.current;
            if (done.current || !v || !ctx) return;
            if (v.readyState >= 2 && v.videoWidth) {
                const w = Math.min(640, v.videoWidth);
                const h = Math.round(v.videoHeight * (w / v.videoWidth));
                canvas.width = w;
                canvas.height = h;
                ctx.drawImage(v, 0, 0, w, h);
                const hit = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' });
                if (hit?.data) {
                    done.current = true;
                    haptic(30);
                    resultRef.current(hit.data);
                    return;
                }
            }
            timer = window.setTimeout(tick, 200);
        };

        (async () => {
            try {
                if (!navigator.mediaDevices?.getUserMedia) throw new Error('unsupported');
                stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
                if (video.current) {
                    video.current.srcObject = stream;
                    await video.current.play();
                }
                tick();
            } catch {
                setError(window.isSecureContext ? 'Kamera nicht verfügbar oder nicht erlaubt.' : 'Die Kamera braucht HTTPS.');
            }
        })();

        return () => {
            done.current = true;
            window.clearTimeout(timer);
            stream?.getTracks().forEach(t => t.stop());
        };
    }, []);

    return (
        <div className="space-y-3 pb-2">
            <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-black">
                <video ref={video} playsInline muted className="h-full w-full object-cover" />
                <div className="pointer-events-none absolute inset-[15%] rounded-3xl border-4 border-white/70" />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button variant="secondary" size="xl" className="w-full" onClick={onCancel}>Abbrechen – Code eintippen</Button>
        </div>
    );
}
