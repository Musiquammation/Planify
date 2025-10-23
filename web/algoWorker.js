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





function toDayNumber(year, month, day) {
	return Math.floor(new Date(year, month - 1, day).getTime() / (1000 * 60 * 60 * 24));
}


function runAlgo(store, tasks, taskTypes) {
	return new Promise(async (resolve, reject) => {
		function buildBuffer(slots, zeroDate) {
			// Calculate total size
			const headerSize = 3 * 4; // 3 int32
			const slotsSize = slots.reduce(
				(acc, slot) => acc + 2 * 4 + taskTypes.length * 1,
				0
			);
			const tasksSize = tasks.length * (4 * 4); // duration + typeIndex + bornline + deadline (4 int32)
	
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
				
				// Bornline (en minutes depuis zeroDate)
				let bornlineMinutes = -0x80000000; // Valeur par défaut si null
				if (task.bornline) {
					const bornlineDate = new Date(task.bornline);
					const bornlineYear = bornlineDate.getFullYear();
					const bornlineMonth = bornlineDate.getMonth() + 1;
					const bornlineDay = bornlineDate.getDate();
					const bornlineHour = bornlineDate.getHours();
					const bornlineMinute = bornlineDate.getMinutes();
					
					const bornlineDayNumber = toDayNumber(bornlineYear, bornlineMonth, bornlineDay);
					const bornlineAbsolute = bornlineDayNumber * 24 * 60 + bornlineHour * 60 + bornlineMinute;
					bornlineMinutes = bornlineAbsolute - zeroDate;
				}
				writeInt(bornlineMinutes);
				
				// Deadline (en minutes depuis zeroDate)
				let deadlineMinutes = 0x7fffffff; // Valeur par défaut si null
				if (task.deadline) {
					const deadlineDate = new Date(task.deadline);
					const deadlineYear = deadlineDate.getFullYear();
					const deadlineMonth = deadlineDate.getMonth() + 1;
					const deadlineDay = deadlineDate.getDate();
					const deadlineHour = deadlineDate.getHours();
					const deadlineMinute = deadlineDate.getMinutes();
					
					const deadlineDayNumber = toDayNumber(deadlineYear, deadlineMonth, deadlineDay);
					const deadlineAbsolute = deadlineDayNumber * 24 * 60 + deadlineHour * 60 + deadlineMinute;
					deadlineMinutes = deadlineAbsolute - zeroDate;
				}
				writeInt(deadlineMinutes);
			}
	
			return buffer;
		}

		// --- Calculer globalMinStart en prenant en compte slots ET tasks ---
		const slots = [];
		let globalMinStart = Infinity;

		const todayOffset = toDayNumber(
			new Date().getFullYear(),
			new Date().getMonth() + 1,
			new Date().getDate()
		);

		// Parcourir les slots pour trouver le min
		Object.keys(store).forEach(dateKey => {
			const [year, month, day] = dateKey.split("-").map(Number);
			const dateOffset = toDayNumber(year, month, day);
			if (dateOffset < todayOffset)
				return;

			store[dateKey].forEach(slot => {
				const globalStart = dateOffset * 24 * 60 + slot.start;
				if (globalStart < globalMinStart) {
					globalMinStart = globalStart;
				}
			});
		});

		// Parcourir les tasks pour trouver la bornline la plus petite
		tasks.forEach(task => {
			if (task.bornline) {
				const bornlineDate = new Date(task.bornline);
				const bornlineYear = bornlineDate.getFullYear();
				const bornlineMonth = bornlineDate.getMonth() + 1;
				const bornlineDay = bornlineDate.getDate();
				const bornlineHour = bornlineDate.getHours();
				const bornlineMinute = bornlineDate.getMinutes();
				
				const bornlineDayNumber = toDayNumber(bornlineYear, bornlineMonth, bornlineDay);
				const bornlineAbsolute = bornlineDayNumber * 24 * 60 + bornlineHour * 60 + bornlineMinute;
				
				if (bornlineAbsolute < globalMinStart) {
					globalMinStart = bornlineAbsolute;
				}
			}
		});

		// Si globalMinStart est toujours Infinity, utiliser aujourd'hui à minuit
		if (globalMinStart === Infinity) {
			globalMinStart = todayOffset * 24 * 60;
		}

		// Construire les slots normalisés
		Object.keys(store).forEach(dateKey => {
			const [year, month, day] = dateKey.split("-").map(Number);
			const dateOffset = toDayNumber(year, month, day);
			if (dateOffset < todayOffset)
				return;

			store[dateKey].forEach(slot => {
				const globalStart = dateOffset * 24 * 60 + slot.start;
				const globalEnd = dateOffset * 24 * 60 + slot.end;
				slots.push({
					taskPreferences: slot.taskPreferences,
					start: globalStart - globalMinStart,
					end: globalEnd - globalMinStart,
					dateKey: dateKey,
				});
			});
		});


		const inputBuffer = buildBuffer(slots, globalMinStart);
		const inputPtr = Module._malloc(inputBuffer.byteLength);
		Module.HEAPU8.set(new Uint8Array(inputBuffer), inputPtr);


		// appel de la fonction C
		const resultPtr = Module._apiRunAlgo(inputPtr, inputBuffer.byteLength);

		// Free
		Module._free(inputPtr);

		
		// Parse result
		const completions = Array.from({ length: slots.length }, () => []);
		for (let task = 0; task < tasks.length; task++) {
			const pos = Module.getValue(resultPtr + 4*task, "i32");
			if (pos >= 0) {
				completions[pos].push(task);
			}
		}		

		// Free
		Module._free(resultPtr);


		// Resolve
		resolve(completions);
	});
}
