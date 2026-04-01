import { Slot } from '../types/models.js';
import { store, viewDate } from '../state/store.js';
import { completions } from '../state/completions.js';
import { taskTypes } from '../config/taskTypes.js';
import { isoDateKey } from '../utils/date.js';
import { minutesToTime } from '../utils/time.js';
import { getSlotColor } from '../utils/slotColor.js';
import { startSlotDrag } from './slotDrag.js';
import { viewDays } from './layout.js';

const hourHeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--hour-height')) || 60;
const slotLayer  = document.getElementById('slotLayer')!;
const timesCol   = document.getElementById('timesCol')!;
const gridEl     = document.getElementById('grid')!;

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
  if (viewDays === 1) {
    _renderSingleDay();
  } else {
    _renderMultiDay();
  }
}

function _renderSingleDay(): void {
  // Restore single-day layout
  const calendarWrap = document.querySelector<HTMLElement>('.calendar-wrap')!;
  calendarWrap.classList.remove('multiday');

  timesCol.style.display = '';
  gridEl.innerHTML = '';
  gridEl.style.display = '';

  const newSlotLayer = document.createElement('div');
  newSlotLayer.className = 'slot-layer';
  newSlotLayer.id = 'slotLayer';
  // Add hour rows
  for (let h = 0; h < 24; h++) {
    const row = document.createElement('div');
    row.className = 'hour-row';
    row.innerHTML = '<div class="half-line"></div>';
    newSlotLayer.appendChild(row);
  }
  gridEl.appendChild(newSlotLayer);

  const key = isoDateKey(viewDate);
  const daySlots = store[key] ?? [];

  for (const slot of daySlots) {
    _appendSlotEl(newSlotLayer, slot, viewDate);
  }

  _showCompletionsInLayer(newSlotLayer, daySlots);
}

function _renderMultiDay(): void {
  const calendarWrap = document.querySelector<HTMLElement>('.calendar-wrap')!;
  calendarWrap.classList.add('multiday');

  timesCol.style.display = '';
  gridEl.innerHTML = '';
  const timesWidth   = timesCol.offsetWidth || 58;
  const available    = calendarWrap.clientWidth - timesWidth;
  const colWidth     = Math.max(160, Math.floor(available / viewDays));

  const columnsWrapper = document.createElement('div');
  columnsWrapper.className = 'multiday-columns';
  gridEl.appendChild(columnsWrapper);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < viewDays; i++) {
    const colDate = new Date(viewDate);
    colDate.setDate(colDate.getDate() + i);
    const key = isoDateKey(colDate);
    const daySlots = store[key] ?? [];

    const col = document.createElement('div');
    col.className = 'day-column';
    col.dataset.dateKey = key;
    col.style.width     = `${colWidth}px`;
    col.style.minWidth  = `${colWidth}px`;
    col.style.flexShrink = '0';

    const header = document.createElement('div');
    header.className = 'day-column-header';
    if (colDate.getTime() === today.getTime()) header.classList.add('today');
    header.textContent = colDate.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit' });
    col.appendChild(header);

    const layer = document.createElement('div');
    layer.className = 'slot-layer';
    layer.style.height = `calc(24 * var(--hour-height))`;
    layer.style.position = 'relative';
    layer.style.padding = '4px';

    // Hour rows
    for (let h = 0; h < 24; h++) {
      const row = document.createElement('div');
      row.className = 'hour-row';
      row.innerHTML = '<div class="half-line"></div>';
      layer.appendChild(row);
    }

    for (const slot of daySlots) {
      _appendSlotEl(layer, slot, colDate);
    }

    _showCompletionsInLayer(layer, daySlots);
    col.appendChild(layer);
    columnsWrapper.appendChild(col);
  }
}

function _appendSlotEl(layer: HTMLElement, slot: Slot, date: Date): void {
  const el = document.createElement('div');
  el.className = 'slot';
  el.dataset.start = String(slot.start);
  el.dataset.end   = String(slot.end);

  el.style.top    = `${slot.start / 60 * hourHeight + 6}px`;
  el.style.height = `${Math.max(28, (slot.end - slot.start) / 60 * hourHeight - 6)}px`;
  el.style.left   = '4px';
  el.style.right  = '4px';
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

  const titleText = (slot.name ?? 'Slot') + (slot.done ? ' ✓' : '');
  el.innerHTML = `<div class="title">${titleText}</div><div class="time">${minutesToTime(slot.start)} — ${minutesToTime(slot.end)}</div>`;

  el.addEventListener('mousedown', e => startSlotDrag(e as MouseEvent, slot, el));
  el.addEventListener('touchstart', e => startSlotDrag(e as TouchEvent, slot, el), { passive: false });

  layer.appendChild(el);
}

// ─── Completion badges ─────────────────────────────────────────────────────

export function showCompletions(): void {
  const key = isoDateKey(viewDate);
  const daySlots = store[key] ?? [];
  const layer = document.getElementById('slotLayer');
  if (layer) _showCompletionsInLayer(layer, daySlots);
}

function _showCompletionsInLayer(layer: HTMLElement, daySlots: Slot[]): void {
  for (const slotEl of layer.querySelectorAll<HTMLElement>('.slot')) {
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