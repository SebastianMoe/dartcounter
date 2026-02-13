import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { usePlayerStore } from "@/lib/player-store";
import { useAuthStore } from "@/lib/auth-store";
import { useMultiplayerStore } from "@/lib/multiplayer-store";
import { supabase } from "@/lib/supabase";
import { Plus, User, UserPlus, Trash2, Check, Search, Zap, Settings, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Login } from "./login";
import type { PlayerProfile } from "@/lib/types";
import { ConfirmDialog } from "./confirm-dialog";
import { PasswordVerificationDialog } from "./password-verification-dialog";
import { UserSettingsDialog } from "./user-settings-dialog"; // Will implement next

interface PlayerSelectionProps {
    onStart: () => void;
    onBack?: () => void;
}

export function PlayerSelection({ onStart, onBack }: PlayerSelectionProps) {
    const { profiles, activePlayerIds, addProfile, deleteProfile, togglePlayerSelection, resetGuests } = usePlayerStore();
    const { profile: myProfile, signOut } = useAuthStore();

    const [newProfileName, setNewProfileName] = useState("");
    const [isAdding, setIsAdding] = useState(false);

    // Online Search State
    const [searchQuery, setSearchQuery] = useState("");
    const [onlineResults, setOnlineResults] = useState<PlayerProfile[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    // Dialog States
    const [profileToDelete, setProfileToDelete] = useState<string | null>(null);
    const [profileToVerify, setProfileToVerify] = useState<PlayerProfile | null>(null);
    const [showSettings, setShowSettings] = useState(false);

    const handleAddProfile = () => {
        if (newProfileName.trim()) {
            addProfile(newProfileName.trim(), 'local');
            setNewProfileName("");
            setIsAdding(false);
        }
    };

    const handleAddGuest = () => {
        const guestCount = profiles.filter(p => p.type === 'guest').length;
        addProfile(`Guest ${guestCount + 1}`, 'guest');
    };

    // Online Search Logic
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (searchQuery.length < 2) {
                setOnlineResults([]);
                return;
            }
            setIsSearching(true);
            const { data } = await supabase
                .from('profiles')
                .select('*')
                .ilike('name', `%${searchQuery}%`)
                // .neq('id', myProfile?.id) // Allow finding self if wanted, but mostly finding others
                .limit(5);

            // Filter out profiles already in our list
            const existingIds = profiles.map(p => p.onlineId || p.id);
            const filtered = (data as PlayerProfile[])?.filter(p => !existingIds.includes(p.id)) || [];

            setOnlineResults(filtered);
            setIsSearching(false);
        }, 300);

        return () => clearTimeout(timer);
    }, [searchQuery, myProfile, profiles]);

    return (
        <div className="flex flex-col h-full bg-background max-w-md mx-auto w-full">
            {/* Header - Fixed */}
            <div className="flex-none p-4 pb-2">
                <div className="flex items-center justify-between mb-2">
                    <h1 className="text-2xl font-bold">Select Players</h1>
                    {onBack && <Button variant="ghost" onClick={onBack}>Back</Button>}
                </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4 pt-0">
                {/* Online Section */}
                <div className="space-y-4 mb-4">
                    <div className="flex items-center gap-2 mb-1">
                        <Zap className="w-4 h-4 text-primary" />
                        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Online Multiplayer</h2>
                    </div>

                    {!myProfile ? (
                        <Login />
                    ) : (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between bg-primary/10 p-3 rounded-xl border border-primary/20">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground">
                                        <User className="w-4 h-4" />
                                    </div>
                                    <span className="font-bold">{myProfile.name}</span>
                                </div>
                                <div className="flex gap-1">
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => setShowSettings(true)}>
                                        <Settings className="w-4 h-4" />
                                    </Button>
                                    <Button variant="ghost" size="sm" className="h-8 text-muted-foreground hover:text-destructive" onClick={() => signOut()}>
                                        Abmelden
                                    </Button>
                                </div>
                            </div>

                            {/* Search Bar */}
                            <div className="space-y-1">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                                    <input
                                        className="w-full h-12 pl-10 pr-4 rounded-xl border-2 border-primary/20 bg-card outline-none focus:border-primary transition-all text-lg"
                                        placeholder="Freund oder 2. Account suchen..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </div>
                                <p className="text-xs text-muted-foreground px-1">
                                    Suche nach dem Namen deines Freundes, um ihn hinzuzufügen.
                                </p>
                            </div>

                            {/* Search Results */}
                            {onlineResults.length > 0 && (
                                <div className="bg-muted/10 rounded-xl p-2 border border-dashed border-primary/30 animate-in fade-in slide-in-from-top-2">
                                    {onlineResults.map(p => (
                                        <div key={p.id} className="flex items-center justify-between p-3 hover:bg-background rounded-lg transition-colors group">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                                    <User className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <div className="font-bold">{p.name}</div>
                                                    <div className="text-[10px] uppercase text-primary font-bold">Online</div>
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <Button
                                                    size="sm"
                                                    variant="secondary"
                                                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                                                    onClick={() => setProfileToVerify(p)}
                                                >
                                                    <Plus className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                                                    onClick={() => {
                                                        useMultiplayerStore.getState().sendInvitation(p.id, '501', { mode: 'firstTo', target: 3 });
                                                        alert("Einladung gesendet!");
                                                    }}
                                                >
                                                    Einladen
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {searchQuery.length >= 2 && onlineResults.length === 0 && !isSearching && (
                                <div className="text-center text-xs text-muted-foreground py-2 italic">
                                    Keine Spieler gefunden
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="border-t my-4" />

                {/* Local Profiles List */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between mb-2">
                        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Saved Profiles</h2>
                    </div>

                    {profiles.filter(p => p.type !== 'guest').map(p => {
                        const isSelected = activePlayerIds.includes(p.id);
                        return (
                            <div key={p.id}
                                onClick={() => togglePlayerSelection(p.id)}
                                className={cn(
                                    "flex items-center justify-between p-3 rounded-xl border-2 transition-all cursor-pointer",
                                    isSelected ? "border-primary bg-primary/10" : "border-muted bg-card hover:border-primary/50"
                                )}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={cn("w-10 h-10 rounded-full flex items-center justify-center", isSelected ? "bg-primary text-primary-foreground" : "bg-muted")}>
                                        {p.isOnline ? <User className="w-5 h-5" /> : <User className="w-5 h-5" />}
                                    </div>
                                    <div>
                                        <span className="font-bold text-lg">{p.name}</span>
                                        {p.isOnline && <div className="text-[10px] uppercase text-primary font-bold">Online Account</div>}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {isSelected && <Check className="w-6 h-6 text-primary" />}

                                    {/* Self: No delete button */}
                                    {p.id === myProfile?.id ? null : (
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (p.isOnline) {
                                                    // Friend: Remove immediately
                                                    deleteProfile(p.id);
                                                } else {
                                                    // Local: Ask for confirmation
                                                    setProfileToDelete(p.id);
                                                }
                                            }}
                                        >
                                            {p.isOnline ? <X className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
                                        </Button>
                                    )}
                                </div>
                            </div>
                        );
                    })}

                    {/* Add Profile Input */}
                    {isAdding ? (
                        <div className="flex gap-2 items-center p-2 bg-muted/20 rounded-xl">
                            <input
                                autoFocus
                                className="flex-1 bg-transparent border-none outline-none text-lg px-2"
                                placeholder="Name..."
                                value={newProfileName}
                                onChange={(e) => setNewProfileName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddProfile()}
                            />
                            <Button size="sm" onClick={handleAddProfile}>Add</Button>
                            <Button size="sm" variant="ghost" onClick={() => setIsAdding(false)}>Cancel</Button>
                        </div>
                    ) : (
                        <Button variant="outline" className="w-full justify-start h-12 gap-2" onClick={() => setIsAdding(true)}>
                            <Plus className="w-5 h-5" /> Create New Profile
                        </Button>
                    )}

                    {/* Guests */}
                    <div className="mt-8 mb-2 flex items-center justify-between">
                        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Guests</h2>
                        {profiles.some(p => p.type === 'guest') && (
                            <Button variant="ghost" size="sm" className="text-xs h-6 text-destructive" onClick={resetGuests}>
                                Clear Guests
                            </Button>
                        )}
                    </div>

                    {profiles.filter(p => p.type === 'guest').map(p => {
                        const isSelected = activePlayerIds.includes(p.id);
                        return (
                            <div key={p.id}
                                className={cn(
                                    "flex items-center justify-between p-3 rounded-xl border-2 transition-all cursor-pointer",
                                    isSelected ? "border-primary bg-primary/10" : "border-muted bg-card"
                                )}
                            >
                                <div className="flex items-center gap-3 flex-1" onClick={() => togglePlayerSelection(p.id)}>
                                    <div className={cn("w-10 h-10 rounded-full flex items-center justify-center", isSelected ? "bg-primary text-primary-foreground" : "bg-muted")}>
                                        <UserPlus className="w-5 h-5" />
                                    </div>
                                    <span className="font-bold text-lg">{p.name}</span>
                                </div>
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => deleteProfile(p.id)}>
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </div>
                        );
                    })}

                    <Button variant="outline" className="w-full justify-start h-12 gap-2 border-dashed" onClick={handleAddGuest}>
                        <UserPlus className="w-5 h-5" /> Add Guest Player
                    </Button>
                </div>
            </div>

            {/* Bottom Bar - Sticky */}
            <div className="flex-none p-4 pt-4 border-t bg-background">
                <Button
                    className="w-full h-14 text-xl font-bold bg-green-600 hover:bg-green-700 shadow-lg"
                    size="lg"
                    disabled={activePlayerIds.length === 0}
                    onClick={onStart}
                >
                    Start Game ({activePlayerIds.length})
                </Button>
            </div>

            {/* Dialogs */}
            <ConfirmDialog
                isOpen={!!profileToDelete}
                title="Profil löschen?"
                description="Möchtest du dieses Profil wirklich entfernen? Wenn es ein Online-Profil ist, wird es nur von deinem Gerät entfernt."
                onConfirm={() => {
                    if (profileToDelete) {
                        deleteProfile(profileToDelete);
                        setProfileToDelete(null);
                    }
                }}
                onCancel={() => setProfileToDelete(null)}
                variant="destructive"
                confirmText="Löschen"
            />

            <PasswordVerificationDialog
                isOpen={!!profileToVerify}
                username={profileToVerify?.name || ''}
                onVerify={() => {
                    if (profileToVerify) {
                        const newProfile = { ...profileToVerify, type: 'local' as const, isOnline: true, onlineId: profileToVerify.id, stats: { gamesPlayed: 0, gamesWon: 0 } };
                        usePlayerStore.getState().syncOnlineProfile(newProfile);
                        setProfileToVerify(null);
                        setSearchQuery(""); // Clear search
                        // alert(`${profileToVerify.name} wurde hinzugefügt!`); // Optional success msg
                    }
                }}
                onCancel={() => setProfileToVerify(null)}
            />
            {/* Settings Dialog Placeholder - to be implemented next */}
            {showSettings && <UserSettingsDialog isOpen={showSettings} onClose={() => setShowSettings(false)} />}
        </div>
    );
}
