export interface TaskType {
  name: string;
  color: string;
}

export interface Task {
  name: string;
  duration: number;        // in minutes
  type: string;            // name of TaskType
  bornline: string | null; // ISO datetime "YYYY-MM-DDTHH:MM"
  deadline: string | null; // ISO datetime "YYYY-MM-DDTHH:MM"
  done: boolean;
  doneAt: number | null;   // timestamp ms
  fragmentation?: number[]; // fragment durations in minutes
}

export interface Slot {
  start: number;           // minutes since midnight
  end: number;             // minutes since midnight
  name?: string;
  taskPreferences: Record<string, number>; // typeName -> 0..1
  done?: boolean;
  doneAt?: number;         // timestamp ms
}

/**
 * An expanded task is either the original task (no fragmentation)
 * or one specific fragment of a fragmented task.
 */
export interface ExpandedTask extends Omit<Task, 'fragmentation'> {
  reference: Task;
  fragmentation: number;   // -1 = pas de fragmentation, sinon index du fragment
}

/** store[dateKey] = Slot[] */
export type SlotStore = Record<string, Slot[]>;
