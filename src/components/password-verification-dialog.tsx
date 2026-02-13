import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { X, Lock, Loader2 } from "lucide-react";
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

interface PasswordVerificationDialogProps {
    isOpen: boolean;
    username: string;
    onVerify: () => void;
    onCancel: () => void;
}

export function PasswordVerificationDialog({
    isOpen,
    username,
    onVerify,
    onCancel
}: PasswordVerificationDialogProps) {
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleVerify = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            // Create a temporary client to verify without affecting global auth state
            // Create a temporary client with dummy storage to enforce no side-effects on localStorage
            const dummyStorage = {
                getItem: () => null,
                setItem: () => { },
                removeItem: () => { },
            };

            const tempClient = createClient(supabaseUrl, supabaseAnonKey, {
                auth: {
                    storage: dummyStorage,
                    persistSession: false,
                    autoRefreshToken: false,
                    detectSessionInUrl: false
                }
            });

            // Reconstruct pseudo-email logic
            const sanitized = username.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
            const email = `${sanitized}@darts-pwa.com`;

            const { error: signInError } = await tempClient.auth.signInWithPassword({
                email,
                password
            });

            if (signInError) throw signInError;

            // If successful, proceed
            onVerify();
        } catch (err: any) {
            console.error("Verification failed:", err);
            setError("Passwort falsch oder Benutzer nicht gefunden.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in">
            <div className="bg-card w-full max-w-md p-6 rounded-xl border shadow-xl animate-in zoom-in-95">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold">Identität bestätigen</h2>
                    <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <p className="text-muted-foreground mb-4">
                    Bitte gib das Passwort für <strong>{username}</strong> ein, um diesen Account hinzuzufügen.
                </p>

                <form onSubmit={handleVerify} className="space-y-4">
                    <div className="space-y-2">
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input
                                type="password"
                                autoFocus
                                required
                                placeholder="Passwort..."
                                className="w-full h-11 pl-10 pr-4 rounded-xl border bg-background outline-none focus:ring-2 focus:ring-primary/50"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                        {error && <p className="text-sm text-destructive">{error}</p>}
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <Button type="button" variant="outline" onClick={onCancel}>Abbrechen</Button>
                        <Button type="submit" disabled={loading}>
                            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Bestätigen
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
