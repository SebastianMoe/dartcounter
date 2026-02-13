import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface ConfirmDialogProps {
    isOpen: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
    onCancel: () => void;
    confirmText?: string;
    cancelText?: string;
    variant?: 'default' | 'destructive';
}

export function ConfirmDialog({
    isOpen,
    title,
    description,
    onConfirm,
    onCancel,
    confirmText = "Bestätigen",
    cancelText = "Abbrechen",
    variant = 'default'
}: ConfirmDialogProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in">
            <div className="bg-card w-full max-w-md p-6 rounded-xl border shadow-xl animate-in zoom-in-95 data-[state=open]:animate-out data-[state=closed]:fade-out-0">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold">{title}</h2>
                    <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <p className="text-muted-foreground mb-6">{description}</p>
                <div className="flex justify-end gap-3">
                    <Button variant="outline" onClick={onCancel}>{cancelText}</Button>
                    <Button
                        variant={variant === 'destructive' ? 'destructive' : 'default'}
                        onClick={onConfirm}
                    >
                        {confirmText}
                    </Button>
                </div>
            </div>
        </div>
    );
}
