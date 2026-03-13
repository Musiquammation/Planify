/**
 * Global layout helpers: floating button visibility, panel open/close,
 * and day navigation.
 */
import { viewDate, setViewDate } from '../state/store.js';
import { renderGrid } from './grid.js';
import { canEditData } from '../algo/runAlgo.js';

// ─── DOM refs ──────────────────────────────────────────────────────────────
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

// ─── Day navigation ────────────────────────────────────────────────────────

export function openDay(d: Date): void {
  setViewDate(d);
  dateTitle.textContent = viewDate.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  renderGrid();
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

// ─── Navigation event listeners ────────────────────────────────────────────

prevBtn.addEventListener('click', () => {
  if (!canEditData()) return;
  const d = new Date(viewDate);
  d.setDate(d.getDate() - 1);
  openDay(d);
});

nextBtn.addEventListener('click', () => {
  if (!canEditData()) return;
  const d = new Date(viewDate);
  d.setDate(d.getDate() + 1);
  openDay(d);
});

openTaskPannelBtn.addEventListener('click', e => {
  e.stopPropagation();
  openTaskPanel();
});
