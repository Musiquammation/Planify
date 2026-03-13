import { Task, SlotStore } from '../types/models.js';
import { TaskType } from '../types/models.js';
import { tasks } from '../state/tasks.js';
import { store, setStore } from '../state/store.js';
import { taskTypes } from '../config/taskTypes.js';

export function saveStore(): void {
  localStorage.setItem('stores', JSON.stringify(store));
}

export function saveTasks(): void {
  localStorage.setItem('tasks', JSON.stringify(tasks));
}

export function saveTaskTypes(): void {
  localStorage.setItem('types', JSON.stringify(taskTypes));
}

export function loadData(): void {
  // Tasks
  tasks.length = 0;
  const rawTasks = localStorage.getItem('tasks');
  if (rawTasks) {
    for (const t of JSON.parse(rawTasks) as Task[]) {
      tasks.push(t);
    }
  }

  // Store
  const rawStore = localStorage.getItem('stores');
  setStore(rawStore ? JSON.parse(rawStore) : {});

  // Task types
  const rawTypes = localStorage.getItem('types');
  if (rawTypes) {
    taskTypes.length = 0;
    for (const t of JSON.parse(rawTypes) as TaskType[]) {
      taskTypes.push(t);
    }
  }
}
