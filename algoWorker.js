// worker.js
importScripts("algo_module.js"); // génère la variable globale Module

let modulePromiseResolve = null;
const modulePromise = new Promise(resolve => {modulePromiseResolve = resolve;});



self.onmessage = async (event) => {
	await modulePromise;

	const { action, store, tasks, taskTypes, lossOrder } = event.data;

	if (action === "runAlgo") {
		try {
			const completions = await runAlgo(store, tasks, taskTypes, lossOrder);
			// Map → Array pour pouvoir passer en postMessage
			self.postMessage({ action: "result", result: completions });
		} catch (err) {
			self.postMessage({ action: "error", error: err.message });
		}
	}
};

Module.onRuntimeInitialized = () => {
	modulePromiseResolve();
};






function runAlgo(store, tasks, taskTypes, lossOrder) {
	return new Promise(async (resolve, reject) => {
		function buildBuffer(slots) {
			// Calculate total size
			const headerSize = 3 * 4; // 3 int32
			const slotsSize = slots.reduce(
				(acc, slot) => acc + 2 * 4 + taskTypes.length * 1,
				0
			);
			const tasksSize = tasks.length * (2 * 4); // duration + typeIndex
	
			const totalSize = headerSize + slotsSize + tasksSize;
			const buffer = new ArrayBuffer(totalSize);
			const view = new DataView(buffer);
			let offset = 0;
	
			// helpers
			const writeInt = (val) => {
				view.setInt32(offset, val, true);
				offset += 4;
			};
			const writeByte = (val) => {
				view.setUint8(offset, val);
				offset += 1;
			};
	
			// ---- header ----
			writeInt(tasks.length);
			writeInt(slots.length);
			writeInt(taskTypes.length);
	
			// ---- slots ----
			for (const slot of slots) {
				writeInt(slot.start);
				writeInt(slot.end - slot.start); // duration
	
				for (const type of taskTypes) {
					const pref = slot.taskPreferences[type.name] ?? 0;
					const scaled = Math.max(
						0,
						Math.min(250, Math.round(pref * 250))
					);
					writeByte(scaled);
				}
			}
	
			// ---- tasks ----
			for (const task of tasks) {
				writeInt(task.duration);
	
				const typeIndex = taskTypes.findIndex((t) => t.name === task.type);
				if (typeIndex === -1) {
					throw new Error(`Unknown task type: ${task.type}`);
				}
				writeInt(typeIndex);
			}
	
			return buffer;
		}

		// --- Build input buffer ---
		const slots = [];
		let globalMinStart = Infinity;

		Object.keys(store).forEach(dateKey => {
			const [year, month, day] = dateKey.split("-").map(Number);
			const dateOffset = new Date(year, month - 1, day).getTime() / (1000 * 60 * 60 * 24);
			store[dateKey].forEach(slot => {
				const globalStart = dateOffset * 24 * 60 + slot.start;
				if (globalStart < globalMinStart) {
					globalMinStart = globalStart;
				}
			});
		});

		Object.keys(store).forEach(dateKey => {
			const [year, month, day] = dateKey.split("-").map(Number);
			const dateOffset = new Date(year, month - 1, day).getTime() / (1000 * 60 * 60 * 24);
			store[dateKey].forEach(slot => {
				const globalStart = dateOffset * 24 * 60 + slot.start;
				const globalEnd = dateOffset * 24 * 60 + slot.end;
				slots.push({
					taskPreferences: slot.taskPreferences,
					start: globalStart - globalMinStart,
					end: globalEnd - globalMinStart,
					dateKey: dateKey,
					runId: slot.runId
				});
			});
		});


		const inputBuffer = buildBuffer(slots);
		const inputPtr = Module._malloc(inputBuffer.byteLength);
		Module.HEAPU8.set(new Uint8Array(inputBuffer), inputPtr);

		const outputPtr = Module._malloc(4);

		// appel de la fonction C
		const resultPtr = Module._apiRunAlgo(inputPtr, inputBuffer.byteLength, lossOrder, outputPtr);

		// lecture de outputPositions
		const branchListSize = Module.getValue(outputPtr, "i32");

		// Free
		Module._free(inputPtr);
		Module._free(outputPtr);

		
		// Parse result
		const completions = new Array(slots.length);
		const slotPtr = resultPtr;
		const lostTaskPtr = resultPtr + branchListSize;
		for (let s = 0; s < slots.length; s++) {
			const list = [];

			for (let t = 0; t < tasks.length; t++) {
				
				if (
					Module.HEAPU8[lostTaskPtr + t] == 0 &&
					Module.getValue(slotPtr + 8*t, "i32") == s
				) {
					list.push(t);
				}
			}

			completions[s] = {runId: slots[s].runId, dateKey: slots[s].dateKey, list};
		}


		

		// Free
		Module._free(resultPtr);

		// Resolve
		resolve(completions);
	});
}
