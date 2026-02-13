import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/lib/auth-store";
import { User, Lock, Loader2, UserPlus, LogIn } from "lucide-react";

export function Login() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [isSignUp, setIsSignUp] = useState(false);
    const { signInWithUsername, signUpWithUsername, loading, user, profile } = useAuthStore();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (isSignUp) {
                await signUpWithUsername(username, password);
            } else {
                await signInWithUsername(username, password);
            }
        } catch (error: any) {
            console.error("Auth failed:", error);
            alert(error.message || "Authentifizierung fehlgeschlagen.");
        }
    };

    if (user && profile) {
        return null;
    }

    return (
        <div className="flex flex-col gap-6 p-8 bg-card rounded-2xl border-2 border-muted">
            <div className="space-y-2 text-center">
                <h2 className="text-2xl font-bold">{isSignUp ? 'Konto erstellen' : 'Online spielen'}</h2>
                <p className="text-sm text-muted-foreground">
                    {isSignUp
                        ? 'Wähle einen Namen und ein Passwort.'
                        : 'Melde dich an, um Freunde zu finden.'}
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                    <label className="text-sm font-medium">Nutzername</label>
                    <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            required
                            placeholder="Zocker123"
                            className="w-full h-11 pl-10 pr-4 rounded-xl border bg-background text-base outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium">Passwort</label>
                    <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="password"
                            required
                            placeholder="••••••••"
                            className="w-full h-11 pl-10 pr-4 rounded-xl border bg-background text-base outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>
                </div>

                <Button
                    type="submit"
                    className="w-full h-12 text-lg font-bold gap-2"
                    disabled={loading}
                >
                    {loading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                    ) : isSignUp ? (
                        <UserPlus className="w-5 h-5" />
                    ) : (
                        <LogIn className="w-5 h-5" />
                    )}
                    {isSignUp ? 'Registrieren' : 'Anmelden'}
                </Button>
            </form>

            <div className="text-center">
                <button
                    type="button"
                    onClick={() => setIsSignUp(!isSignUp)}
                    className="text-sm text-primary hover:underline"
                >
                    {isSignUp ? 'Du hast schon ein Konto? Anmelden' : 'Noch kein Konto? Hier registrieren'}
                </button>
            </div>
        </div>
    );
}
