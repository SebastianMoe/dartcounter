import type { Modifier } from '@dnd-kit/core';

/** Only allow vertical movement while dragging (same as @dnd-kit/modifiers, without the extra package). */
export const restrictToVerticalAxis: Modifier = ({ transform }) => ({ ...transform, x: 0 });
