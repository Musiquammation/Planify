import { Slot, Task, ExpandedTask } from '../types/models.js';

/** Maps each Slot to the list of ExpandedTasks assigned to it. */
export const completions = new Map<Slot, ExpandedTask[]>();

export function assignTasksToSlots(map: Map<Slot, ExpandedTask[]>): void {
  completions.clear();
  map.forEach((tasks, slot) => completions.set(slot, tasks));
}

export function clearCompletions(): void {
  completions.clear();
}

export function getTasksForSlot(slot: Slot): ExpandedTask[] {
  return completions.get(slot) ?? [];
}

export function emptySlot(slot: Slot): void {
  const list = completions.get(slot);
  if (list) list.length = 0;
}

/**
 * Removes all expanded tasks that reference the given original task.
 * Cleans up empty entries from the map.
 */
export function removeTaskFromCompletions(taskToRemove: Task): void {
  for (const [slot, expandedList] of completions) {
    const filtered = expandedList.filter(et => et.reference !== taskToRemove);
    if (filtered.length === 0) {
      completions.delete(slot);
    } else if (filtered.length !== expandedList.length) {
      expandedList.length = 0;
      expandedList.push(...filtered);
    }
  }
}

/**
 * Removes all expanded tasks of a given type name.
 * Cleans up empty entries from the map.
 */
export function removeTypeFromCompletions(typeName: string): void {
  for (const [slot, expandedList] of completions) {
    const filtered = expandedList.filter(et => et.type !== typeName);
    if (filtered.length === 0) {
      completions.delete(slot);
    } else if (filtered.length !== expandedList.length) {
      expandedList.length = 0;
      expandedList.push(...filtered);
    }
  }
}
