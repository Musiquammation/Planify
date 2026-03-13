import { Slot } from '../types/models.js';
import { store, viewDate } from '../state/store.js';
import { completions } from '../state/completions.js';
import { taskTypes } from '../config/taskTypes.js';
import { isoDateKey } from '../utils/date.js';
import { minutesToTime } from '../utils/time.js';
import { getSlotColor } from '../utils/slotColor.js';
import { startSlotDrag } from './slotDrag.js';

const hourHeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--hour-height')) || 60;
const slotLayer  = document.getElementById('slotLayer')!;
const timesCol   = document.getElementById('timesCol')!;

// ─── Times column ──────────────────────────────────────────────────────────

export function initTimes(): void {
  if (timesCol.children.length) return;
  for (let h = 0; h < 24; h++) {
    const div = document.createElement('div');
    div.className = 'hour';
    div.textContent = String(h % 24).padStart(2, '0') + ':00';
    timesCol.appendChild(div);
  }
}

// ─── Grid render ──────────────────────────────────────────────────────────

export function renderGrid(): void {
  slotLayer.innerHTML = '';
  const key = isoDateKey(viewDate);
  const daySlots = store[key] ?? [];

  for (const slot of daySlots) {
    const el = document.createElement('div');
    el.className = 'slot';
    el.dataset.start = String(slot.start);
    el.dataset.end   = String(slot.end);

    el.style.top    = `${slot.start / 60 * hourHeight + 6}px`;
    el.style.height = `${Math.max(28, (slot.end - slot.start) / 60 * hourHeight - 6)}px`;
    el.style.left   = '6px';
    el.style.right  = '6px';
    el.style.cursor = 'pointer';

    const slotColor = getSlotColor(slot, taskTypes);
    if (slot.done) {
      const doneColor = '#10b981';
      el.style.borderLeftColor = doneColor;
      el.style.background = `linear-gradient(90deg, ${doneColor}30, ${doneColor}18)`;
      el.style.opacity = '0.7';
    } else {
      el.style.borderLeftColor = slotColor;
      el.style.background = `linear-gradient(90deg, ${slotColor}16, ${slotColor}08)`;
    }

    const titleText = (slot.name ?? 'Créneau') + (slot.done ? ' ✓' : '');
    el.innerHTML = `<div class="title">${titleText}</div><div class="time">${minutesToTime(slot.start)} — ${minutesToTime(slot.end)}</div>`;

    el.addEventListener('mousedown', e => startSlotDrag(e as MouseEvent, slot, el));
    el.addEventListener('touchstart', e => startSlotDrag(e as TouchEvent, slot, el), { passive: false });

    slotLayer.appendChild(el);
  }

  showCompletions();
}

// ─── Completion badges ─────────────────────────────────────────────────────

export function showCompletions(): void {
  const key = isoDateKey(viewDate);
  const daySlots = store[key] ?? [];

  for (const slotEl of document.querySelectorAll<HTMLElement>('.slot')) {
    const start = parseInt(slotEl.dataset.start!);
    const end   = parseInt(slotEl.dataset.end!);
    const slot  = daySlots.find(s => s.start === start && s.end === end);

    slotEl.querySelector('.slot-tasks')?.remove();

    if (!slot || !completions.has(slot)) continue;

    const assignedTasks = completions.get(slot)!;
    if (assignedTasks.length === 0) continue;

    const container = document.createElement('div');
    container.className = 'slot-tasks';

    for (const expandedTask of assignedTasks) {
      const taskEl = document.createElement('div');
      taskEl.className = 'slot-task';
      taskEl.textContent = expandedTask.name;
      const typeObj = taskTypes.find(t => t.name === expandedTask.type);
      if (typeObj) taskEl.style.backgroundColor = typeObj.color;
      container.appendChild(taskEl);
    }

    slotEl.appendChild(container);
  }
}
