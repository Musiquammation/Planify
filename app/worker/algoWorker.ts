import type { SlotStore, TaskType, ExpandedTask } from '../types/models.js';
import { buildBuffer, buildBufferArgs } from '../buildBuffer.js';

import {Module} from "./algo_module.js"

const modulePromise = Module();

let interruptPtr: any = null;

async function getInterruptor() {
	const module = (await modulePromise) as any;

	if (interruptPtr)
		return interruptPtr;

	interruptPtr = module._malloc(4);
	module.setValue(interruptPtr, 0, 'i32');
	module._apiSetInterruptPtr(interruptPtr);
	return interruptPtr;
}

self.onmessage = async (e) => {
	const { id, action } = e.data;
	console.log(action);
	const module = (await modulePromise) as any;


	switch (action) {
	case 'getInterruptor':
	{
		const i = await getInterruptor();
		self.postMessage({
			id: e.data.id,
			action: 'getInterruptor',
			buffer: module.HEAP32.buffer,
			interruptPtr: i
		});
		break;
	}

	case 'runAlgo':
	{
		const {inputBuffer, tasks, slots} = e.data;
		const i = await getInterruptor();
		module.setValue(i, 0, 'i32');

		// Allocate WASM memory and call the algorithm
		const inputPtr = module._malloc(inputBuffer.byteLength);
		module.HEAPU8.set(new Uint8Array(inputBuffer), inputPtr);
		const resultPtr = module._apiRunAlgo(inputPtr, inputBuffer.byteLength);
		module._free(inputPtr);
	
		// Parse results: resultPtr[task] = slotIndex (-1 = unplaced)
		const completions: number[][] = Array.from({ length: slots.length }, () => []);
		for (let t = 0; t < tasks.length; t++) {
			const pos = module.getValue(resultPtr + 4 * t, 'i32');
			if (pos >= 0) completions[pos].push(t);
		}
		module._free(resultPtr);
	
		self.postMessage({ id, completions, action: 'runAlgo' });
		break;
	}

	default:
		throw new Error("Invalid action: " + action);
	}
};
