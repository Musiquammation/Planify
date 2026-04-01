import { Slot } from '../types/models.js';
import { store, viewDate } from '../state/store.js';
import { isoDateKey } from '../utils/date.js';
import { minutesToTime } from '../utils/time.js';
import { renderGrid } from './grid.js';
import { openSlotMenu } from './slotMenu.js';
import { canEditData } from '../algo/runAlgo.js';
import { saveStore } from '../services/storage.js';

const hourHeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--hour-height')) || 60;

let isDraggingSlot    = false;
let draggedSlot: Slot | null = null;
let draggedSlotElement: HTMLElement | null = null;
let draggedSlotDate: Date | null = null;
let slotDragOffset    = { x: 0, y: 0 };

export function startSlotDrag(
  e: MouseEvent | TouchEvent,
  slot: Slot,
  element: HTMLElement,
  date: Date = viewDate,
): void {
  if (!canEditData()) return;
  if ((e as MouseEvent).button !== undefined && (e as MouseEvent).button !== 0) return;

  const panelsOpen = ['sideMenu','taskPanel','taskEditor','settingsPanel']
    .some(id => document.getElementById(id)!.classList.contains('open'));
  if (panelsOpen) return;

  e.stopPropagation();
  e.preventDefault();

  let hasMoved = false;
  const startX = 'touches' in e ? e.touches[0].clientX : e.clientX;
  const startY = 'touches' in e ? e.touches[0].clientY : e.clientY;

  const rect = element.getBoundingClientRect();
  slotDragOffset = {
    x: ('touches' in e ? e.touches[0].clientX : e.clientX) - rect.left,
    y: ('touches' in e ? e.touches[0].clientY : e.clientY) - rect.top,
  };

  function onMove(moveEvent: MouseEvent | TouchEvent): void {
    const cx = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
    const cy = 'touches' in moveEvent ? moveEvent.touches[0].clientY : moveEvent.clientY;
    const dist = Math.sqrt((cx - startX) ** 2 + (cy - startY) ** 2);

    if (dist > 5 && !hasMoved) {
      hasMoved = true;
      isDraggingSlot = true;
      draggedSlot = slot;
      draggedSlotDate = new Date(date); // ← copie propre de la date de la colonne
      draggedSlotElement = element;
      element.style.cursor = 'grabbing';
      moveEvent.preventDefault();
    }

    if (hasMoved) {
      moveEvent.preventDefault();
      _onSlotDrag(moveEvent);
    }
  }

  function onEnd(endEvent: MouseEvent | TouchEvent): void {
    window.removeEventListener('mousemove', onMove as EventListener);
    window.removeEventListener('mouseup',   onEnd as EventListener);
    window.removeEventListener('touchmove', onMove as EventListener);
    window.removeEventListener('touchend',  onEnd as EventListener);

    if (hasMoved) {
      _endSlotDrag(endEvent);
    } else {
      const slotMenuEl      = document.getElementById('sideMenu')!;
      const taskPanelEl     = document.getElementById('taskPanel')!;
      const taskEditorEl    = document.getElementById('taskEditor')!;
      const settingsPanelEl = document.getElementById('settingsPanel')!;
      setTimeout(() => {
        if (
          !slotMenuEl.classList.contains('open') &&
          !taskPanelEl.classList.contains('open') &&
          !taskEditorEl.classList.contains('open') &&
          !settingsPanelEl.classList.contains('open')
        ) {
          openSlotMenu(slot, date);
        }
      }, 10);
    }

    element.style.cursor = 'pointer';
    isDraggingSlot     = false;
    draggedSlot        = null;
    draggedSlotDate    = null;
    draggedSlotElement = null;
  }

  window.addEventListener('mousemove', onMove as EventListener, { passive: false });
  window.addEventListener('mouseup',   onEnd as EventListener);
  window.addEventListener('touchmove', onMove as EventListener, { passive: false });
  window.addEventListener('touchend',  onEnd as EventListener);
}

function _onSlotDrag(e: MouseEvent | TouchEvent): void {
  if (!isDraggingSlot || !draggedSlotElement || !draggedSlot) return;
  e.preventDefault();

  const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
  const calendarWrap = document.querySelector<HTMLElement>('.calendar-wrap')!;
  const calendarRect = calendarWrap.getBoundingClientRect();
  const relativeY = clientY - calendarRect.top + calendarWrap.scrollTop - slotDragOffset.y;
  const duration = draggedSlot.end - draggedSlot.start;
  const newStart = Math.max(0, Math.min(24 * 60 - duration,
    Math.floor(relativeY / hourHeight * 60 / 15) * 15));

  draggedSlotElement.style.top = `${newStart / 60 * hourHeight + 6}px`;

  const timeDisplay = draggedSlotElement.querySelector<HTMLElement>('.time');
  if (timeDisplay) {
    timeDisplay.textContent = `${minutesToTime(newStart)} — ${minutesToTime(newStart + duration)}`;
  }
}

function _endSlotDrag(e: MouseEvent | TouchEvent): void {
  if (!isDraggingSlot || !draggedSlot || !draggedSlotElement || !draggedSlotDate) return;
  isDraggingSlot = false;

  const clientY = 'changedTouches' in e ? e.changedTouches[0].clientY : e.clientY;
  const calendarWrap = document.querySelector<HTMLElement>('.calendar-wrap')!;
  const calendarRect = calendarWrap.getBoundingClientRect();
  const relativeY = clientY - calendarRect.top + calendarWrap.scrollTop - slotDragOffset.y;
  const duration = draggedSlot.end - draggedSlot.start;
  const newStart = Math.max(0, Math.min(24 * 60 - duration,
    Math.floor(relativeY / hourHeight * 60 / 15) * 15));
  const newEnd = newStart + duration;

  // Vérifier l'overlap uniquement sur le jour du slot déplacé
  const key = isoDateKey(draggedSlotDate);
  const daySlots = store[key] ?? [];
  const hasOverlap = daySlots.some(
    s => s !== draggedSlot && !(newEnd <= s.start || newStart >= s.end),
  );

  if (!hasOverlap) {
    draggedSlot.start = newStart;
    draggedSlot.end   = newEnd;
  }

  saveStore();
  renderGrid();

  draggedSlot        = null;
  draggedSlotElement = null;
  draggedSlotDate    = null;
}