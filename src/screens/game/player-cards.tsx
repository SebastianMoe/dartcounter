import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Two big player cards side by side. With three or more players the cards sit on an
 * endless track: the active player is always on the left, the next one on the right,
 * and the track slides left on every change of turn (wrapping around smoothly).
 */
export function PlayerCards({ count, current, renderCard, strip }: {
    count: number;
    /** Index of the player whose turn it is */
    current: number;
    renderCard: (index: number) => ReactNode;
    /** Compact score per player, shown under the carousel for 3+ players */
    strip?: (index: number) => { name: string; value: ReactNode; active: boolean };
}) {
    if (count <= 2) {
        return (
            <div className={cn('grid gap-2', count === 1 ? 'grid-cols-1' : 'grid-cols-2')}>
                {Array.from({ length: count }, (_, i) => <div key={i} className="min-w-0">{renderCard(i)}</div>)}
            </div>
        );
    }
    return (
        <div className="space-y-2">
            <Carousel count={count} current={current} renderCard={renderCard} />
            {strip && (
                <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
                    {Array.from({ length: count }, (_, i) => {
                        const s = strip(i);
                        return (
                            <div key={i} className={cn(
                                'flex flex-none items-baseline gap-1.5 rounded-full border px-3 py-1 text-xs',
                                s.active ? 'border-primary bg-primary/10 text-primary' : 'bg-card text-muted-foreground',
                            )}>
                                <span className="max-w-[6rem] truncate font-semibold">{s.name}</span>
                                <span className="font-black tabular-nums text-foreground">{s.value}</span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

const SLIDE_MS = 350;

function Carousel({ count, current, renderCard }: { count: number; current: number; renderCard: (i: number) => ReactNode }) {
    // Track = all players plus the first two again, so wrapping n-1 -> 0 can keep sliding left.
    const [pos, setPos] = useState(current);
    const [animate, setAnimate] = useState(true);
    const prev = useRef(current);

    // Two-step slide animation (jump to the duplicate, then slide) needs state updates
    // right after a turn change, before paint.
    /* eslint-disable react-hooks/set-state-in-effect */
    useLayoutEffect(() => {
        const from = prev.current;
        prev.current = current;
        if (from === current) return;
        let t: number | undefined;
        if (current === 0 && from === count - 1) {
            // forward wrap: slide to the duplicate of player 0, then jump back invisibly
            setAnimate(true);
            setPos(count);
            t = window.setTimeout(() => { setAnimate(false); setPos(0); }, SLIDE_MS + 20);
        } else if (current === count - 1 && from === 0) {
            // backward wrap (undo): jump to the duplicate, then slide right
            setAnimate(false);
            setPos(count);
            t = window.setTimeout(() => { setAnimate(true); setPos(count - 1); }, 30);
        } else {
            setAnimate(true);
            setPos(current);
        }
        return () => window.clearTimeout(t);
    }, [current, count]);
    /* eslint-enable react-hooks/set-state-in-effect */

    const track = [...Array.from({ length: count }, (_, i) => i), 0, 1];
    return (
        <div className="overflow-hidden [container-type:inline-size]">
            <div
                className="flex gap-2"
                style={{
                    transform: `translateX(calc(${-pos} * (50cqw + 4px)))`,
                    transition: animate ? `transform ${SLIDE_MS}ms cubic-bezier(.2,.8,.2,1)` : 'none',
                }}
            >
                {track.map((p, k) => (
                    <div key={k} className="min-w-0 flex-none basis-[calc(50cqw-4px)]">{renderCard(p)}</div>
                ))}
            </div>
        </div>
    );
}
