/**
 * main.ts — Application entry point.
 * Initialises all modules, loads persisted data, and wires up remaining
 * event listeners that belong to no specific UI sub-module.
 */

import { loadData, saveStore, saveTasks } from './services/storage.js';
import { store, viewDate } from './state/store.js';
import { tasks } from './state/tasks.js';
import { completions, assignTasksToSlots, clearCompletions } from './state/completions.js';
import { taskTypes } from './config/taskTypes.js';
import { isoDateKey } from './utils/date.js';

import { initTimes, renderGrid } from './ui/grid.js';
import { openTutorial } from './ui/openTutorial.js';
import { renderTaskList, updatePlacementButtonsState } from './ui/taskPanel.js';
import { openDay, updateFloatingButtonVisibility, closeSideMenu, closeTaskPanel } from './ui/layout.js';
import { initTaskTypes } from './ui/taskEditor.js';
import { updateSlotInfo } from './ui/slotMenu.js';
import { currentEditingSlot } from './state/store.js';
import { runAlgoInWorker, stopAlgoInWorker, canEditData } from './algo/runAlgo.js';

// Side-effectful modules: importing them registers their event listeners.
import './ui/slotCreation.js';
import './ui/slotDrag.js';
import './ui/slotMenu.js';
import './ui/taskEditor.js';
import './ui/taskPanel.js';
import './ui/executionView.js';
import './ui/timer.js';
import './ui/settings.js';
import './ui/layout.js';
import { initNotifications } from './ui/notifications.js';



const BEACON_ADDRESS = "https://5.51.5.55.sslip.io:8273/planifyUserTracker";

// ─── Algo / placement ──────────────────────────────────────────────────────

const placeTasksBtn           = document.getElementById('placeTasksBtn') as HTMLButtonElement;
const removePlacementTasksBtn = document.getElementById('removePlacementTasksBtn')!;
const algoLoading             = document.getElementById('algoLoading')!;
const cancelAlgoBtn           = document.getElementById('cancelAlgoBtn')!;

async function placeTasks(): Promise<void> {
  placeTasksBtn.disabled = true;
  algoLoading.style.display = 'flex';

  const startTime = Date.now();
  const loadingElapsed = algoLoading.querySelector<HTMLElement>('.loading-elapsed')!;
  const timer = setInterval(() => {
    loadingElapsed.textContent = `Elapsed time : ${((Date.now() - startTime) / 1000).toFixed(1)}s`;
  }, 100);

  try {
    const newCompletions = await runAlgoInWorker(store, tasks, taskTypes);
    clearInterval(timer);

    assignTasksToSlots(newCompletions);

    renderGrid();
    renderTaskList();

    algoLoading.style.display = 'none';
    placeTasksBtn.disabled = false;

    closeSideMenu();
    closeTaskPanel();
    document.getElementById('settingsPanel')!.classList.remove('open');

    removePlacementTasksBtn.classList.remove('hidden');
    placeTasksBtn.classList.add('hidden');
  } catch (error) {
    clearInterval(timer);
    console.error(error);
    algoLoading.style.display = 'none';
    placeTasksBtn.disabled = false;
  }
}

function cancelAlgo(): void {
  if (stopAlgoInWorker()) {
    algoLoading.style.display = 'none';
    placeTasksBtn.disabled = false;
  }
}

placeTasksBtn.addEventListener('click', placeTasks);
cancelAlgoBtn.addEventListener('click', cancelAlgo);


removePlacementTasksBtn.addEventListener('click', () => {
  if (!canEditData()) return;
  clearCompletions();
  renderGrid();
  renderTaskList();
  if (currentEditingSlot && document.getElementById('sideMenu')!.classList.contains('open')) {
    updateSlotInfo(currentEditingSlot);
  }
  updatePlacementButtonsState();
});

// ─── Close panels on outside click ────────────────────────────────────────
// (slotMenu and settingsPanel outside-click is handled in their own modules)

document.addEventListener('click', e => {
  const taskPanelEl = document.getElementById('taskPanel')!;
  if (
    taskPanelEl.classList.contains('open') &&
    !taskPanelEl.contains(e.target as Node) &&
    e.target !== document.getElementById('openTaskPannelBtn')
  ) {
    closeTaskPanel();
    e.stopPropagation();
  }
});

// ─── User tracking ─────────────────────────────────────────────────────────

function sendUserTrack(): void {
  let hash = localStorage.getItem('userTrackHash');
  if (!hash) {
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    hash = [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
    localStorage.setItem('userTrackHash', hash);
    openTutorial();
  }
  navigator.sendBeacon(BEACON_ADDRESS, hash);
}

// ─── Bootstrap ─────────────────────────────────────────────────────────────

loadData();
initTaskTypes();
initTimes();
renderTaskList();
openDay(viewDate);
updateFloatingButtonVisibility();

// Scroll to 8:00
setTimeout(() => {
  const calendarWrap = document.querySelector<HTMLElement>('.calendar-wrap')!;
  const hourHeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--hour-height')) || 60;
  calendarWrap.scrollTop = 8 * hourHeight;
}, 100);

sendUserTrack();
initNotifications();