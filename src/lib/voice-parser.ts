import type { Throw } from "./types";



const NUMBERS: Record<string, number> = {
    // English
    'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
    'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
    'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14, 'fifteen': 15,
    'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19, 'twenty': 20,
    'bulleye': 25, 'bull': 25, 'bulls': 25, 'bullseye': 50,
    'zero': 0, 'miss': 0, 'none': 0,

    // German
    'eins': 1, 'zwei': 2, 'drei': 3, 'vier': 4, 'fünf': 5,
    'sechs': 6, 'sieben': 7, 'acht': 8, 'neun': 9, 'zehn': 10,
    'elf': 11, 'zwölf': 12, 'dreizehn': 13, 'vierzehn': 14, 'fünfzehn': 15,
    'sechzehn': 16, 'siebzehn': 17, 'achtzehn': 18, 'neunzehn': 19, 'zwanzig': 20,
    'bullauge': 25, 'null': 0, 'daneben': 0, 'nix': 0
};

const MULTIPLIERS = {
    'double': 2, 'doppel': 2, 'd': 2,
    'triple': 3, 'trippel': 3, 't': 3, 'dreifach': 3
};

export function parseVoiceCommands(transcript: string): Throw[] {
    const clean = transcript.toLowerCase().trim();
    const words = clean.split(/\s+/);
    const throws: Throw[] = [];

    let currentMultiplier: 1 | 2 | 3 = 1;

    for (const word of words) {
        // Check modifiers
        if (MULTIPLIERS[word as keyof typeof MULTIPLIERS]) {
            currentMultiplier = MULTIPLIERS[word as keyof typeof MULTIPLIERS] as 1 | 2 | 3;
            continue;
        }



        // Check named numbers
        if (NUMBERS[word] !== undefined) {
            const val = NUMBERS[word];
            processSegment(val, currentMultiplier);
            currentMultiplier = 1;
        } else {
            // Check numeric
            if (/^\d+$/.test(word)) {
                const parsed = parseInt(word);
                // If it's a valid single segment, take it
                if (isValidSegment(parsed)) {
                    processSegment(parsed, currentMultiplier);
                    currentMultiplier = 1;
                } else {
                    // Try to split
                    const parts = splitConcatenatedScores(word);
                    parts.forEach((p, idx) => {
                        const mult = idx === 0 ? currentMultiplier : 1;
                        processSegment(p, mult);
                    });
                    currentMultiplier = 1;
                }
            } else {
                // Fallback for non-pure numeric (maybe with punctuation if not cleaned?)
                // But we cleaned in VoiceControl.
            }
        }
    }

    function processSegment(seg: number, mult: 1 | 2 | 3) {
        if (seg > 0 || seg === 0) {
            if (seg === 50 && mult === 1) {
                throws.push(createThrow(25, 2));
            } else if (isValidSegment(seg)) {
                throws.push(createThrow(seg, mult));
            }
        }
    }

    return throws;
}

function isValidSegment(val: number) {
    return (val >= 0 && val <= 20) || val === 25 || val === 50;
}

function splitConcatenatedScores(str: string): number[] {
    const results: number[] = [];
    let i = 0;
    while (i < str.length) {
        // Try taking 2 digits
        if (i + 2 <= str.length) {
            const two = parseInt(str.substring(i, i + 2));
            if (isValidSegment(two)) {
                results.push(two);
                i += 2;
                continue;
            }
        }
        // Fallback to 1 digit
        const one = parseInt(str.substring(i, i + 1));
        if (!isNaN(one)) {
            results.push(one);
        }
        i += 1;
    }
    return results;
}

function createThrow(segment: number, multiplier: 1 | 2 | 3): Throw {
    return {
        score: segment, // Score is calculated later (segment * multiplier)
        multiplier,
        segment,
        isDouble: multiplier === 2,
        isTriple: multiplier === 3,
        isOuterBull: segment === 25 && multiplier === 1,
        isInnerBull: segment === 25 && multiplier === 2
    };
}
