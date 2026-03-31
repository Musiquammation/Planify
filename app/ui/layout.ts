import { viewDate, setViewDate, store, currentEditingSlot } from '../state/store.js';
import { isoDateKey } from '../utils/date.js';
import { renderGrid, initTimes } from './grid.js';
import { canEditData } from '../algo/runAlgo.js';
import { taskTypes } from '../config/taskTypes.js';
import { DEFAULT_PREFERENCE } from '../types/constants.js';
import { saveStore } from '../services/storage.js';
import { completions } from '../state/completions.js';

const openTaskPannelBtn = document.getElementById('openTaskPannelBtn')!;
const settingsBtn       = document.getElementById('settingsBtn')!;
const taskPanel         = document.getElementById('taskPanel')!;
const taskEditor        = document.getElementById('taskEditor')!;
const slotMenu          = document.getElementById('sideMenu')!;
const settingsPanel     = document.getElementById('settingsPanel')!;
const executionView     = document.getElementById('executionView')!;
const dateTitle         = document.getElementById('dateTitle')!;
const prevBtn           = document.getElementById('prev')!;
const nextBtn           = document.getElementById('next')!;
const calendarWrap      = document.querySelector<HTMLElement>('.calendar-wrap')!;
const timesCol          = document.getElementById('timesCol')!;
const gridEl            = document.getElementById('grid')!;

// ─── View state ────────────────────────────────────────────────────────────

export let viewDays = 1; // 1 = single day, N = N days

export function setViewDays(n: number): void {
  viewDays = n;
}

// ─── Floating button ───────────────────────────────────────────────────────

export function updateFloatingButtonVisibility(): void {
  const anyOpen =
    taskPanel.classList.contains('open') ||
    taskEditor.classList.contains('open') ||
    slotMenu.classList.contains('open') ||
    settingsPanel.classList.contains('open') ||
    executionView.classList.contains('open');

  openTaskPannelBtn.classList.toggle('hidden', anyOpen);
  settingsBtn.classList.toggle('hidden', anyOpen);
}

// ─── Day / multi-day navigation ────────────────────────────────────────────

export function openDay(d: Date): void {
  setViewDate(d);
  _updateHeader();
  renderGrid();
}

function _updateHeader(): void {
  if (viewDays === 1) {
    dateTitle.textContent = viewDate.toLocaleDateString('fr-FR', {
      weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
    });
  } else {
    const end = new Date(viewDate);
    end.setDate(end.getDate() + viewDays - 1);
    const startStr = viewDate.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
    const endStr   = end.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
    dateTitle.textContent = `${startStr} – ${endStr}`;
  }
}

// ─── Panel helpers ─────────────────────────────────────────────────────────

export function openTaskPanel(): void {
  taskPanel.classList.add('open');
  updateFloatingButtonVisibility();
}

export function closeTaskPanel(): void {
  taskPanel.classList.remove('open');
  updateFloatingButtonVisibility();
}

export function closeSideMenu(): void {
  slotMenu.classList.remove('open');
  updateFloatingButtonVisibility();
}

export function openSettingsPanelUI(): void {
  settingsPanel.classList.add('open');
  updateFloatingButtonVisibility();
}

export function closeSettingsPanelUI(): void {
  settingsPanel.classList.remove('open');
  updateFloatingButtonVisibility();
}

// ─── View switcher ─────────────────────────────────────────────────────────

function initViewSwitcher(): void {
  const switcher = document.getElementById('viewSwitcher');
  if (!switcher) return;

  switcher.querySelectorAll<HTMLButtonElement>('.view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const days = parseInt(btn.dataset.days!);
      if (days === 0) {
        // Custom: prompt
        const input = prompt('Nombre de jours à afficher :', '7');
        if (!input) return;
        const n = parseInt(input);
        if (isNaN(n) || n < 1 || n > 60) { alert('Valeur invalide (1-60)'); return; }
        setViewDays(n);
        // Mark this button as active with label
        switcher.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
        btn.textContent = `${n}j`;
        btn.classList.add('active');
      } else {
        setViewDays(days);
        switcher.querySelectorAll('.view-btn').forEach(b => {
          b.classList.remove('active');
          if ((b as HTMLButtonElement).dataset.days === '0') b.textContent = '…';
        });
        btn.classList.add('active');
      }
      _updateHeader();
      renderGrid();
    });
  });
}

// ─── Copy slot to next week ────────────────────────────────────────────────

export function copySlotToNextWeek(slot: import('../types/models.js').Slot): boolean {
  const key = isoDateKey(viewDate);
  const targetDate = new Date(viewDate);
  targetDate.setDate(targetDate.getDate() + 7);
  const targetKey = isoDateKey(targetDate);

  if (!store[targetKey]) store[targetKey] = [];

  // Check overlap
  const newEnd = slot.end;
  const hasOverlap = store[targetKey].some(
    s => !(newEnd <= s.start || slot.start >= s.end),
  );
  if (hasOverlap) return false;

  // Deep copy slot (without completions)
  const newSlot: import('../types/models.js').Slot = {
    start: slot.start,
    end: slot.end,
    name: slot.name,
    taskPreferences: { ...slot.taskPreferences },
    done: false,
  };

  store[targetKey].push(newSlot);
  saveStore();
  return true;
}

// ─── Navigation event listeners ────────────────────────────────────────────

prevBtn.addEventListener('click', () => {
  if (!canEditData()) return;
  const d = new Date(viewDate);
  d.setDate(d.getDate() - viewDays);
  openDay(d);
});

nextBtn.addEventListener('click', () => {
  if (!canEditData()) return;
  const d = new Date(viewDate);
  d.setDate(d.getDate() + viewDays);
  openDay(d);
});

document.getElementById('copySlotBtn')?.addEventListener('click', () => {
  if (!currentEditingSlot) return;
  const ok = copySlotToNextWeek(currentEditingSlot);
  if (ok) {
    alert('Créneau copié sur la semaine suivante !');
  } else {
    alert('Impossible de copier : chevauchement détecté sur la semaine suivante.');
  }
  closeSideMenu();
});

openTaskPannelBtn.addEventListener('click', e => {
  e.stopPropagation();
  openTaskPanel();
});

// Init
initViewSwitcher();