import { Task, TaskAfterConstraint } from '../types/models.js';
import { tasks, editingTaskIndex, setEditingTaskIndex, removeTaskReferences } from '../state/tasks.js';
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
import { saveTasks, generateTaskId } from '../services/storage.js';
import { renderFragmentation } from './taskFragmentation.js';

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

let _pendingAfterConstraints: TaskAfterConstraint[] = [];

// ─── After constraints UI ──────────────────────────────────────────────────

function renderAfterConstraints(): void {
  const container = document.getElementById('afterConstraintsContainer')!;

  // Tâches référençables : toutes sauf la tâche en cours d'édition
  const referenceable = tasks.filter((_, i) => i !== editingTaskIndex);

  if (referenceable.length === 0) {
    container.innerHTML = '<p style="font-size:12px;color:var(--muted);margin:0;">Aucune autre tâche disponible.</p>';
    return;
  }

  const constraints = _pendingAfterConstraints;
  let html = '';

  constraints.forEach((constraint, idx) => {
    const days  = Math.floor(constraint.delayMinutes / (60 * 24));
    const hours = Math.floor((constraint.delayMinutes % (60 * 24)) / 60);
    const mins  = constraint.delayMinutes % 60;

    html += `
      <div class="after-constraint-item" data-idx="${idx}" style="background:rgba(255,255,255,0.04);border-radius:8px;padding:10px;margin-bottom:8px;display:flex;flex-direction:column;gap:8px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-size:13px;color:var(--muted);flex-shrink:0;">Après :</span>
          <select class="after-task-select" data-idx="${idx}" style="flex:1;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:6px;padding:6px;color:#e6eef8;font-size:13px;">
            ${referenceable.map(t => `<option value="${t.id}" ${t.id === constraint.taskId ? 'selected' : ''}>${t.name}</option>`).join('')}
          </select>
          <button class="btn-danger after-constraint-delete" data-idx="${idx}" style="padding:4px 10px;font-size:14px;flex-shrink:0;">×</button>
        </div>
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
          <span style="font-size:12px;color:var(--muted);">Délai :</span>
          <input type="number" class="after-delay-days" data-idx="${idx}" value="${days}" min="0" style="width:52px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.1);border-radius:4px;padding:4px 6px;color:#e6eef8;font-size:13px;text-align:center;">
          <span style="font-size:12px;color:var(--muted);">j</span>
          <input type="number" class="after-delay-hours" data-idx="${idx}" value="${hours}" min="0" max="23" style="width:52px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.1);border-radius:4px;padding:4px 6px;color:#e6eef8;font-size:13px;text-align:center;">
          <span style="font-size:12px;color:var(--muted);">h</span>
          <input type="number" class="after-delay-mins" data-idx="${idx}" value="${mins}" min="0" max="59" step="5" style="width:52px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.1);border-radius:4px;padding:4px 6px;color:#e6eef8;font-size:13px;text-align:center;">
          <span style="font-size:12px;color:var(--muted);">min</span>
        </div>
      </div>
    `;
  });

  html += `<button class="btn-secondary" id="addAfterConstraintBtn" style="width:100%;margin-top:4px;">+ Ajouter une dépendance</button>`;
  container.innerHTML = html;

  // Events — lire/écrire dans _pendingAfterConstraints
  container.querySelectorAll<HTMLSelectElement>('.after-task-select').forEach(sel => {
    sel.addEventListener('change', () => {
      const idx = parseInt(sel.dataset.idx!);
      _pendingAfterConstraints[idx].taskId = sel.value;
    });
  });

  container.querySelectorAll<HTMLInputElement>('.after-delay-days, .after-delay-hours, .after-delay-mins').forEach(inp => {
    inp.addEventListener('change', () => {
      const idx = parseInt(inp.dataset.idx!);
      const row = container.querySelector<HTMLElement>(`.after-constraint-item[data-idx="${idx}"]`)!;
      const d = parseInt(row.querySelector<HTMLInputElement>('.after-delay-days')!.value) || 0;
      const h = parseInt(row.querySelector<HTMLInputElement>('.after-delay-hours')!.value) || 0;
      const m = parseInt(row.querySelector<HTMLInputElement>('.after-delay-mins')!.value) || 0;
      _pendingAfterConstraints[idx].delayMinutes = d * 24 * 60 + h * 60 + m;
    });
  });

  container.querySelectorAll<HTMLButtonElement>('.after-constraint-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx!);
      _pendingAfterConstraints.splice(idx, 1);
      renderAfterConstraints();
    });
  });

  document.getElementById('addAfterConstraintBtn')?.addEventListener('click', () => {
    const ref = referenceable[0];
    if (!ref) return;
    _pendingAfterConstraints.push({ taskId: ref.id, delayMinutes: 0 });
    renderAfterConstraints();
  });
}

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
    _pendingAfterConstraints = task.afterConstraints ? [...task.afterConstraints] : [];

    taskEditorTitle.textContent = 'Edit task';
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
    _pendingAfterConstraints = [];
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
  renderAfterConstraints();
  taskEditor.classList.add('open');
  updateFloatingButtonVisibility();
}

export function closeTaskEditorFunc(): void {
  taskEditor.classList.remove('open');
  setEditingTaskIndex(-1);
  _pendingAfterConstraints = [];
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

  // Conserver l'id existant ou en générer un nouveau
  const id = editingTaskIndex >= 0 ? (tasks[editingTaskIndex].id || generateTaskId()) : generateTaskId();

  // Conserver les afterConstraints éditées en live sur l'objet tasks[i]
  const afterConstraints = _pendingAfterConstraints.length > 0 ? [..._pendingAfterConstraints] : undefined;

  const task: Task = { id, name, duration, type, bornline, deadline, done: taskDoneStatus, doneAt: taskDoneAt };
  if (afterConstraints && afterConstraints.length > 0) task.afterConstraints = afterConstraints;

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

  // Supprimer les références à cette tâche dans les autres tâches
  removeTaskReferences(taskToDelete.id);

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