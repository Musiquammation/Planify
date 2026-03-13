import { Task, ExpandedTask } from '../types/models.js';

/** Mutable runtime array of all tasks. */
export const tasks: Task[] = [];

/** Index of the task currently being edited (-1 = new task). */
export let editingTaskIndex = -1;

export function setEditingTaskIndex(i: number): void {
  editingTaskIndex = i;
}

// ─── CRUD helpers ──────────────────────────────────────────────────────────

export function addTask(task: Task): void {
  tasks.push(task);
}

export function updateTask(index: number, task: Task): void {
  tasks[index] = task;
}

export function deleteTask(index: number): void {
  tasks.splice(index, 1);
}

export function toggleTaskDone(index: number): void {
  const t = tasks[index];
  t.done = !t.done;
  t.doneAt = t.done ? Date.now() : null;
}

// ─── Expansion (handles fragmentation) ────────────────────────────────────

/**
 * Expands the task list for the algorithm: each fragment of a fragmented task
 * becomes a separate ExpandedTask; non-fragmented tasks expand 1-to-1.
 * Done tasks are skipped.
 */
export function expandTasks(taskList: Task[]): ExpandedTask[] {
  const result: ExpandedTask[] = [];

  for (const task of taskList) {
    if (task.done) continue;

    if (!task.fragmentation || task.fragmentation.length === 0) {
      result.push({
        ...task,
        reference: task,
        fragmentation: -1,
      } as unknown as ExpandedTask);
    } else {
      const n = task.fragmentation.length;
      task.fragmentation.forEach((fragmentDuration, i) => {
        result.push({
          ...task,
          name: `${task.name} (${i + 1}/${n})`,
          duration: fragmentDuration,
          reference: task,
          fragmentation: i,
        } as unknown as ExpandedTask);
      });
    }
  }

  return result;
}
