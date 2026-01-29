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

	const date = new Date();

	const todayOffset = toDayNumber(
		date.getFullYear(),
		date.getMonth() + 1,
		date.getDate()
	);

	const nowMinutes = date.getHours() * 60 + date.getMinutes();

	const slots = [];

	Object.keys(store).forEach(dateKey => {
		const [year, month, day] = dateKey.split("-").map(Number);
		const dateOffset = toDayNumber(year, month, day);

		if (dateOffset < todayOffset)
			return;

		store[dateKey].forEach(slot => {
			if (dateOffset === todayOffset) {
				if (slot.start < nowMinutes)
					return;
			}

			slots.push(slot);
		});
	});


	const expandedTasks = [];
	tasks.forEach(task => {
		if (task.done)
			return;

		if (!task.fragmentation || task.fragmentation.length === 0) {
			// Without fragmentation
			expandedTasks.push({
				...task,
				reference: task,
				fragmentation: -1
			});
		} else {
			// With fragmentation
			const n = task.fragmentation.length;
			task.fragmentation.forEach((fragmentDuration, i) => {
				expandedTasks.push({
					...task,
					name: `${task.name} (${i + 1}/${n})`,
					duration: fragmentDuration,
					reference: task,
					fragmentation: i
				});
			});
		}
	});

	return new Promise((resolve, reject) => {
		window.isRunningAlgo = true;
		currentReject = reject;

		const worker = new Worker("algoWorker.js");
		workerInstance = worker;

		worker.onmessage = (event) => {
			const { action, result, error } = event.data;

			if (action === "result") {
				const output = new Map();
				for (let s = 0; s < result.length; s++) {
					output.set(slots[s], result[s].map(i => expandedTasks[i]));
				}

				window.isRunningAlgo = false;
				currentReject = null;
				worker.terminate();
				workerInstance = null;
				resolve(output);
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

		worker.postMessage({ action: "runAlgo", store, tasks: expandedTasks, taskTypes });
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
