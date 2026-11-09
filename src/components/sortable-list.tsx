import type { ReactNode } from 'react';
import {
    DndContext, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from './dnd-modifiers';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { cn, haptic } from '@/lib/utils';

/** Vertical list whose rows can be reordered by dragging the grip (touch + mouse + keyboard). */
export function SortableList<T>({ items, getKey, onChange, renderItem }: {
    items: T[];
    getKey: (item: T) => string;
    onChange: (items: T[]) => void;
    renderItem: (item: T, index: number) => ReactNode;
}) {
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 80, tolerance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );
    const keys = items.map(getKey);

    const onDragEnd = (e: DragEndEvent) => {
        if (!e.over || e.active.id === e.over.id) return;
        const from = keys.indexOf(String(e.active.id));
        const to = keys.indexOf(String(e.over.id));
        if (from < 0 || to < 0) return;
        haptic(15);
        onChange(arrayMove(items, from, to));
    };

    return (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={() => haptic(10)} onDragEnd={onDragEnd} modifiers={[restrictToVerticalAxis]}>
            <SortableContext items={keys} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                    {items.map((item, i) => (
                        <SortableRow key={keys[i]} id={keys[i]}>{renderItem(item, i)}</SortableRow>
                    ))}
                </div>
            </SortableContext>
        </DndContext>
    );
}

function SortableRow({ id, children }: { id: string; children: ReactNode }) {
    const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
    return (
        <div
            ref={setNodeRef}
            style={{ transform: CSS.Transform.toString(transform), transition }}
            className={cn('flex h-14 items-center rounded-2xl border bg-card', isDragging && 'relative z-10 scale-[1.02] border-primary shadow-xl')}
        >
            <button
                ref={setActivatorNodeRef}
                {...attributes}
                {...listeners}
                aria-label="Verschieben"
                className="flex h-full w-11 flex-none cursor-grab touch-none items-center justify-center text-muted-foreground active:cursor-grabbing"
            >
                <GripVertical className="h-5 w-5" />
            </button>
            {children}
        </div>
    );
}
