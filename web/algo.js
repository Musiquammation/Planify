function runAlgoInWorker(store, tasks, taskTypes, lossOrder = 0.4) {

	// Generate ids
	let slotId = 1;
	Object.keys(store).forEach(dateKey => {
		store[dateKey].forEach(slot => {
			slot.runId = slotId;
			slotId++;
		});
	});

	// Run promise
	return new Promise((resolve, reject) => {
		const worker = new Worker("algoWorker.js");

		worker.onmessage = (event) => {
			const { action, result, error } = event.data;

			if (action === "result") {
				const ouput = new Map();
				for (let line of result) {
					const key = line[0];
					const slotArr = store[key.dateKey];
					if (!slotArr) {
						console.warn("Date not stored");
						continue;
					}

					const slot = slotArr.find(s => s.runId == key.runId);
					if (!slot) {
						console.warn("Slot not found");
						continue;
					}

					ouput.set(slot, line[1]);
				}
				console.log(ouput);

				resolve(ouput); // reconstruit le Map

				worker.terminate();
			} else if (action === "error") {
				reject(new Error(error));
				worker.terminate();
			}
		};

		worker.onerror = (err) => {
			reject(err);
			worker.terminate();
		};

		// Envoi des données au worker
		worker.postMessage({ action: "runAlgo", store, tasks, taskTypes, lossOrder });
	});
}
