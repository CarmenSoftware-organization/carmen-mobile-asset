/**
 * Initial Counted Qty for the Asset Information screen.
 * - accumulate (reached via scan): saved + 1 (each scan adds one on save).
 * - otherwise (reached via the list view button): the saved value, or 1 for a new entry.
 */
export function initialCountQty(existingQty: number | null, accumulate: boolean): number {
  if (accumulate) return (existingQty ?? 0) + 1;
  return existingQty ?? 1;
}
