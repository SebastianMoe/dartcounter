import { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Mic, MicOff } from "lucide-react";
// import { parseVoiceCommands } from "@/lib/voice-parser";
// import { useX01Store } from "@/lib/store";
import { cn } from "@/lib/utils";

export function VoiceControl({
    onTotalScore,
    className,
    mini = false
}: {
    inputMode?: 'single' | 'total',
    onTotalScore?: (score: number) => void,
    className?: string,
    mini?: boolean
}) {
    const [isListening, setIsListening] = useState(false);
    const shouldListenRef = useRef(false);
    const [lastTranscript, setLastTranscript] = useState("");
    const recognitionRef = useRef<SpeechRecognition | null>(null);
    // const { addThrow } = useX01Store();

    useEffect(() => {
        if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
            console.warn("Speech recognition not supported");
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();

        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.lang = 'de-DE';

        recognition.onresult = (event: SpeechRecognitionEvent) => {
            const last = event.results.length - 1;
            const transcript = event.results[last][0].transcript.trim();
            const lowerTranscript = transcript.toLowerCase();

            console.log("Heard:", transcript);

            // Check for prefixes
            const prefixes = ['score', 'skora', 'square', 'skore', 'scor', 'goal', 'sogar', 'schor', 'core', 'skor', 'skohr', 'skur', 'sgoa', 'store'];
            const foundPrefix = prefixes.find(p => lowerTranscript.includes(p));

            if (!foundPrefix) {
                setLastTranscript(`${transcript} (Say 'Score' ...)`);
                return;
            }

            // Remove prefix and clean punctuation
            let cleanTranscript = lowerTranscript.replace(foundPrefix, '').replace(/[.,]/g, ' ').trim();

            // Normalize spaces
            cleanTranscript = cleanTranscript.replace(/\s+/g, ' ');

            setLastTranscript(cleanTranscript);

            // Force Total Input Logic (Single Dart Input Disabled per User Request)
            // Even if inputMode is 'single', we treat voice as 'total' for now to avoid issues.

            // Try to parse as total score
            const potentialScore = parseInt(cleanTranscript.replace(/\D/g, ''));

            if (!isNaN(potentialScore) && potentialScore >= 0 && potentialScore <= 180 && onTotalScore) {
                // Verification TTS
                const utterance = new SpeechSynthesisUtterance(potentialScore.toString());
                utterance.lang = 'de-DE';
                window.speechSynthesis.speak(utterance);

                onTotalScore(potentialScore);
                setLastTranscript(`${transcript} -> ${potentialScore}`);
            } else {
                setLastTranscript(`${transcript} (?)`);
            }

            // Single Mode Logic Blocked
            /*
            if (inputMode === 'total') {
                const val = parseInt(cleanTranscript.replace(/\D/g, ''));

                if (!isNaN(val) && val >= 0 && val <= 180 && onTotalScore) {
                    onTotalScore(val);
                    setLastTranscript(`${transcript} -> ${val}`);
                } else {
                    setLastTranscript(`${transcript} (?)`);
                }
            } else {
                // Single Mode - Multi-throw support
                const throws = parseVoiceCommands(cleanTranscript);

                if (throws.length > 0) {
                    // Apply all throws
                    throws.forEach(t => addThrow(t));
                    setLastTranscript(`${transcript} -> ${throws.length} Hits`);
                } else {
                    setLastTranscript(`${transcript} (?)`);
                }
            }
            */
        };

        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
            console.error("Speech error", event.error);
            if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
                setIsListening(false);
                shouldListenRef.current = false;
            }
            // For other errors (no-speech, network, etc.), we let onend handle the restart
        };

        recognition.onend = () => {
            // Auto-restart if we should still be listening
            if (shouldListenRef.current) {
                console.log("Restarting recognition...");
                try {
                    recognition.start();
                } catch (e) {
                    console.error("Failed to restart recognition:", e);
                    setIsListening(false);
                    shouldListenRef.current = false;
                }
            } else {
                setIsListening(false);
            }
        };

        recognitionRef.current = recognition;

        return () => {
            shouldListenRef.current = false;
            // No need to set isListening to false here as component is unmounting
            if (recognitionRef.current) recognitionRef.current.stop();
        };
    }, []);

    const toggleListening = () => {
        if (isListening) {
            shouldListenRef.current = false;
            recognitionRef.current?.stop();
            setIsListening(false);
        } else {
            shouldListenRef.current = true;
            try {
                recognitionRef.current?.start();
                setIsListening(true);
            } catch (e) {
                console.error("Failed to start recognition:", e);
                shouldListenRef.current = false;
            }
        }
    };

    const activeClass = "bg-red-500 hover:bg-red-600 text-white border-red-600 ring-2 ring-red-500/50 ring-offset-2";
    const inactiveClass = "bg-secondary/80 hover:bg-secondary";

    const isSecure = typeof window !== 'undefined' && window.isSecureContext;

    if (mini) {
        return (
            <Button
                variant="ghost" // we override with className
                size="icon"
                disabled={!isSecure}
                className={cn(
                    "rounded-full shadow-sm transition-all duration-200",
                    isListening ? activeClass : inactiveClass,
                    !isSecure && "opacity-50 cursor-not-allowed",
                    className
                )}
                onClick={toggleListening}
                title={!isSecure ? "Spracheingabe benötigt HTTPS auf dem Handy" : ""}
            >
                {isListening ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5 opacity-50" />}
            </Button>
        );
    }

    return (
        <div className="flex flex-col items-center gap-2 p-2">
            <Button
                variant="ghost"
                size="icon"
                disabled={!isSecure}
                className={cn(
                    "h-16 w-16 rounded-full shadow-lg transition-all duration-200",
                    isListening ? activeClass : "bg-secondary hover:bg-secondary/80",
                    !isSecure && "opacity-50 cursor-not-allowed",
                    className
                )}
                onClick={toggleListening}
            >
                {isListening ? <Mic className="h-8 w-8" /> : <MicOff className="h-8 w-8" />}
            </Button>

            <div className="h-6 text-sm text-muted-foreground font-mono text-center">
                {!isSecure ? (
                    <span className="text-destructive text-xs">HTTPS für Spracheingabe benötigt</span>
                ) : (
                    lastTranscript || "Say 'Score 120'"
                )}
            </div>
        </div>
    );
}
