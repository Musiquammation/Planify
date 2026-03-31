import { Task, ExpandedTask } from '../types/models.js';
import { generateTaskId } from '../services/storage.js';

/** Mutable runtime array of all tasks. */
export const tasks: Task[] = [];

/** Index of the task currently being edited (-1 = new task). */
export let editingTaskIndex = -1;

export function setEditingTaskIndex(i: number): void {
  editingTaskIndex = i;
}

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

/**
 * Removes afterConstraints references to the deleted task id.
 */
export function removeTaskReferences(deletedId: string): void {
  for (const task of tasks) {
    if (task.afterConstraints) {
      task.afterConstraints = task.afterConstraints.filter(c => c.taskId !== deletedId);
      if (task.afterConstraints.length === 0) delete task.afterConstraints;
    }
  }
}

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