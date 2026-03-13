import { Slot, TaskType } from '../types/models.js';
import { DEFAULT_SLOT_COLOR } from '../types/constants.js';

/**
 * Returns the display color for a slot based on its task-type preferences.
 * The dominant (highest-score) type wins. Ties or zero-score → default color.
 */
export function getSlotColor(slot: Slot, taskTypes: TaskType[]): string {
  if (!slot.taskPreferences) return DEFAULT_SLOT_COLOR;

  const entries = Object.entries(slot.taskPreferences);
  if (entries.length === 0) return DEFAULT_SLOT_COLOR;

  let maxScore = -Infinity;
  let dominantType: string | null = null;
  let isTie = false;

  for (const [typeName, score] of entries) {
    if (score > maxScore) {
      maxScore = score;
      dominantType = typeName;
      isTie = false;
    } else if (score === maxScore) {
      isTie = true;
    }
  }

  if (isTie || maxScore <= 0 || dominantType === null) return DEFAULT_SLOT_COLOR;

  const typeObj = taskTypes.find(t => t.name === dominantType);
  return typeObj ? typeObj.color : DEFAULT_SLOT_COLOR;
}
