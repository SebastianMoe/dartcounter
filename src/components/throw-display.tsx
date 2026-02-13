import type { Throw } from "@/lib/types";

interface ThrowDisplayProps {
    throwData: Throw | null;
    active?: boolean;
    size?: 'sm' | 'md' | 'lg';
}

export function ThrowDisplay({ throwData, active, size = 'md' }: ThrowDisplayProps) {
    const sizeClasses = {
        sm: 'w-8 h-8 text-xs border-[1px]',
        md: 'w-12 h-12 text-sm border-2',
        lg: 'w-14 h-14 text-lg border-4'
    };

    const containerClass = sizeClasses[size];

    if (!throwData) {
        return (
            <div className={`rounded-full flex items-center justify-center font-bold ${containerClass}
        ${active ? 'border-primary bg-primary/10' : 'border-muted bg-muted/20'}`}>
            </div>
        );
    }

    let label = '';
    if (throwData.isManual) {
        label = throwData.score.toString();
    } else {
        label = throwData.segment === 25
            ? (throwData.multiplier === 2 ? 'BULL' : '25')
            : `${throwData.multiplier === 3 ? 'T' : throwData.multiplier === 2 ? 'D' : ''}${throwData.segment}`;

        if (throwData.score === 0) label = 'MISS';
    }

    return (
        <div className={`rounded-full border-primary bg-background flex items-center justify-center font-bold shadow-sm ${containerClass}`}>
            {label}
        </div>
    );
}
