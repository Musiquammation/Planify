import { Slot, ExpandedTask } from '../types/models.js';
import { completions } from '../state/completions.js';
import { minutesToTime } from '../utils/time.js';
import { updateFloatingButtonVisibility } from './layout.js';
import { renderGrid } from './grid.js';
import { renderTaskList } from './taskPanel.js';
import { startTimer, stopTimer } from './timer.js';
import { saveTasks, saveStore } from '../services/storage.js';

// ─── DOM refs ──────────────────────────────────────────────────────────────
const executionView     = document.getElementById('executionView')!;
const closeExecutionBtn = document.getElementById('closeExecutionBtn')!;
const nextTaskBtn       = document.getElementById('nextTaskBtn')!;
const executionSlotName = document.getElementById('executionSlotName')!;
const executionSlotTime = document.getElementById('executionSlotTime')!;
const taskCounter       = document.getElementById('taskCounter')!;
const currentTaskName   = document.getElementById('currentTaskName')!;
const executionTasksList = document.getElementById('executionTasksList')!;

// ─── State ─────────────────────────────────────────────────────────────────
let currentExecutingSlot: Slot | null = null;
let executionTasks: ExpandedTask[]    = [];
let currentTaskIndex = 0;

// ─── Public API ────────────────────────────────────────────────────────────

export function startExecution(slot: Slot): void {
  const tasksInSlot = completions.get(slot) ?? [];
  if (tasksInSlot.length === 0) {
    alert('No tasks assigned to this slot');
    return;
  }

  currentExecutingSlot = slot;
  executionTasks       = [...tasksInSlot];
  currentTaskIndex     = 0;

  executionView.classList.add('open');
  document.getElementById('sideMenu')!.classList.remove('open');
  updateFloatingButtonVisibility();

  executionSlotName.textContent = slot.name ?? 'Slot';
  executionSlotTime.textContent = `${minutesToTime(slot.start)} — ${minutesToTime(slot.end)}`;

  _renderTasksList();
  _startNextTask();
}

export function closeExecution(): void {
  stopTimer();
  executionView.classList.remove('open');
  document.getElementById('sideMenu')!.classList.remove('open');
  currentExecutingSlot = null;
  executionTasks       = [];
  currentTaskIndex     = 0;
  updateFloatingButtonVisibility();
}

// ─── Internal ──────────────────────────────────────────────────────────────

function _startNextTask(): void {
  if (currentTaskIndex >= executionTasks.length) {
    _completeExecution();
    return;
  }

  const task = executionTasks[currentTaskIndex];
  taskCounter.textContent   = `Task ${currentTaskIndex + 1}/${executionTasks.length}`;
  currentTaskName.textContent = task.name ?? 'Untitled task';

  startTimer(task.duration * 60, _moveToNextTask);
  _renderTasksList();
}

function _moveToNextTask(): void {
  const task = executionTasks[currentTaskIndex];
  if (task.reference && !task.reference.done) {
    task.reference.done  = true;
    task.reference.doneAt = Date.now();
  }
  currentTaskIndex++;
  stopTimer();
  _startNextTask();
}

function _completeExecution(): void {
  stopTimer();
  if (currentExecutingSlot) {
    currentExecutingSlot.done  = true;
    currentExecutingSlot.doneAt = Date.now();
  }
  saveTasks();
  saveStore();
  closeExecution();
  renderGrid();
  renderTaskList();
}

function _renderTasksList(): void {
  executionTasksList.innerHTML = '';
  executionTasks.forEach((task, index) => {
    const el = document.createElement('div');
    el.className = 'execution-task-item';
    if (index < currentTaskIndex) el.classList.add('done');
    else if (index === currentTaskIndex) el.classList.add('current');
    el.innerHTML = `
      <div class="execution-task-name">${task.name}</div>
      <div class="execution-task-duration">${task.duration} minutes</div>
    `;
    executionTasksList.appendChild(el);
  });
}

// ─── Event listeners ───────────────────────────────────────────────────────

closeExecutionBtn.addEventListener('click', e => { e.stopPropagation(); closeExecution(); });
nextTaskBtn.addEventListener('click', _moveToNextTask);
