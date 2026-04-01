import { Task, Slot, TaskType, SlotStore, ExpandedTask } from '../types/models.js';
import { toDayNumber } from '../utils/date.js';

export interface NormalizedSlot {
  start: number;
  end: number;
  taskPreferences: Record<string, number>;
  dateKey: string;
}

export function buildBufferArgs(
  store: SlotStore,
  tasks: ExpandedTask[]
) {
  const today = new Date();
  const todayOffset = toDayNumber(today.getFullYear(), today.getMonth() + 1, today.getDate());

  // Find global minimum start (earliest slot or bornline)
  let globalMinStart = Infinity;

  Object.keys(store).forEach(dateKey => {
    const [y, m, d] = dateKey.split('-').map(Number);
    const dateOffset = toDayNumber(y, m, d);
    if (dateOffset < todayOffset) return;
    store[dateKey].forEach(slot => {
      const gs = dateOffset * 24 * 60 + slot.start;
      if (gs < globalMinStart) globalMinStart = gs;
    });
  });

  tasks.forEach(task => {
    if (task.bornline) {
      const b = new Date(task.bornline);
      const dayNum = toDayNumber(b.getFullYear(), b.getMonth() + 1, b.getDate());
      const abs = dayNum * 24 * 60 + b.getHours() * 60 + b.getMinutes();
      if (abs < globalMinStart) globalMinStart = abs;
    }
  });

  if (!isFinite(globalMinStart)) {
    globalMinStart = todayOffset * 24 * 60;
  }

  // Build normalized slots (relative to globalMinStart)
  const slots: NormalizedSlot[] = [];
  Object.keys(store).forEach(dateKey => {
    const [y, m, d] = dateKey.split('-').map(Number);
    const dateOffset = toDayNumber(y, m, d);
    if (dateOffset < todayOffset) return;
    store[dateKey].forEach(slot => {
      const gs = dateOffset * 24 * 60 + slot.start;
      const ge = dateOffset * 24 * 60 + slot.end;
      slots.push({
        taskPreferences: slot.taskPreferences,
        start: gs - globalMinStart,
        end:   ge - globalMinStart,
        dateKey,
      });
    });
  });

  return {slots, globalMinStart};
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
