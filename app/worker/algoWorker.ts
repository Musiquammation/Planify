/**
 * Web Worker that wraps the WASM algorithm module.
 *
 * Expected message:  { action: "runAlgo", store, tasks, taskTypes }
 * Response message:  { action: "result", result: number[][] }
 *                 or { action: "error",  error: string }
 */

// WASM module is injected via importScripts in the worker environment.
declare const Module: any;

importScripts('algo_module.js');

import type { SlotStore, Task, TaskType, ExpandedTask } from '../types/models.js';
import { toDayNumber } from '../utils/date.js';
import { buildBuffer, NormalizedSlot } from './buildBuffer.js';

// Wait for the WASM runtime to be ready before processing messages
let moduleReady = false;
const pendingMessages: MessageEvent[] = [];

Module.onRuntimeInitialized = () => {
  moduleReady = true;
  for (const msg of pendingMessages) handleMessage(msg);
  pendingMessages.length = 0;
};

self.onmessage = (event: MessageEvent) => {
  if (!moduleReady) {
    pendingMessages.push(event);
  } else {
    handleMessage(event);
  }
};

// ─── Message handler ───────────────────────────────────────────────────────

async function handleMessage(event: MessageEvent): Promise<void> {
  const { action, store, tasks, taskTypes } = event.data as {
    action: string;
    store: SlotStore;
    tasks: ExpandedTask[];
    taskTypes: TaskType[];
  };

  if (action !== 'runAlgo') return;

  try {
    const result = await runAlgo(store, tasks, taskTypes);
    (self as any).postMessage({ action: 'result', result });
  } catch (err: any) {
    (self as any).postMessage({ action: 'error', error: err.message });
  }
}

// ─── Core algorithm runner ─────────────────────────────────────────────────

function runAlgo(
  store: SlotStore,
  tasks: ExpandedTask[],
  taskTypes: TaskType[],
): Promise<number[][]> {
  return new Promise((resolve, reject) => {
    try {
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

      const inputBuffer = buildBuffer(slots, tasks, taskTypes, globalMinStart);

      // Allocate WASM memory and call the algorithm
      const inputPtr = Module._malloc(inputBuffer.byteLength);
      Module.HEAPU8.set(new Uint8Array(inputBuffer), inputPtr);
      const resultPtr = Module._apiRunAlgo(inputPtr, inputBuffer.byteLength);
      Module._free(inputPtr);

      // Parse results: resultPtr[task] = slotIndex (-1 = unplaced)
      const completions: number[][] = Array.from({ length: slots.length }, () => []);
      for (let t = 0; t < tasks.length; t++) {
        const pos = Module.getValue(resultPtr + 4 * t, 'i32');
        if (pos >= 0) completions[pos].push(t);
      }
      Module._free(resultPtr);

      resolve(completions);
    } catch (err) {
      reject(err);
    }
  });
}
