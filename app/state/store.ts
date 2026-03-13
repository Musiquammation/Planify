import { Slot, SlotStore } from '../types/models.js';
import { isoDateKey } from '../utils/date.js';

/** The current date displayed in the calendar. */
export let viewDate: Date = (() => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
})();

export function setViewDate(d: Date): void {
  viewDate = new Date(d);
  viewDate.setHours(0, 0, 0, 0);
}

/** All slots keyed by ISO date string "YYYY-MM-DD". */
export let store: SlotStore = {};

export function setStore(s: SlotStore): void {
  store = s;
}

/** The slot currently open in the side menu. */
export let currentEditingSlot: Slot | null = null;

export function setCurrentEditingSlot(slot: Slot | null): void {
  currentEditingSlot = slot;
}

// ─── CRUD helpers ──────────────────────────────────────────────────────────

export function getSlotsForDate(dateKey: string): Slot[] {
  return store[dateKey] ?? [];
}

export function addSlot(slot: Slot, dateKey: string): void {
  if (!store[dateKey]) store[dateKey] = [];
  store[dateKey].push(slot);
}

export function deleteSlot(slot: Slot, dateKey: string): void {
  if (!store[dateKey]) return;
  const idx = store[dateKey].indexOf(slot);
  if (idx > -1) store[dateKey].splice(idx, 1);
}

export function updateSlot(slot: Slot, partial: Partial<Slot>): void {
  Object.assign(slot, partial);
}

export function emptySlotCompletions(slot: Slot, completions: Map<Slot, unknown[]>): void {
  const list = completions.get(slot);
  if (list) list.length = 0;
}

/**
 * Moves a slot from one date/position to another.
 * Returns false if the destination overlaps an existing slot.
 */
export function moveSlotToNewDateTime(
  slot: Slot,
  oldDateKey: string,
  newDateKey: string,
  newStartMinute: number,
): boolean {
  const duration = slot.end - slot.start;
  if (newStartMinute < 0) newStartMinute = 0;
  if (newStartMinute + duration > 24 * 60) newStartMinute = 24 * 60 - duration;

  const newEnd = newStartMinute + duration;
  const destSlots = store[newDateKey] ?? [];
  const hasOverlap = destSlots.some(
    s => s !== slot && !(newEnd <= s.start || newStartMinute >= s.end),
  );

  if (hasOverlap) return false;

  // Remove from old day
  deleteSlot(slot, oldDateKey);

  // Mutate slot in place and add to new day
  slot.start = newStartMinute;
  slot.end = newEnd;
  if (!store[newDateKey]) store[newDateKey] = [];
  store[newDateKey].push(slot);

  return true;
}
