let workerInstance = null;
let currentReject = null;
window.isRunningAlgo = false;


function toDayNumber(year, month, day) {
	return Math.floor(new Date(year, month - 1, day).getTime() / (1000 * 60 * 60 * 24));
}

function runAlgoInWorker(store, tasks, taskTypes) {
	if (window.isRunningAlgo) {
		return Promise.reject(new Error("Already running algo"));
	}

	// Generate slots
	const todayOffset = toDayNumber(
		new Date().getFullYear(),
		new Date().getMonth() + 1,
		new Date().getDate()
	);

	const slots = [];
	Object.keys(store).forEach(dateKey => {
		const [year, month, day] = dateKey.split("-").map(Number);
		const dateOffset = toDayNumber(year, month, day);
		if (dateOffset < todayOffset)
			return;
		
		store[dateKey].forEach(slot => {
			slots.push(slot);
		});
	});

	return new Promise((resolve, reject) => {
		window.isRunningAlgo = true;
		currentReject = reject;

		const worker = new Worker("algoWorker.js");
		workerInstance = worker;

		worker.onmessage = (event) => {
			const { action, result, error } = event.data;

			if (action === "result") {
				const ouput = new Map();
				for (let s = 0; s < result.length; s++) {
					ouput.set(slots[s], result[s].map(i => tasks[i]));
				}

				window.isRunningAlgo = false;
				currentReject = null;
				worker.terminate();
				workerInstance = null;
				resolve(ouput);
			} else if (action === "error") {
				window.isRunningAlgo = false;
				currentReject = null;
				worker.terminate();
				workerInstance = null;
				reject(new Error(error));
			}
		};

		worker.onerror = (err) => {
			window.isRunningAlgo = false;
			currentReject = null;
			worker.terminate();
			workerInstance = null;
			reject(err);
		};

		worker.postMessage({ action: "runAlgo", store, tasks, taskTypes });
	});
}

function stopAlgoInWorker() {
	if (!window.isRunningAlgo) return;

	if (workerInstance) {
		workerInstance.terminate();
		workerInstance = null;
	}

	if (currentReject) {
		currentReject(new Error("Stopped"));
		currentReject = null;
	}

	window.isRunningAlgo = false;
}
