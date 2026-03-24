import { Slot } from '../types/models.js';
import { store, viewDate, setCurrentEditingSlot, currentEditingSlot } from '../state/store.js';
import { completions, emptySlot as emptySlotCompletions } from '../state/completions.js';
import { tasks } from '../state/tasks.js';
import { taskTypes } from '../config/taskTypes.js';
import { DEFAULT_PREFERENCE } from '../types/constants.js';
import { isoDateKey, formatDateForInput } from '../utils/date.js';
import { minutesToTime, parseTimeInput, formatDuration } from '../utils/time.js';
import { renderGrid } from './grid.js';
import { renderTaskList } from './taskPanel.js';
import { closeSideMenu, updateFloatingButtonVisibility, openDay } from './layout.js';
import { updatePlacementButtonsState } from './taskPanel.js';
import { canEditData } from '../algo/runAlgo.js';
import { saveStore } from '../services/storage.js';
import { startExecution } from './executionView.js';

const slotMenu         = document.getElementById('sideMenu')!;
const slotInfo         = document.getElementById('slotInfo')!;
const startExecutionBtn = document.getElementById('startExecutionBtn')!;
const closeMenuBtn     = document.getElementById('closeMenu')!;
const deleteSlotBtn    = document.getElementById('deleteSlotBtn')!;
const emptySlotBtn     = document.getElementById('emptySlotBtn')!;

// ─── Open / close ──────────────────────────────────────────────────────────

export function openSlotMenu(slot: Slot): void {
	const taskPanelEl  = document.getElementById('taskPanel')!;
	const taskEditorEl = document.getElementById('taskEditor')!;
	const settingsPanelEl = document.getElementById('settingsPanel')!;

	if (
		slotMenu.classList.contains('open') ||
		taskPanelEl.classList.contains('open') ||
		taskEditorEl.classList.contains('open') ||
		settingsPanelEl.classList.contains('open')
	) return;

	setCurrentEditingSlot(slot);

	if (!slot.taskPreferences) {
		slot.taskPreferences = {};
		for (const type of taskTypes) {
			slot.taskPreferences[type.name] = DEFAULT_PREFERENCE;
		}
	}

	updateSlotInfo(slot);
	renderTaskTypeGrid(slot.taskPreferences);
	slotMenu.classList.add('open');
	updateFloatingButtonVisibility();
}

// ─── Slot info panel ───────────────────────────────────────────────────────

export function updateSlotInfo(slot: Slot): void {
	const duration = slot.end - slot.start;
	const assignedTasks = completions.get(slot) ?? [];

	let tasksHtml = '';
	if (assignedTasks.length > 0) {
		tasksHtml = `
			<div class="assigned-tasks-section">
				<h4>Tâches assignées</h4>
				<div class="assigned-tasks-list">
					${assignedTasks.map((expandedTask) => {
						const typeObj  = taskTypes.find(t => t.name === expandedTask.type);
						const color    = typeObj ? typeObj.color : '#4f46e5';
						const realIdx  = tasks.indexOf(expandedTask.reference);
						return `
							<div class="assigned-task-item" data-task-index="${realIdx}" style="border-left-color: ${color}">
								<div class="assigned-task-name">${expandedTask.name}</div>
								<div class="assigned-task-info">${expandedTask.type} • ${formatDuration(expandedTask.duration)}</div>
							</div>
						`;
					}).join('')}
				</div>
			</div>
		`;
	}

	slotInfo.innerHTML = `
		<div class="slot-info-row">
			<span class="slot-info-label">Name:</span>
			<input type="text" class="editable-name" id="slotNameInput" value="${slot.name ?? 'Slot'}">
		</div>
		<div class="slot-info-row">
			<span class="slot-info-label">Date:</span>
			<input type="date" class="editable-date" id="slotDateInput" value="${formatDateForInput(viewDate)}">
		</div>
		<div class="slot-info-row">
			<span class="slot-info-label">Start time:</span>
			<input type="time" class="editable-time" id="startTimeInput" value="${minutesToTime(slot.start)}">
		</div>
		<div class="slot-info-row">
			<span class="slot-info-label">End time:</span>
			<input type="time" class="editable-time" id="endTimeInput" value="${minutesToTime(slot.end)}">
		</div>
		<div class="slot-info-row">
			<span class="slot-info-label">Duration:</span>
			<span class="duration-display">${formatDuration(duration)}</span>
		</div>
		${tasksHtml}
	`;

	// Assigned task click → open task editor
	slotInfo.querySelectorAll<HTMLElement>('.assigned-task-item').forEach(item => {
		item.addEventListener('click', () => {
			const idx = parseInt(item.dataset.taskIndex!);
			if (idx >= 0 && idx < tasks.length) {
				closeSideMenu();
				setTimeout(() => {
					import('./taskEditor.js').then(m => m.openTaskEditor(idx));
				}, 100);
			}
		});
	});

	// Name input
	const nameInput = document.getElementById('slotNameInput') as HTMLInputElement;
	function updateSlotName(): void {
		if (!canEditData()) return;
		const newName = nameInput.value.trim();
		if (newName) { slot.name = newName; renderGrid(); }
		saveStore();
	}
	nameInput.addEventListener('blur', updateSlotName);
	nameInput.addEventListener('keypress', e => { if (e.key === 'Enter') nameInput.blur(); });

	// Date input
	const dateInput = document.getElementById('slotDateInput') as HTMLInputElement;
	dateInput.addEventListener('change', async () => {
		if (!canEditData()) return;
		if (!dateInput.value) return;
		const newDate = new Date(dateInput.value);
		if (isNaN(newDate.getTime())) return;

		const oldKey = isoDateKey(viewDate);
		const newKey = isoDateKey(newDate);
		const { moveSlotToNewDateTime } = await import('../state/store.js');
		const ok = moveSlotToNewDateTime(slot, oldKey, newKey, slot.start);
		closeSideMenu();
		if (ok) openDay(newDate); else renderGrid();
	});

	// Time inputs
	const startInput = document.getElementById('startTimeInput') as HTMLInputElement;
	const endInput   = document.getElementById('endTimeInput') as HTMLInputElement;
	function updateSlotTimes(): void {
		if (!canEditData()) return;
		const s = parseTimeInput(startInput.value);
		const en = parseTimeInput(endInput.value);
		if (s !== null && en !== null && en > s) {
			slot.start = s;
			slot.end   = en;
			const durDisplay = slotInfo.querySelector<HTMLElement>('.duration-display');
			if (durDisplay) durDisplay.textContent = formatDuration(slot.end - slot.start);
			renderGrid();
		} else {
			startInput.value = minutesToTime(slot.start);
			endInput.value   = minutesToTime(slot.end);
		}
		saveStore();
	}
	startInput.addEventListener('change', updateSlotTimes);
	endInput.addEventListener('change', updateSlotTimes);

	// Execution button visibility
	const hasAssignedTasks = assignedTasks.length > 0 && !slot.done;
	startExecutionBtn.style.display = hasAssignedTasks ? 'block' : 'none';
}

// ─── Task-type preference grid ─────────────────────────────────────────────

export function renderTaskTypeGrid(preferences: Record<string, number>): void {
	const container = document.getElementById('taskTypeGrid')!;
	container.innerHTML = '';

	const title = document.createElement('h3');
	title.textContent = 'Préférences des types de tâches';
	container.appendChild(title);

	for (const type of taskTypes) {
		const row = document.createElement('div');
		row.className = 'task-type-row';
		const pref = preferences[type.name] ?? 0.0;

		row.innerHTML = `
			<div class="task-type-info">
				<div class="task-type-color" style="background-color: ${type.color}"></div>
				<div class="task-type-name">${type.name}</div>
			</div>
			<input type="range" class="task-type-slider" min="0" max="1" step="0.05" value="${pref}" data-type="${type.name}">
			<div class="task-preference-value">${Math.round(pref * 100)}%</div>
		`;

		const slider  = row.querySelector<HTMLInputElement>('.task-type-slider')!;
		const display = row.querySelector<HTMLElement>('.task-preference-value')!;

		slider.addEventListener('input', () => {
			if (!canEditData()) return;
			const value = parseFloat(slider.value);
			display.textContent = `${Math.round(value * 100)}%`;
			if (currentEditingSlot) {
				currentEditingSlot.taskPreferences[type.name] = value;
				saveStore();
				renderGrid();
			}
		});

		container.appendChild(row);
	}
}

// ─── Delete / empty ────────────────────────────────────────────────────────

function deleteSlot(): void {
	if (!canEditData()) return;
	if (!currentEditingSlot) return;

	const key = isoDateKey(viewDate);
	const daySlots = store[key];
	if (daySlots) {
		const idx = daySlots.indexOf(currentEditingSlot);
		if (idx > -1) daySlots.splice(idx, 1);
	}

	completions.delete(currentEditingSlot);
	closeSideMenu();
	setCurrentEditingSlot(null);
	renderGrid();
	updatePlacementButtonsState();
	saveStore();
}

function emptySlot(): void {
	if (!canEditData()) return;
	if (!currentEditingSlot) return;
	emptySlotCompletions(currentEditingSlot);
	updateSlotInfo(currentEditingSlot);
	renderGrid();
	renderTaskList();
	updatePlacementButtonsState();
}

// ─── Event listeners ───────────────────────────────────────────────────────

closeMenuBtn.addEventListener('click', e => { e.stopPropagation(); closeSideMenu(); });
deleteSlotBtn.addEventListener('click', deleteSlot);
emptySlotBtn.addEventListener('click', emptySlot);
startExecutionBtn.addEventListener('click', e => {
	e.stopPropagation();
	if (currentEditingSlot) startExecution(currentEditingSlot);
});

// Close on outside click
document.addEventListener('click', async e => {
	const { isCreatingNewSlot } = await import('./slotCreation.js'); // dynamic to avoid cycles
	if (
		slotMenu.classList.contains('open') &&
		!slotMenu.contains(e.target as Node) &&
		!isCreatingNewSlot
	) {
		closeSideMenu();
		e.stopPropagation();
	}
});
