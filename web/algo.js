let workerInstance = null;
let currentReject = null;
window.isRunningAlgo = false;


function runAlgoInWorker(store, tasks, taskTypes, lossOrder) {
    if (window.isRunningAlgo) {
        return Promise.reject(new Error("Already running algo"));
    }

    // Generate ids
    let slotId = 1;
    Object.keys(store).forEach(dateKey => {
        store[dateKey].forEach(slot => {
            slot.runId = slotId;
            slotId++;
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
                for (let line of result) {
                    const slotArr = store[line.dateKey];
                    if (!slotArr) {
                        console.warn("Date not stored");
                        continue;
                    }

                    const slot = slotArr.find(s => s.runId == line.runId);
                    if (!slot) {
                        console.warn("Slot not found");
                        continue;
                    }

                    ouput.set(slot, line.list.map(t => tasks[t]));
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

        worker.postMessage({ action: "runAlgo", store, tasks, taskTypes, lossOrder });
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
