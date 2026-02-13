import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { X, User, Trash2, Loader2, Save } from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { supabase } from "@/lib/supabase";
import { ConfirmDialog } from "./confirm-dialog";

interface UserSettingsDialogProps {
    isOpen: boolean;
    onClose: () => void;
}

export function UserSettingsDialog({
    isOpen,
    onClose
}: UserSettingsDialogProps) {
    const { profile, signOut, initialize } = useAuthStore();
    const [name, setName] = useState(profile?.name || "");
    const [loading, setLoading] = useState(false);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

    if (!isOpen || !profile) return null;

    const handleSave = async () => {
        if (!name.trim() || name === profile.name) return;
        setLoading(true);
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ name: name.trim() })
                .eq('id', profile.id);

            if (error) throw error;
            await initialize(); // Refresh profile
            onClose();
        } catch (error) {
            console.error("Update failed", error);
            alert("Fehler beim Speichern.");
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteAccount = async () => {
        // Since we can't easily delete auth users from client without an Edge Function,
        // we will delete the PROFILE row and sign out. This effectively "deletes" the user from the app's perspective.
        // For a real app, you'd trigger a cloud function to cleanup auth.users.
        setLoading(true);
        try {
            const { error } = await supabase
                .from('profiles')
                .delete()
                .eq('id', profile.id);

            if (error) throw error;

            await signOut();
            onClose();
        } catch (error) {
            console.error("Delete failed", error);
            alert("Fehler beim Löschen des Accounts.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in">
            <div className="bg-card w-full max-w-md p-6 rounded-xl border shadow-xl animate-in zoom-in-95">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold">Einstellungen</h2>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="space-y-6">
                    {/* Name Change */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Anzeigename</label>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <input
                                    className="w-full h-10 pl-10 pr-4 rounded-md border bg-background outline-none focus:ring-2 focus:ring-primary/50"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                />
                            </div>
                            <Button onClick={handleSave} disabled={loading || name === profile.name}>
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            </Button>
                        </div>
                    </div>

                    <div className="border-t" />

                    {/* Danger Zone */}
                    <div className="space-y-2">
                        <h3 className="text-sm font-bold text-destructive uppercase tracking-wider">Gefahrenzone</h3>
                        <p className="text-xs text-muted-foreground">Wenn du deinen Account löschst, werden alle deine Statistiken unwiderruflich entfernt.</p>
                        <Button
                            variant="destructive"
                            className="w-full justify-start gap-2"
                            onClick={() => setDeleteConfirmOpen(true)}
                        >
                            <Trash2 className="w-4 h-4" /> Account löschen
                        </Button>
                    </div>
                </div>
            </div>

            <ConfirmDialog
                isOpen={deleteConfirmOpen}
                title="Account wirklich löschen?"
                description={`Bitte bestätige, dass du den Account "${profile.name}" endgültig löschen möchtest. Dies kann nicht rückgängig gemacht werden.`}
                onConfirm={handleDeleteAccount}
                onCancel={() => setDeleteConfirmOpen(false)}
                variant="destructive"
                confirmText="Ja, Account löschen"
            />
        </div>
    );
}
