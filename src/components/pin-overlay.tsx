import { useState } from 'react'
import { Button } from "@/components/ui/button"

const CORRECT_PIN = "180"; // The PIN code (Darts related)

interface PinOverlayProps {
    onAuthenticated: () => void;
}

export function PinOverlay({ onAuthenticated }: PinOverlayProps) {
    const [pin, setPin] = useState("");
    const [error, setError] = useState(false);

    const handleKeyPress = (key: string) => {
        if (error) setError(false);
        if (pin.length < 4) {
            setPin(prev => prev + key);
        }
    };

    const handleDelete = () => {
        setPin(prev => prev.slice(0, -1));
        setError(false);
    };

    const handleSubmit = () => {
        if (pin === CORRECT_PIN) {
            localStorage.setItem('darts_app_authenticated', 'true');
            onAuthenticated();
        } else {
            setError(true);
            setPin("");
        }
    };

    return (
        <div className="fixed inset-0 bg-background z-50 flex flex-col items-center justify-center p-4">
            <div className="max-w-xs w-full space-y-8 text-center">
                <div>
                    <h2 className="text-2xl font-bold mb-2">Privater Bereich</h2>
                    <p className="text-muted-foreground text-sm">
                        Bitte PIN eingeben um fortzufahren
                    </p>
                </div>

                <div className="flex justify-center flex-col items-center gap-2">
                    <div className="flex gap-3 mb-6">
                        <div className={`w-4 h-4 rounded-full border-2 ${pin.length >= 1 ? 'bg-primary border-primary' : 'border-muted-foreground'}`} />
                        <div className={`w-4 h-4 rounded-full border-2 ${pin.length >= 2 ? 'bg-primary border-primary' : 'border-muted-foreground'}`} />
                        <div className={`w-4 h-4 rounded-full border-2 ${pin.length >= 3 ? 'bg-primary border-primary' : 'border-muted-foreground'}`} />
                    </div>
                    {error && <p className="text-destructive text-sm min-h-5">Falsche PIN</p>}
                    {!error && <p className="text-sm min-h-5 opacity-0">Placeholder</p>}
                </div>

                <div className="grid grid-cols-3 gap-4">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                        <Button
                            key={num}
                            variant="outline"
                            size="lg"
                            className="h-16 text-2xl"
                            onClick={() => handleKeyPress(num.toString())}
                        >
                            {num}
                        </Button>
                    ))}
                    <Button
                        variant="ghost"
                        size="lg"
                        className="h-16 text-xl"
                        onClick={handleDelete}
                        disabled={pin.length === 0}
                    >
                        Zurück
                    </Button>
                    <Button
                        variant="outline"
                        size="lg"
                        className="h-16 text-2xl"
                        onClick={() => handleKeyPress("0")}
                    >
                        0
                    </Button>
                    <Button
                        variant="default"
                        size="lg"
                        className="h-16 text-xl"
                        onClick={handleSubmit}
                        disabled={pin.length === 0}
                    >
                        OK
                    </Button>
                </div>
            </div>
        </div>
    );
}
