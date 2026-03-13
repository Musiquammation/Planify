import { Task, Slot, TaskType } from '../types/models.js';
import { toDayNumber } from '../utils/date.js';

export interface NormalizedSlot {
  start: number;
  end: number;
  taskPreferences: Record<string, number>;
  dateKey: string;
}

/**
 * Builds the binary buffer sent to the WASM algorithm.
 * Layout:
 *   header:  [nTasks: i32, nSlots: i32, nTypes: i32]
 *   slots:   per slot: [start: i32, duration: i32, prefs: u8 * nTypes]
 *   tasks:   per task: [duration: i32, typeIndex: i32, bornline: i32, deadline: i32]
 */
export function buildBuffer(
  slots: NormalizedSlot[],
  tasks: Task[],
  taskTypes: TaskType[],
  zeroDate: number,
): ArrayBuffer {
  const headerSize = 3 * 4;
  const slotsSize  = slots.reduce(() => 2 * 4 + taskTypes.length * 1, 0) * slots.length;
  const tasksSize  = tasks.length * 4 * 4;

  const buffer = new ArrayBuffer(headerSize + slotsSize + tasksSize);
  const view   = new DataView(buffer);
  let offset   = 0;

  const writeInt  = (v: number) => { view.setInt32(offset, v, true); offset += 4; };
  const writeByte = (v: number) => { view.setUint8(offset, v); offset += 1; };

  // Header
  writeInt(tasks.length);
  writeInt(slots.length);
  writeInt(taskTypes.length);

  // Slots
  for (const slot of slots) {
    writeInt(slot.start);
    writeInt(slot.end - slot.start);
    for (const type of taskTypes) {
      const pref   = slot.taskPreferences[type.name] ?? 0;
      const scaled = Math.max(0, Math.min(250, Math.round(pref * 250)));
      writeByte(scaled);
    }
  }

  // Tasks
  for (const task of tasks) {
    writeInt(task.duration);

    const typeIndex = taskTypes.findIndex(t => t.name === task.type);
    if (typeIndex === -1) throw new Error(`Unknown task type: ${task.type}`);
    writeInt(typeIndex);

    // Bornline
    let bornlineMin = -0x80000000;
    if (task.bornline) {
      const d = new Date(task.bornline);
      const dayNum = toDayNumber(d.getFullYear(), d.getMonth() + 1, d.getDate());
      bornlineMin = dayNum * 24 * 60 + d.getHours() * 60 + d.getMinutes() - zeroDate;
    }
    writeInt(bornlineMin);

    // Deadline
    let deadlineMin = 0x7fffffff;
    if (task.deadline) {
      const d = new Date(task.deadline);
      const dayNum = toDayNumber(d.getFullYear(), d.getMonth() + 1, d.getDate());
      deadlineMin = dayNum * 24 * 60 + d.getHours() * 60 + d.getMinutes() - zeroDate;
    }
    writeInt(deadlineMin);
  }

  return buffer;
}
