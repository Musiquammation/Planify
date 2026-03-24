import { taskTypes } from '../config/taskTypes.js';
import { importableTypes } from '../config/taskTypes.js';
import { tasks } from '../state/tasks.js';
import { store } from '../state/store.js';
import { completions, removeTypeFromCompletions } from '../state/completions.js';
import { currentEditingSlot } from '../state/store.js';
import { DEFAULT_PREFERENCE } from '../types/constants.js';
import { renderGrid } from './grid.js';
import { renderTaskList, updatePlacementButtonsState } from './taskPanel.js';
import { renderTaskTypeGrid } from './slotMenu.js';
import { initTaskTypes } from './taskEditor.js';
import { openSettingsPanelUI, closeSettingsPanelUI, updateFloatingButtonVisibility } from './layout.js';
import { canEditData } from '../algo/runAlgo.js';
import { saveTaskTypes, saveTasks, saveStore } from '../services/storage.js';
import {
  loadSlotOffsets, saveSlotOffsets,
  loadDailyTime,   saveDailyTime,
  requestPermission, getPermissionStatus,
  rescheduleSlotReminders, rescheduleDailyReminder,
} from './notifications.js';

// ─── DOM refs ──────────────────────────────────────────────────────────────
const settingsPanel    = document.getElementById('settingsPanel')!;
const taskTypesList    = document.getElementById('taskTypesList')!;
const addTypeBtn       = document.getElementById('addTypeBtn')!;
const importPresetBtn  = document.getElementById('importPresetBtn')!;
const importMenu       = document.getElementById('importMenu')!;
const importMenuItems  = document.getElementById('importMenuItems')!;
const closeSettingsBtn = document.getElementById('closeSettingsPanel')!;
const settingsBtn      = document.getElementById('settingsBtn')!;

// Notification DOM refs
const slotOffsetsList       = document.getElementById('slotOffsetsList')!;
const newOffsetInput        = document.getElementById('newOffsetInput') as HTMLInputElement;
const addOffsetBtn          = document.getElementById('addOffsetBtn')!;
const notifPermBanner       = document.getElementById('notifPermissionBanner')!;
const requestPermBtn        = document.getElementById('requestPermissionBtn')!;
const dailyReminderToggle   = document.getElementById('dailyReminderToggle') as HTMLInputElement;
const dailyTimeRow          = document.getElementById('dailyTimeRow')!;
const dailyTimeInput        = document.getElementById('dailyTimeInput') as HTMLInputElement;
const notifPermBanner2      = document.getElementById('notifPermissionBanner2')!;
const requestPermBtn2       = document.getElementById('requestPermissionBtn2')!;

// ─── Collapsible sections ──────────────────────────────────────────────────

function initCollapsibles(): void {
  document.querySelectorAll<HTMLButtonElement>('.collapsible-header').forEach(btn => {
    btn.addEventListener('click', () => {
      const section = btn.closest('.collapsible-section')!;
      const isOpen  = section.classList.contains('open');
      // Close all
      document.querySelectorAll('.collapsible-section').forEach(s => s.classList.remove('open'));
      // Toggle clicked
      if (!isOpen) section.classList.add('open');
    });
  });
}

// ─── Task types render ─────────────────────────────────────────────────────

export function renderTaskTypesList(): void {
  taskTypesList.innerHTML = '';

  taskTypes.forEach((type, index) => {
    const item = document.createElement('div');
    item.className = 'task-type-item';
    item.style.borderLeftColor = type.color;

    item.innerHTML = `
      <input type="color" class="color-picker" value="${type.color}" data-index="${index}">
      <input type="text" value="${type.name}" data-index="${index}" placeholder="Nom du type">
      <button class="delete-type-btn" data-index="${index}">Suppr</button>
    `;

    const colorPicker = item.querySelector<HTMLInputElement>('.color-picker')!;
    const nameInput   = item.querySelector<HTMLInputElement>('input[type="text"]')!;
    const deleteBtn   = item.querySelector<HTMLButtonElement>('.delete-type-btn')!;

    colorPicker.addEventListener('change', e => updateTaskTypeColor(index, (e.target as HTMLInputElement).value));
    nameInput.addEventListener('blur', e => updateTaskTypeName(index, (e.target as HTMLInputElement).value.trim()));
    nameInput.addEventListener('keypress', e => { if (e.key === 'Enter') nameInput.blur(); });
    deleteBtn.addEventListener('click', () => deleteTaskType(index));

    taskTypesList.appendChild(item);
  });
}

// ─── Task type CRUD ────────────────────────────────────────────────────────

function updateTaskTypeColor(index: number, newColor: string): void {
  if (!canEditData()) return;
  taskTypes[index].color = newColor;
  saveTaskTypes();
  renderTaskTypesList();
  renderTaskList();
  initTaskTypes();
  renderGrid();
  if (currentEditingSlot && settingsPanel.classList.contains('open')) {
    renderTaskTypeGrid(currentEditingSlot.taskPreferences);
  }
}

function updateTaskTypeName(index: number, newName: string): void {
  if (!canEditData()) return;
  if (!newName || newName === taskTypes[index].name) return;

  if (taskTypes.some((t, i) => i !== index && t.name === newName)) {
    alert('Ce nom de type existe déjà !');
    renderTaskTypesList();
    return;
  }

  const oldName = taskTypes[index].name;
  taskTypes[index].name = newName;

  tasks.forEach(t => { if (t.type === oldName) t.type = newName; });
  Object.values(store).flat().forEach(slot => {
    if (slot.taskPreferences?.[oldName] !== undefined) {
      slot.taskPreferences[newName] = slot.taskPreferences[oldName];
      delete slot.taskPreferences[oldName];
    }
  });

  saveTaskTypes(); saveTasks(); saveStore();
  renderTaskTypesList(); renderTaskList(); initTaskTypes(); renderGrid();
  if (currentEditingSlot && document.getElementById('sideMenu')!.classList.contains('open')) {
    renderTaskTypeGrid(currentEditingSlot.taskPreferences);
  }
}

function deleteTaskType(index: number): void {
  const typeToDelete = taskTypes[index];

  const tasksWithType = tasks.filter(t => t.type === typeToDelete.name);
  if (tasksWithType.length > 0) {
    if (!confirm(`Warning! ${tasksWithType.length} task(s) of type "${typeToDelete.name}" will be deleted.\n\nDo you want to continue?`)) return;
  }

  const slotsWithOnlyThis: object[] = [];
  Object.values(store).flat().forEach(slot => {
    if (slot.taskPreferences) {
      const otherPositive = Object.entries(slot.taskPreferences)
        .filter(([k, v]) => k !== typeToDelete.name && v > 0);
      if (otherPositive.length === 0 && (slot.taskPreferences[typeToDelete.name] ?? 0) > 0) {
        slotsWithOnlyThis.push(slot);
      }
    }
  });
  if (slotsWithOnlyThis.length > 0) {
    alert(`Cannot remove this kind of slots : ${slotsWithOnlyThis.length} slot(s) would no longer have any type with a preference > 0%.`);
    return;
  }

  taskTypes.splice(index, 1);

  for (let i = tasks.length - 1; i >= 0; i--) {
    if (tasks[i].type === typeToDelete.name) tasks.splice(i, 1);
  }

  removeTypeFromCompletions(typeToDelete.name);

  Object.values(store).flat().forEach(slot => {
    if (slot.taskPreferences?.[typeToDelete.name] !== undefined) {
      delete slot.taskPreferences[typeToDelete.name];
    }
  });

  saveTaskTypes(); saveTasks(); saveStore();
  renderTaskTypesList(); renderTaskList(); initTaskTypes(); renderGrid();
  if (currentEditingSlot && document.getElementById('sideMenu')!.classList.contains('open')) {
    renderTaskTypeGrid(currentEditingSlot.taskPreferences);
  }
  updatePlacementButtonsState();
}

export function addNewTaskType(): void {
  if (!canEditData()) return;

  const newType = {
    name: `New type ${taskTypes.length + 1}`,
    color: `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`,
  };
  taskTypes.push(newType);

  Object.values(store).flat().forEach(slot => {
    if (slot.taskPreferences) slot.taskPreferences[newType.name] = DEFAULT_PREFERENCE;
  });

  saveTaskTypes(); saveStore();
  renderTaskTypesList(); initTaskTypes();

  if (currentEditingSlot && document.getElementById('sideMenu')!.classList.contains('open')) {
    renderTaskTypeGrid(currentEditingSlot.taskPreferences);
  }
}

// ─── Import menu ───────────────────────────────────────────────────────────

export function initImportMenu(): void {
  importMenuItems.innerHTML = '';
  for (const preset of importableTypes) {
    const btn = document.createElement('button');
    btn.className = 'import-menu-item';
    btn.textContent = preset.name;
    btn.addEventListener('click', () => importPreset(preset));
    importMenuItems.appendChild(btn);
  }
}

function importPreset(preset: typeof importableTypes[0]): void {
  preset.types.forEach(t => taskTypes.push({ ...t }));
  tasks.forEach(t => { t.type = taskTypes[1]?.name ?? '(default)'; });
  saveTaskTypes(); saveTasks();
  importMenu.classList.remove('open');
  renderTaskTypesList(); renderTaskList(); initTaskTypes();
  alert(`Configuration "${preset.name}" importée avec succès !`);
}

function toggleImportMenu(): void {
  importMenu.classList.toggle('open');
}

// ─── Notification: slot offsets ────────────────────────────────────────────

function renderSlotOffsets(): void {
  const offsets = loadSlotOffsets();
  slotOffsetsList.innerHTML = '';

  if (offsets.length === 0) {
    slotOffsetsList.innerHTML = '<div style="font-size:12px;color:var(--muted);text-align:center;padding:4px 0;">Aucun rappel configuré</div>';
    return;
  }

  offsets.forEach(offset => {
    const item = document.createElement('div');
    item.className = 'offset-item';

    const label = offset === 0 ? 'At the start of the slot' : `${offset} min before`;
    item.innerHTML = `
      <span class="offset-label">${label}</span>
      <button class="offset-delete-btn" data-offset="${offset}">Supprimer</button>
    `;
    item.querySelector<HTMLButtonElement>('.offset-delete-btn')!.addEventListener('click', () => {
      const current = loadSlotOffsets();
      saveSlotOffsets(current.filter(o => o !== offset));
      renderSlotOffsets();
      rescheduleSlotReminders();
    });
    slotOffsetsList.appendChild(item);
  });
}

async function _checkAndShowPermBanner(banner: HTMLElement) {
  const status = await getPermissionStatus();
  banner.style.display = (status !== 'granted') ? 'flex' : 'none';
}

async function _handleRequestPermission(banner: HTMLElement): Promise<void> {
  const granted = await requestPermission();
  if (granted) {
    banner.style.display = 'none';
    rescheduleSlotReminders();
    rescheduleDailyReminder();
  } else {
    alert("Notifications have been denied. Please enable them in your browser settings.");
  }
}

// ─── Notification: daily reminder ─────────────────────────────────────────

function renderDailyReminder(): void {
  const time = loadDailyTime();
  dailyReminderToggle.checked = !!time;
  dailyTimeRow.style.display  = time ? 'flex' : 'none';
  if (time) dailyTimeInput.value = time;
  _checkAndShowPermBanner(notifPermBanner2);
}

// ─── Init all notification UI ──────────────────────────────────────────────

function initNotificationUI(): void {
  renderSlotOffsets();
  renderDailyReminder();
  _checkAndShowPermBanner(notifPermBanner);
  _checkAndShowPermBanner(notifPermBanner2);
}

// ─── Notification event listeners ─────────────────────────────────────────

addOffsetBtn.addEventListener('click', async () => {
  const val = parseInt(newOffsetInput.value);
  if (isNaN(val) || val < 0) { alert('Valeur invalide'); return; }

  const status = await getPermissionStatus();
  if (status !== 'granted') {
    const granted = await requestPermission();
    if (!granted) {
      _checkAndShowPermBanner(notifPermBanner);
      return;
    }
  }

  const current = loadSlotOffsets();
  if (!current.includes(val)) {
    saveSlotOffsets([...current, val]);
    rescheduleSlotReminders();
  }
  newOffsetInput.value = '15';
  renderSlotOffsets();
});

requestPermBtn.addEventListener('click', () => _handleRequestPermission(notifPermBanner));
requestPermBtn2.addEventListener('click', () => _handleRequestPermission(notifPermBanner2));

dailyReminderToggle.addEventListener('change', async () => {
  if (dailyReminderToggle.checked) {
    const status = await getPermissionStatus();
    if (status !== 'granted') {
      const granted = await requestPermission();
      if (!granted) {
        dailyReminderToggle.checked = false;
        _checkAndShowPermBanner(notifPermBanner2);
        return;
      }
    }
    const time = dailyTimeInput.value || '08:00';
    saveDailyTime(time);
    dailyTimeRow.style.display = 'flex';
    dailyTimeInput.value = time;
    rescheduleDailyReminder();
  } else {
    saveDailyTime(null);
    dailyTimeRow.style.display = 'none';
    rescheduleDailyReminder();
  }
  _checkAndShowPermBanner(notifPermBanner2);
});

dailyTimeInput.addEventListener('change', () => {
  if (dailyReminderToggle.checked && dailyTimeInput.value) {
    saveDailyTime(dailyTimeInput.value);
    rescheduleDailyReminder();
  }
});

// ─── Main event listeners ──────────────────────────────────────────────────

settingsBtn.addEventListener('click', e => {
  e.stopPropagation();
  openSettingsPanelUI();
  renderTaskTypesList();
  initImportMenu();
  initNotificationUI();
});

closeSettingsBtn.addEventListener('click', e => { e.stopPropagation(); closeSettingsPanelUI(); });
addTypeBtn.addEventListener('click', addNewTaskType);

importPresetBtn.addEventListener('click', e => { e.stopPropagation(); toggleImportMenu(); });

document.addEventListener('click', e => {
  if (
    importMenu.classList.contains('open') &&
    !importMenu.contains(e.target as Node) &&
    e.target !== importPresetBtn
  ) {
    importMenu.classList.remove('open');
  }

  if (
    settingsPanel.classList.contains('open') &&
    !settingsPanel.contains(e.target as Node) &&
    e.target !== settingsBtn
  ) {
    closeSettingsPanelUI();
    e.stopPropagation();
  }
});

// Init collapsibles on module load
initCollapsibles();