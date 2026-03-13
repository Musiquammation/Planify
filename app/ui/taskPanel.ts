import { tasks } from '../state/tasks.js';
import { completions } from '../state/completions.js';
import { taskTypes } from '../config/taskTypes.js';
import { minutesToTime } from '../utils/time.js';
import { openTaskEditor } from './taskEditor.js';

const taskList  = document.getElementById('taskList')!;
const taskPanel = document.getElementById('taskPanel')!;
const placeTasksBtn          = document.getElementById('placeTasksBtn')!;
const removePlacementTasksBtn = document.getElementById('removePlacementTasksBtn')!;

// ─── Render ────────────────────────────────────────────────────────────────

export function renderTaskList(): void {
  taskList.innerHTML = '';

  const placedSet = new Set<object>();
  completions.forEach(list => list.forEach(et => placedSet.add(et.reference)));

  const now = new Date();
  const undone: { task: typeof tasks[0]; index: number }[] = [];
  const done:   { task: typeof tasks[0]; index: number }[] = [];

  tasks.forEach((task, index) => {
    (task.done ? done : undone).push({ task, index });
  });

  done.sort((a, b) => (b.task.doneAt ?? 0) - (a.task.doneAt ?? 0));

  const createTaskElement = (task: typeof tasks[0], index: number): HTMLElement => {
    const item = document.createElement('div');
    item.className = 'task-item';
    if (task.done)            item.classList.add('done');
    if (placedSet.has(task))  item.classList.add('placed');

    const typeObj = taskTypes.find(t => t.name === task.type) ?? taskTypes[0];
    item.style.borderLeftColor = typeObj.color;

    const fragmentIcon = task.fragmentation ? '<span class="fragment-icon">F</span>' : '';

    let dateIndicators = '';
    if (task.bornline) {
      const d = new Date(task.bornline);
      if (d > now) {
        const ds = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
        const ts = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        dateIndicators += `<span class="date-indicator bornline-future">📅 ${ds} ${ts}</span>`;
      }
    }
    if (task.deadline) {
      const d = new Date(task.deadline);
      const diff = d.getTime() - now.getTime();
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const ds = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
      const ts = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      if (diff < 0) {
        dateIndicators += `<span class="date-indicator deadline-overdue">⚠️ Échue</span>`;
      } else if (days === 0) {
        dateIndicators += `<span class="date-indicator deadline-today">⏰ ${ts}</span>`;
      } else if (days <= 1) {
        dateIndicators += `<span class="date-indicator deadline-urgent">🔴 ${ds} ${ts}</span>`;
      } else {
        dateIndicators += `<span class="date-indicator deadline-${days <= 3 ? 'soon' : 'normal'}">${days <= 3 ? '🟡' : '🟢'} ${ds} ${ts}</span>`;
      }
    }

    item.innerHTML = `
      <div class="task-name">${task.name} ${fragmentIcon}</div>
      <div class="task-duration">${minutesToTime(task.duration)} (${task.duration} min)</div>
      ${dateIndicators ? '<div class="task-dates">' + dateIndicators + '</div>' : ''}
    `;
    item.onclick = () => openTaskEditor(index);
    return item;
  };

  for (const { task, index } of undone) taskList.appendChild(createTaskElement(task, index));

  if (done.length > 0) {
    const sep = document.createElement('div');
    sep.className = 'task-separator';
    taskList.appendChild(sep);
  }

  for (const { task, index } of done) taskList.appendChild(createTaskElement(task, index));
}

// ─── Placement buttons state ───────────────────────────────────────────────

export function updatePlacementButtonsState(): void {
  const has = completions.size > 0;
  removePlacementTasksBtn.classList.toggle('hidden', !has);
  placeTasksBtn.classList.toggle('hidden', has);
}

// ─── Event listeners ───────────────────────────────────────────────────────

document.getElementById('addTaskBtn')!.addEventListener('click', () => {
  taskPanel.classList.remove('open');
  openTaskEditor();
});
