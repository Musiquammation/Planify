import type { SlotStore, TaskType, ExpandedTask } from '../types/models.js';
import { buildBuffer, buildBufferArgs } from '../algo/buildBuffer.js';

import {Module} from "./algo_module.js"


const modulePromise = Module();

self.onmessage = async (e) => {
	const { id, action } = e.data;
	const module = (await modulePromise) as any;


	switch (action) {
	case 'runAlgo':
	{
		const {inputBuffer, tasks, slots} = e.data;

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
	}
};
