import { Slot } from '../types/models.js';
import { store, viewDate } from '../state/store.js';
import { taskTypes } from '../config/taskTypes.js';
import { DEFAULT_PREFERENCE } from '../types/constants.js';
import { isoDateKey } from '../utils/date.js';
import { minutesToTime } from '../utils/time.js';
import { renderGrid } from './grid.js';
import { canEditData } from '../algo/runAlgo.js';
import { saveStore } from '../services/storage.js';

const hourHeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--hour-height')) || 60;
const calendarWrap = document.querySelector<HTMLElement>('.calendar-wrap')!;
const gridEl       = document.getElementById('grid')!;

let isDragging   = false;
let dragStartMin = 0;
let selectionEl: HTMLElement | null = null;
let activeLayer: HTMLElement | null = null;
let activeDate: Date = new Date(viewDate);
let hasMoved     = false;

export let isCreatingNewSlot = false;

// ─── Helpers ───────────────────────────────────────────────────────────────

function pageYFromEvt(e: MouseEvent | TouchEvent): number {
  return 'touches' in e && e.touches.length ? e.touches[0].clientY : (e as MouseEvent).clientY;
}

function pageXFromEvt(e: MouseEvent | TouchEvent): number {
  return 'touches' in e && e.touches.length ? e.touches[0].clientX : (e as MouseEvent).clientX;
}

function yToMinutes(clientY: number, layer: HTMLElement): number {
  const rect = layer.getBoundingClientRect();
  const relY = clientY - rect.top;
  return Math.max(0, Math.min(24 * 60, Math.floor(relY / hourHeight * 60 / 15) * 15));
}

function getLayerAndDateFromPoint(clientX: number, clientY: number): { layer: HTMLElement; date: Date } | null {
  // Vue multi-jours : chercher la colonne sous le point
  const cols = document.querySelectorAll<HTMLElement>('.day-column');
  if (cols.length > 0) {
    for (const col of cols) {
      const rect = col.getBoundingClientRect();
      if (clientX >= rect.left && clientX <= rect.right) {
        const layer = col.querySelector<HTMLElement>('.slot-layer');
        const dateKey = col.dataset.dateKey;
        if (layer && dateKey) {
          const [y, m, d] = dateKey.split('-').map(Number);
          return { layer, date: new Date(y, m - 1, d) };
        }
      }
    }
  }
  // Vue 1 jour
  const layer = document.getElementById('slotLayer');
  if (layer) return { layer, date: new Date(viewDate) };
  return null;
}

function isOverlapping(slot: { start: number; end: number }, dateKey: string): boolean {
  return (store[dateKey] ?? []).some(s => !(slot.end <= s.start || slot.start >= s.end));
}

function addNewSlot(slot: Slot, date: Date): void {
  slot.taskPreferences = {};
  slot.name = 'Slot';
  for (const type of taskTypes) {
    slot.taskPreferences[type.name] = DEFAULT_PREFERENCE;
  }
  const key = isoDateKey(date);
  if (!store[key]) store[key] = [];
  store[key].push(slot);
  saveStore();
  renderGrid();

  isCreatingNewSlot = true;
  import('./slotMenu.js').then(({ openSlotMenu }) => {
    openSlotMenu(slot, date);
    setTimeout(() => { isCreatingNewSlot = false; }, 50);
  });
}

// ─── Drag handlers ─────────────────────────────────────────────────────────

function startDrag(e: MouseEvent | TouchEvent): void {
  if (!canEditData()) return;
  if ((e as MouseEvent).type === 'mousedown' && (e as MouseEvent).button !== 0) return;
  if ((window as any)._isDraggingSlot) return;

  const panelsOpen = ['sideMenu','taskPanel','taskEditor','settingsPanel']
    .some(id => document.getElementById(id)!.classList.contains('open'));
  if (panelsOpen) return;

  if ((e.target as HTMLElement).closest('.slot')) return;
  if ((e.target as HTMLElement).closest('.day-column-header')) return;


  const clientX = pageXFromEvt(e);
  const clientY = pageYFromEvt(e);

  const hit = getLayerAndDateFromPoint(clientX, clientY);
  if (!hit) return;

  activeLayer = hit.layer;
  activeDate  = hit.date;
  isDragging  = true;
  hasMoved    = false;

  dragStartMin = yToMinutes(clientY, activeLayer);

  selectionEl = document.createElement('div');
  selectionEl.className = 'selection';
  selectionEl.style.left  = '4px';
  selectionEl.style.right = '4px';
  selectionEl.style.top    = `${dragStartMin / 60 * hourHeight}px`;
  selectionEl.style.height = `${hourHeight}px`;
  selectionEl.innerHTML = `<div style="font-size:12px;padding:4px">${minutesToTime(dragStartMin)} — ${minutesToTime(dragStartMin + 60)}</div>`;
  activeLayer.appendChild(selectionEl);

  window.addEventListener('mousemove', onDrag as EventListener);
  window.addEventListener('mouseup',   endDrag as EventListener);
  window.addEventListener('touchmove', onDrag as EventListener, { passive: false });
  window.addEventListener('touchend',  endDrag as EventListener);
}

function onDrag(e: MouseEvent | TouchEvent): void {
  if (!isDragging || !selectionEl || !activeLayer) return;

  const clientY = pageYFromEvt(e);
  const curMin  = yToMinutes(clientY, activeLayer);

  // Détecter si on a vraiment bougé (> 1 tranche de 15min)
  if (Math.abs(curMin - dragStartMin) >= 15) hasMoved = true;
  if (!hasMoved) return;

  e.preventDefault();

  const startMin = Math.min(dragStartMin, curMin);
  const endMin   = Math.max(dragStartMin, curMin);
  const snappedEnd = Math.max(startMin + 15, endMin);

  selectionEl.style.top    = `${startMin / 60 * hourHeight}px`;
  selectionEl.style.height = `${Math.max(hourHeight / 4, (snappedEnd - startMin) / 60 * hourHeight)}px`;
  selectionEl.innerHTML    = `<div style="font-size:12px;padding:4px">${minutesToTime(startMin)} — ${minutesToTime(snappedEnd)}</div>`;
}

function endDrag(e: MouseEvent | TouchEvent): void {
  if (!isDragging) return;
  isDragging = false;

  window.removeEventListener('mousemove', onDrag as EventListener);
  window.removeEventListener('mouseup',   endDrag as EventListener);
  window.removeEventListener('touchmove', onDrag as EventListener);
  window.removeEventListener('touchend',  endDrag as EventListener);

  e.stopPropagation();

  const clientY = 'changedTouches' in e && e.changedTouches.length
    ? e.changedTouches[0].clientY
    : (e as MouseEvent).clientY;
  const clientX = 'changedTouches' in e && e.changedTouches.length
    ? e.changedTouches[0].clientX
    : (e as MouseEvent).clientX;

  // Ignorer si on a relâché sur un slot existant
  const target = document.elementFromPoint(clientX, clientY);
  if (target?.closest('.slot')) {
    selectionEl?.remove(); selectionEl = null; activeLayer = null;
    return;
  }

  const panelsOpen = ['sideMenu','taskPanel','taskEditor','settingsPanel']
    .some(id => document.getElementById(id)!.classList.contains('open'));
  if (panelsOpen) {
    selectionEl?.remove(); selectionEl = null; activeLayer = null;
    return;
  }

  if (!activeLayer) { selectionEl?.remove(); selectionEl = null; return; }

  const key = isoDateKey(activeDate);

  if (!hasMoved) {
    // Clic simple → créneau d'1h à la position exacte du clic
    const minute = yToMinutes(clientY, activeLayer);
    const clamped = Math.min(minute, 24 * 60 - 60);
    const slot = { start: clamped, end: clamped + 60, taskPreferences: {} };
    if (!isOverlapping(slot, key)) addNewSlot(slot as Slot, activeDate);
  } else {
    // Glisser → créneau de la durée sélectionnée
    const curMin   = yToMinutes(clientY, activeLayer);
    const startMin = Math.min(dragStartMin, curMin);
    const endMin   = Math.max(dragStartMin + 15, Math.max(dragStartMin, curMin));
    const slot = { start: startMin, end: endMin, taskPreferences: {} };
    if (!isOverlapping(slot, key)) addNewSlot(slot as Slot, activeDate);
  }

  selectionEl?.remove(); selectionEl = null; activeLayer = null;
}

// ─── Attach listeners sur le grid entier ──────────────────────────────────

gridEl.addEventListener('mousedown',  startDrag as EventListener);
gridEl.addEventListener('touchstart', startDrag as EventListener, { passive: false });