import { Task } from '../types/models.js';
import { tasks, editingTaskIndex, setEditingTaskIndex } from '../state/tasks.js';
import { completions, removeTaskFromCompletions } from '../state/completions.js';
import { taskTypes } from '../config/taskTypes.js';
import { MIN_FRAGMENT_DURATION } from '../types/constants.js';
import { formatDateForInput } from '../utils/date.js';
import { renderGrid } from './grid.js';
import { openTaskPanel } from './layout.js';
import { updateFloatingButtonVisibility } from './layout.js';
import { renderTaskList, updatePlacementButtonsState } from './taskPanel.js';
import { currentEditingSlot } from '../state/store.js';
import { updateSlotInfo } from './slotMenu.js';
import { canEditData } from '../algo/runAlgo.js';
import { saveTasks } from '../services/storage.js';
import { renderFragmentation } from './taskFragmentation.js';

// ─── DOM refs ──────────────────────────────────────────────────────────────
const taskEditor      = document.getElementById('taskEditor')!;
const taskEditorTitle = document.getElementById('taskEditorTitle')!;
const taskNameInput   = document.getElementById('taskName') as HTMLInputElement;
const taskDuration    = document.getElementById('taskDuration') as HTMLInputElement;
const taskTypeSelect  = document.getElementById('taskType') as HTMLSelectElement;
const saveTaskBtn     = document.getElementById('saveTaskBtn')!;
const cancelTaskBtn   = document.getElementById('cancelTaskBtn')!;
const deleteTaskBtnEl = document.getElementById('deleteTaskBtn')!;
const closeTaskEditorBtn = document.getElementById('closeTaskEditor')!;
const taskBornline    = document.getElementById('taskBornline') as HTMLInputElement;
const taskBornlineTime = document.getElementById('taskBornlineTime') as HTMLInputElement;
const taskDeadline    = document.getElementById('taskDeadline') as HTMLInputElement;
const taskDeadlineTime = document.getElementById('taskDeadlineTime') as HTMLInputElement;
const toggleBornlineBtn = document.getElementById('toggleBornlineBtn')!;
const toggleDeadlineBtn = document.getElementById('toggleDeadlineBtn')!;
const toggleDoneBtn   = document.getElementById('toggleDoneBtn')!;

let taskDoneStatus = false;
let taskDoneAt: number | null = null;

// ─── Init select ───────────────────────────────────────────────────────────

export function initTaskTypes(): void {
  taskTypeSelect.innerHTML = '';
  for (const type of taskTypes) {
    const opt = document.createElement('option');
    opt.value = type.name;
    opt.textContent = type.name;
    taskTypeSelect.appendChild(opt);
  }
}

// ─── Open / close ──────────────────────────────────────────────────────────

export function openTaskEditor(taskIndex = -1): void {
  if (!canEditData()) return;
  setEditingTaskIndex(taskIndex);

  if (taskIndex >= 0) {
    const task = tasks[taskIndex];
    taskEditorTitle.textContent = 'Modifier la tâche';
    taskNameInput.value  = task.name;
    taskDuration.value   = String(task.duration);
    taskTypeSelect.value = task.type;

    if (task.bornline) {
      const [date, time] = task.bornline.split('T');
      taskBornline.value = date;
      taskBornlineTime.value = time ?? '00:00';
      _setBornlineEnabled(true);
    } else {
      _setBornlineEnabled(false);
    }

    if (task.deadline) {
      const [date, time] = task.deadline.split('T');
      taskDeadline.value = date;
      taskDeadlineTime.value = time ?? '23:59';
      _setDeadlineEnabled(true);
    } else {
      _setDeadlineEnabled(false);
    }

    deleteTaskBtnEl.style.display = 'block';
    toggleDoneBtn.style.display   = 'block';
    taskDoneStatus = task.done;
    taskDoneAt     = task.done ? (task.doneAt ?? null) : null;

    if (task.done) {
      toggleDoneBtn.textContent = 'Marquer comme non fait';
      toggleDoneBtn.classList.replace('btn-secondary', 'btn-primary');
    } else {
      toggleDoneBtn.textContent = 'Marquer comme fait';
      toggleDoneBtn.classList.replace('btn-primary', 'btn-secondary');
    }
  } else {
    taskEditorTitle.textContent  = 'Nouvelle tâche';
    taskNameInput.value  = '';
    taskDuration.value   = '60';
    taskTypeSelect.value = taskTypes[0]?.name ?? '';
    _setBornlineEnabled(false);
    _setDeadlineEnabled(false);
    deleteTaskBtnEl.style.display = 'none';
    toggleDoneBtn.style.display   = 'none';
    taskDoneStatus = false;
    taskDoneAt     = null;
  }

  renderFragmentation();
  taskEditor.classList.add('open');
  updateFloatingButtonVisibility();
}

export function closeTaskEditorFunc(): void {
  taskEditor.classList.remove('open');
  setEditingTaskIndex(-1);
  setTimeout(() => openTaskPanel(), 100);
}

// ─── Save / delete ─────────────────────────────────────────────────────────

export function saveTask(): void {
  if (!canEditData()) return;

  const name     = taskNameInput.value.trim();
  const duration = parseInt(taskDuration.value);
  const type     = taskTypeSelect.value;

  if (!name || !duration || duration < MIN_FRAGMENT_DURATION) {
    alert('Veuillez remplir tous les champs correctement');
    return;
  }

  let bornline: string | null = null;
  let deadline: string | null = null;

  if (!taskBornline.disabled && taskBornline.value) {
    bornline = `${taskBornline.value}T${taskBornlineTime.value || '00:00'}`;
  }
  if (!taskDeadline.disabled && taskDeadline.value) {
    deadline = `${taskDeadline.value}T${taskDeadlineTime.value || '23:59'}`;
  }

  if (bornline && deadline && bornline >= deadline) {
    alert('La date de début (bornline) doit être strictement avant la date de fin (deadline)');
    return;
  }

  const task: Task = { name, duration, type, bornline, deadline, done: taskDoneStatus, doneAt: taskDoneAt };

  // Carry over and adjust fragmentation
  if (editingTaskIndex >= 0 && tasks[editingTaskIndex].fragmentation) {
    const fragments = [...tasks[editingTaskIndex].fragmentation!];
    let sum = fragments.reduce((a, b) => a + b, 0);

    if (sum < duration) {
      fragments[fragments.length - 1] += duration - sum;
      task.fragmentation = fragments;
    } else if (sum > duration) {
      while (sum > duration && fragments.length > 0) {
        const li = fragments.length - 1;
        const excess = sum - duration;
        if (fragments[li] > excess) {
          fragments[li] -= excess;
          if (fragments[li] < 15) fragments.splice(li, 1);
          break;
        } else {
          sum -= fragments[li];
          fragments.splice(li, 1);
        }
      }
      if (fragments.length > 1) task.fragmentation = fragments;
    } else {
      task.fragmentation = fragments;
    }
  }

  if (editingTaskIndex >= 0) {
    tasks[editingTaskIndex] = task;
  } else {
    tasks.push(task);
  }

  renderTaskList();
  closeTaskEditorFunc();
  saveTasks();
}

export function deleteTask(): void {
  if (!canEditData()) return;
  if (editingTaskIndex < 0) return;

  const taskToDelete = tasks[editingTaskIndex];
  tasks.splice(editingTaskIndex, 1);
  removeTaskFromCompletions(taskToDelete);

  renderTaskList();
  renderGrid();

  if (currentEditingSlot) {
    const slotMenuEl = document.getElementById('sideMenu')!;
    if (slotMenuEl.classList.contains('open')) updateSlotInfo(currentEditingSlot);
  }

  updatePlacementButtonsState();
  closeTaskEditorFunc();
  saveTasks();
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function _setBornlineEnabled(enabled: boolean): void {
  taskBornline.disabled     = !enabled;
  taskBornlineTime.disabled = !enabled;
  if (!enabled) { taskBornline.value = ''; taskBornlineTime.value = ''; }
  toggleBornlineBtn.textContent = enabled ? 'Désactiver' : 'Activer';
  if (enabled) {
    toggleBornlineBtn.classList.replace('btn-secondary', 'btn-primary');
  } else {
    toggleBornlineBtn.classList.replace('btn-primary', 'btn-secondary');
  }
}

function _setDeadlineEnabled(enabled: boolean): void {
  taskDeadline.disabled     = !enabled;
  taskDeadlineTime.disabled = !enabled;
  if (!enabled) { taskDeadline.value = ''; taskDeadlineTime.value = ''; }
  toggleDeadlineBtn.textContent = enabled ? 'Désactiver' : 'Activer';
  if (enabled) {
    toggleDeadlineBtn.classList.replace('btn-secondary', 'btn-primary');
  } else {
    toggleDeadlineBtn.classList.replace('btn-primary', 'btn-secondary');
  }
}

// ─── Event listeners ───────────────────────────────────────────────────────

closeTaskEditorBtn.addEventListener('click', closeTaskEditorFunc);
cancelTaskBtn.addEventListener('click', closeTaskEditorFunc);
saveTaskBtn.addEventListener('click', saveTask);
deleteTaskBtnEl.addEventListener('click', deleteTask);

toggleBornlineBtn.addEventListener('click', () => {
  if (taskBornline.disabled) {
    _setBornlineEnabled(true);
    taskBornline.value     = formatDateForInput(new Date());
    taskBornlineTime.value = '00:00';
  } else {
    _setBornlineEnabled(false);
  }
});

toggleDeadlineBtn.addEventListener('click', () => {
  if (taskDeadline.disabled) {
    _setDeadlineEnabled(true);
    const d = new Date();
    d.setDate(d.getDate() + 7);
    taskDeadline.value     = formatDateForInput(d);
    taskDeadlineTime.value = '23:59';
  } else {
    _setDeadlineEnabled(false);
  }
});

toggleDoneBtn.addEventListener('click', () => {
  if (editingTaskIndex < 0) return;
  const task = tasks[editingTaskIndex];
  task.done  = !task.done;
  task.doneAt = task.done ? Date.now() : null;
  taskDoneStatus = task.done;
  taskDoneAt     = task.doneAt;
  if (task.done) {
    toggleDoneBtn.textContent = 'Marquer comme non fait';
    toggleDoneBtn.classList.replace('btn-secondary', 'btn-primary');
  } else {
    toggleDoneBtn.textContent = 'Marquer comme fait';
    toggleDoneBtn.classList.replace('btn-primary', 'btn-secondary');
  }
  saveTasks();
  renderTaskList();
});

(document.getElementById('taskDuration') as HTMLInputElement).addEventListener('change', () => {
  if (editingTaskIndex >= 0) renderFragmentation();
});
