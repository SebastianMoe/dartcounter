import { useMultiplayerStore } from "@/lib/multiplayer-store";
import { useAuthStore } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import { Check, X, Bell } from "lucide-react";

export function InvitationOverlay() {
    const { invitations, acceptInvitation, declineInvitation } = useMultiplayerStore();
    const { user } = useAuthStore();

    if (!user || invitations.length === 0) return null;

    const currentInv = invitations[0];

    return (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4 animate-in slide-in-from-top-4 duration-300">
            <div className="bg-card border-2 border-primary/50 shadow-2xl rounded-2xl p-4 flex items-center gap-4">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary shrink-0">
                    <Bell className="w-6 h-6 animate-bounce" />
                </div>

                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">Herausforderung!</p>
                    <p className="text-xs text-muted-foreground">Ein Spieler möchte <strong>{currentInv.game_type}</strong> spielen.</p>
                </div>

                <div className="flex gap-2">
                    <Button
                        size="icon"
                        variant="ghost"
                        className="h-10 w-10 text-destructive hover:bg-destructive/10"
                        onClick={() => declineInvitation(currentInv.id)}
                    >
                        <X className="w-5 h-5" />
                    </Button>
                    <Button
                        size="icon"
                        className="h-10 w-10 bg-green-600 hover:bg-green-700"
                        onClick={() => acceptInvitation(currentInv.id)}
                    >
                        <Check className="w-5 h-5" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
