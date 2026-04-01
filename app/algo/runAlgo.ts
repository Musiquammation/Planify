import { buildBuffer, buildBufferArgs } from './buildBuffer.js';
import { Slot, ExpandedTask, SlotStore } from '../types/models.js';
import { TaskType } from '../types/models.js';
import { store, viewDate } from '../state/store.js';
import { tasks, expandTasks } from '../state/tasks.js';
import { taskTypes } from '../config/taskTypes.js';
import { toDayNumber, isoDateKey } from '../utils/date.js';


let nextId = 0;
const pending = new Map<number, (data:any)=>void>();

const worker = new Worker('./algoWorker.js', { type: 'module' });

worker.onmessage = (e) => {
  const data = e.data;
  const fn = pending.get(data.id);
  if (fn) {
	fn(data);
  }
  pending.delete(data.id);
};


export async function runAlgoInWorker(
	storeData: SlotStore,
	taskList: typeof tasks,
	types: TaskType[],
) {
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
	const {slots, globalMinStart} = buildBufferArgs(store, expandedTasks);
	const inputBuffer = buildBuffer(slots, tasks, taskTypes, globalMinStart);


	const data = await new Promise((resolve: (data: any)=>void) => {
		const id = nextId++;
		pending.set(id, resolve);
		worker.postMessage({
			id,
			action: 'runAlgo',
			inputBuffer,
			tasks,
			slots
		});
	});


	const output = new Map<Slot, ExpandedTask[]>();
	for (let s = 0; s < data.completions.length; s++) {
		output.set(futureSlots[s], (data.completions[s] as number[]).map(i => expandedTasks[i]));
	}

	return output;
}

export function stopAlgoInWorker(): boolean {
	return true;
}


export function canEditData() {
	return pending.size === 0;
}