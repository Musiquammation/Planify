import { Slot } from '../types/models.js';
import { store, viewDate } from '../state/store.js';
import { taskTypes } from '../config/taskTypes.js';
import { DEFAULT_PREFERENCE } from '../types/constants.js';
import { isoDateKey } from '../utils/date.js';
import { minutesToTime } from '../utils/time.js';
import { renderGrid } from './grid.js';
import { openSlotMenu } from './slotMenu.js';
import { canEditData } from '../algo/runAlgo.js';
import { saveStore } from '../services/storage.js';

const hourHeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--hour-height')) || 60;
const grid       = document.getElementById('grid')!;
const slotLayer  = document.getElementById('slotLayer')!;

let isDragging   = false;
let dragStartY   = 0;
let selectionEl: HTMLElement | null = null;
let dragStartMin = 0;
let hasMoved     = false;

export let isCreatingNewSlot = false;

// ─── Helpers ───────────────────────────────────────────────────────────────

function pageYFromEvt(e: MouseEvent | TouchEvent): number {
  if ('touches' in e && e.touches.length) return e.touches[0].clientY;
  return (e as MouseEvent).clientY;
}

function clientRectTop(el: HTMLElement): number {
  return el.getBoundingClientRect().top + (window.scrollY || window.pageYOffset);
}

function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v));
}

function isOverlapping(slot: { start: number; end: number }): boolean {
  const key = isoDateKey(viewDate);
  const daySlots = store[key] ?? [];
  return daySlots.some(s => !(slot.end <= s.start || slot.start >= s.end));
}

function addNewSlot(slot: Slot): void {
  slot.taskPreferences = {};
  slot.name = slot.name ?? 'Slot';
  for (const type of taskTypes) {
    slot.taskPreferences[type.name] = DEFAULT_PREFERENCE;
  }

  const key = isoDateKey(viewDate);
  if (!store[key]) store[key] = [];
  store[key].push(slot);
  saveStore();
  renderGrid();

  const slotEls = slotLayer.getElementsByClassName('slot');
  const newSlotEl = slotEls[slotEls.length - 1] as HTMLElement;
  newSlotEl.onclick = (ev) => {
    const slotMenuEl   = document.getElementById('sideMenu')!;
    const taskPanelEl  = document.getElementById('taskPanel')!;
    const taskEditorEl = document.getElementById('taskEditor')!;
    const settingsPanelEl = document.getElementById('settingsPanel')!;
    if (
      slotMenuEl.classList.contains('open') ||
      taskPanelEl.classList.contains('open') ||
      taskEditorEl.classList.contains('open') ||
      settingsPanelEl.classList.contains('open')
    ) return;
    ev.stopPropagation();
    openSlotMenu(slot);
  };

  isCreatingNewSlot = true;
  openSlotMenu(slot);
  setTimeout(() => { isCreatingNewSlot = false; }, 50);
}

// ─── Drag handlers ─────────────────────────────────────────────────────────

export function startDrag(e: MouseEvent | TouchEvent): void {
  if (!canEditData()) return;
  if ((e as MouseEvent).type === 'mousedown' && (e as MouseEvent).button !== 0) return;

  // Do not start if a slot is being dragged
  if ((window as any)._isDraggingSlot) return;

  const slotMenuEl   = document.getElementById('sideMenu')!;
  const taskPanelEl  = document.getElementById('taskPanel')!;
  const taskEditorEl = document.getElementById('taskEditor')!;
  const settingsPanelEl = document.getElementById('settingsPanel')!;

  if (
    slotMenuEl.classList.contains('open') ||
    taskPanelEl.classList.contains('open') ||
    taskEditorEl.classList.contains('open') ||
    settingsPanelEl.classList.contains('open')
  ) return;

  if ((e.target as HTMLElement).closest('.slot')) return;

  isDragging = true;
  hasMoved   = false;

  const y   = pageYFromEvt(e);
  const top = clientRectTop(slotLayer);
  dragStartY   = clamp(y - top, 0, slotLayer.offsetHeight);
  dragStartMin = Math.floor(dragStartY / hourHeight * 60 / 15) * 15;

  selectionEl = document.createElement('div');
  selectionEl.className = 'selection';
  selectionEl.style.top   = `${dragStartMin / 60 * hourHeight + 6}px`;
  selectionEl.style.height = '28px';
  selectionEl.style.left  = '6px';
  selectionEl.style.right = '6px';
  selectionEl.innerHTML   = `<div style="font-size:12px;padding:4px">${minutesToTime(dragStartMin)} — ${minutesToTime(dragStartMin + 60)}</div>`;
  slotLayer.appendChild(selectionEl);

  window.addEventListener('mousemove', onDrag as EventListener);
  window.addEventListener('mouseup', endDrag as EventListener);
  window.addEventListener('touchmove', onDrag as EventListener, { passive: false });
  window.addEventListener('touchend', endDrag as EventListener);
}

function onDrag(e: MouseEvent | TouchEvent): void {
  if (!isDragging) return;

  const y    = pageYFromEvt(e);
  const top  = clientRectTop(slotLayer);
  const dist = Math.abs(y - (dragStartY + top));
  if (dist > 5) hasMoved = true;
  if (!hasMoved) return;

  e.preventDefault();

  const curY    = clamp(y - top, 0, slotLayer.offsetHeight);
  const topY    = Math.min(dragStartY, curY);
  const bottomY = Math.max(dragStartY, curY);
  const startMin = Math.floor(topY   / hourHeight * 60 / 15) * 15;
  const endMin   = Math.ceil(bottomY / hourHeight * 60 / 15) * 15;

  selectionEl!.style.top    = `${startMin / 60 * hourHeight + 6}px`;
  selectionEl!.style.height = `${Math.max(28, (endMin - startMin) / 60 * hourHeight - 6)}px`;
  selectionEl!.innerHTML    = `<div style="font-size:12px;padding:4px">${minutesToTime(startMin)} — ${minutesToTime(endMin)}</div>`;
}

function endDrag(e: MouseEvent | TouchEvent): void {
  if (!isDragging) return;
  isDragging = false;

  window.removeEventListener('mousemove', onDrag as EventListener);
  window.removeEventListener('mouseup', endDrag as EventListener);
  window.removeEventListener('touchmove', onDrag as EventListener);
  window.removeEventListener('touchend', endDrag as EventListener);

  e.stopPropagation();
  e.preventDefault();

  const rect = slotLayer.getBoundingClientRect();

  const slotMenuEl   = document.getElementById('sideMenu')!;
  const taskPanelEl  = document.getElementById('taskPanel')!;
  const taskEditorEl = document.getElementById('taskEditor')!;
  const settingsPanelEl = document.getElementById('settingsPanel')!;

  let targetEl: Element | null;
  if ('changedTouches' in e && e.changedTouches.length) {
    const touch = e.changedTouches[0];
    targetEl = document.elementFromPoint(touch.clientX, touch.clientY)?.closest('.slot') ?? null;
  } else {
    targetEl = (e as MouseEvent).target instanceof Element
      ? ((e as MouseEvent).target as Element).closest('.slot')
      : null;
  }

  if (targetEl) {
    selectionEl?.remove(); selectionEl = null;
    return;
  }

  if (
    slotMenuEl.classList.contains('open') ||
    taskPanelEl.classList.contains('open') ||
    taskEditorEl.classList.contains('open') ||
    settingsPanelEl.classList.contains('open')
  ) {
    selectionEl?.remove(); selectionEl = null;
    return;
  }

  if (!hasMoved) {
    let y: number;
    if ('changedTouches' in e && e.changedTouches.length) y = e.changedTouches[0].clientY;
    else y = (e as MouseEvent).clientY;
    y -= rect.top;

    let minute = Math.floor(y / hourHeight * 60 / 15) * 15;
    minute = clamp(minute, 0, 24 * 60 - 60);
    const slot = { start: minute, end: minute + 60, taskPreferences: {} };

    if (!isOverlapping(slot)) {
      addNewSlot(slot as Slot);
    }
  } else {
    const topY    = parseFloat(selectionEl!.style.top) - 6;
    const height  = parseFloat(selectionEl!.style.height) + 6;
    let startMin  = Math.floor(topY   / hourHeight * 60 / 15) * 15;
    let duration  = Math.ceil(height  / hourHeight * 60 / 15) * 15;
    if (duration < 15) duration = 60;
    startMin = clamp(startMin, 0, 24 * 60 - 1);
    const endMin  = clamp(startMin + duration, startMin + 15, 24 * 60);
    const slot = { start: startMin, end: endMin, taskPreferences: {} };

    if (!isOverlapping(slot)) {
      addNewSlot(slot as Slot);
    }
  }

  selectionEl?.remove(); selectionEl = null;
}

// ─── Attach grid listeners ─────────────────────────────────────────────────

grid.addEventListener('mousedown', startDrag as EventListener);
grid.addEventListener('touchstart', startDrag as EventListener, { passive: false });
