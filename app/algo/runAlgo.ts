import { Slot, ExpandedTask, SlotStore } from '../types/models.js';
import { TaskType } from '../types/models.js';
import { store, viewDate } from '../state/store.js';
import { tasks, expandTasks } from '../state/tasks.js';
import { taskTypes } from '../config/taskTypes.js';
import { toDayNumber, isoDateKey } from '../utils/date.js';

// ─── Running flag ──────────────────────────────────────────────────────────

let _isRunning = false;
let _workerInstance: Worker | null = null;
let _currentReject: ((err: Error) => void) | null = null;

export function isAlgoRunning(): boolean {
  return _isRunning;
}

/** Guard used throughout the app to prevent edits while algo runs. */
export function canEditData(): boolean {
  return !_isRunning;
}

// ─── Run ───────────────────────────────────────────────────────────────────

/**
 * Expands tasks, filters future slots, posts a message to the worker,
 * and resolves with a Map<Slot, ExpandedTask[]>.
 */
export function runAlgoInWorker(
  storeData: SlotStore,
  taskList: typeof tasks,
  types: TaskType[],
): Promise<Map<Slot, ExpandedTask[]>> {
  if (_isRunning) return Promise.reject(new Error('Already running algo'));

  const date         = new Date();
  const todayOffset  = toDayNumber(date.getFullYear(), date.getMonth() + 1, date.getDate());
  const nowMinutes   = 0;

  // Collect only future slots
  const futureSlots: Slot[] = [];
  Object.keys(storeData).forEach(dateKey => {
    const [y, m, d]    = dateKey.split('-').map(Number);
    const dateOffset   = toDayNumber(y, m, d);
    if (dateOffset < todayOffset) return;

    storeData[dateKey].forEach(slot => {
      if (dateOffset === todayOffset && slot.start < nowMinutes) return;
      futureSlots.push(slot);
    });
  });

  const expandedTasks = expandTasks(taskList);

  return new Promise((resolve, reject) => {
    _isRunning   = true;
    _currentReject = reject;

    const worker = new Worker('algoWorker.js');
    _workerInstance = worker;

    worker.onmessage = (event) => {
      const { action, result, error } = event.data;

      if (action === 'result') {
        const output = new Map<Slot, ExpandedTask[]>();
        for (let s = 0; s < result.length; s++) {
          output.set(futureSlots[s], (result[s] as number[]).map(i => expandedTasks[i]));
        }
        _cleanup();
        worker.terminate();
        resolve(output);
      } else if (action === 'error') {
        _cleanup();
        worker.terminate();
        reject(new Error(error));
      }
    };

    worker.onerror = (err) => {
      _cleanup();
      worker.terminate();
      reject(err);
    };

    worker.postMessage({ action: 'runAlgo', store: storeData, tasks: expandedTasks, taskTypes: types });
  });
}

export function stopAlgoInWorker(): boolean {
  if (!_isRunning) return false;

  _workerInstance?.terminate();
  _workerInstance = null;
  _currentReject?.(new Error('Stopped'));
  _currentReject = null;
  _isRunning = false;
  return true;
}

function _cleanup(): void {
  _isRunning     = false;
  _currentReject = null;
  _workerInstance = null;
}
