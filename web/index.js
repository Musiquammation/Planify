const hourHeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--hour-height')) || 60;
const grid = document.getElementById('grid');
const slotLayer = document.getElementById('slotLayer');
const timesCol = document.getElementById('timesCol');
const dateTitle = document.getElementById('dateTitle');
const prevBtn = document.getElementById('prev');
const nextBtn = document.getElementById('next');

const slotMenu = document.getElementById('sideMenu');
const closeMenu = document.getElementById('closeMenu');
const slotInfo = document.getElementById('slotInfo');

const openTaskPannelBtn = document.getElementById('openTaskPannelBtn');
const taskPanel = document.getElementById('taskPanel');
const taskList = document.getElementById('taskList');
const addTaskBtn = document.getElementById('addTaskBtn');

const taskEditor = document.getElementById('taskEditor');
const taskEditorTitle = document.getElementById('taskEditorTitle');
const closeTaskEditor = document.getElementById('closeTaskEditor');
const taskName = document.getElementById('taskName');
const taskDuration = document.getElementById('taskDuration');
const taskType = document.getElementById('taskType');
const saveTaskBtn = document.getElementById('saveTaskBtn');
const cancelTaskBtn = document.getElementById('cancelTaskBtn');
const deleteTaskBtn = document.getElementById('deleteTaskBtn');

const settingsBtn = document.getElementById('settingsBtn');
const settingsPanel = document.getElementById('settingsPanel');
const closeSettingsPanel = document.getElementById('closeSettingsPanel');
const taskTypesList = document.getElementById('taskTypesList');
const addTypeBtn = document.getElementById('addTypeBtn');

const placeTasksBtn = document.getElementById('placeTasksBtn');
const removePlacementTasksBtn = document.getElementById('removePlacementTasksBtn');
const algoLoading = document.getElementById('algoLoading');
const cancelAlgoBtn = document.getElementById('cancelAlgoBtn');

const taskBornline = document.getElementById('taskBornline');
const taskDeadline = document.getElementById('taskDeadline');
const toggleBornlineBtn = document.getElementById('toggleBornlineBtn');
const toggleDeadlineBtn = document.getElementById('toggleDeadlineBtn');

const completions = new Map();

const DEFAULT_PREFERENCE = 0.5;
const DEFAULT_SLOT_COLOR = '#4f46e5';
const MIN_TASK_DURATION = 10;
const MIN_FRAGMENT_DURATION = 5;


let viewDate = new Date();
viewDate.setHours(0,0,0,0);
let store = {};
const tasks = [];
let editingTaskIndex = -1;
let currentEditingSlot = null;
let isCreatingNewSlot = false;

// Ajouter après les variables existantes :
let isDraggingSlot = false;
let draggedSlot = null;
let draggedSlotElement = null;
let slotDragOffset = { x: 0, y: 0 };



function canEditData() {
	return window.isRunningAlgo === false;
}



function registerStores() {
	localStorage.setItem('stores', JSON.stringify(store));
}

function registerTasks() {
	localStorage.setItem('tasks', JSON.stringify(tasks));
}

function registerTypes() {
	localStorage.setItem('types', JSON.stringify(taskTypes));
}

function loadData() {
	tasks.length = 0;

	let obj = localStorage.getItem('stores');
	store = obj ? JSON.parse(obj) : {};
	
	obj = localStorage.getItem('tasks');
	if (obj) {
		for (let t of JSON.parse(obj)) {
			tasks.push(t);
		}
	}

	obj = localStorage.getItem('types');
	if (obj) {
		taskTypes.length = 0;
		for (let t of JSON.parse(obj)) {
			taskTypes.push(t);
		}
	}
}




// Task types
const taskTypes = [
	{name: "(default)", color: "#6b7280"}
];

function isoDateKey(d){ 
	// Utiliser les valeurs locales au lieu d'UTC pour éviter les décalages de fuseau horaire
	const year = d.getFullYear();
	const month = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

function minutesToTime(min){ const h=Math.floor(min/60), m=min%60; return String(h).padStart(2,'0')+':'+String(m).padStart(2,'0'); }

function formatDuration(minutes) {
	const hours = Math.floor(minutes / 60);
	const mins = minutes % 60;
	
	if (hours === 0) {
		return `${mins}min`;
	} else if (mins === 0) {
		return `${hours}h`;
	} else {
		return `${hours}h${mins.toString().padStart(2, '0')}`;
	}
}

// Ajouter cette fonction après les fonctions utilitaires existantes :
function getSlotColor(slot) {
	if (!slot.taskPreferences) return DEFAULT_SLOT_COLOR; // Pas de prefs => couleur par défaut
	
	const preferenceEntries = Object.entries(slot.taskPreferences);
	if (preferenceEntries.length === 0) return DEFAULT_SLOT_COLOR;

	let maxScore = -Infinity;
	let dominantType = null;
	let isTie = false; // Pour détecter si 2 types ont le même score max

	// Trouver le type avec le score le plus élevé
	preferenceEntries.forEach(([typeName, score]) => {
		if (score > maxScore) {
			maxScore = score;
			dominantType = typeName;
			isTie = false; // Nouveau max trouvé
		} else if (score === maxScore) {
			isTie = true; // Égalité détectée
		}
	});

	// Si égalité parfaite -> couleur par défaut
	if (isTie || maxScore <= 0) {
		return DEFAULT_SLOT_COLOR;
	}

	// Sinon, couleur du type dominant
	const typeObj = taskTypes.find(type => type.name === dominantType);
	return typeObj ? typeObj.color : DEFAULT_SLOT_COLOR;
}


function parseTimeInput(timeStr) {
	const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
	if (!match) return null;
	
	const hours = parseInt(match[1]);
	const minutes = parseInt(match[2]);
	
	if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
	
	return hours * 60 + minutes;
}

// Initialize task type select
function initTaskTypes(){
	taskType.innerHTML = '';
	taskTypes.forEach(type => {
		const option = document.createElement('option');
		option.value = type.name;
		option.textContent = type.name;
		taskType.appendChild(option);
	});
}

// Initialize times
function initTimes(){
	if(timesCol.children.length) return;
	for(let h=0; h<24; h++){
		const div=document.createElement('div');
		div.className='hour';
		div.textContent=(h%24).toString().padStart(2,'0')+":00";
		timesCol.appendChild(div);
	}
}

// Render task list
function renderTaskList(){
	taskList.innerHTML = '';
	
	const placedTasksSet = new Set();
	completions.forEach((expandedTaskList) => {
		expandedTaskList.forEach(expandedTask => {
			placedTasksSet.add(expandedTask.reference);
		});
	});
	
	const now = new Date();
	
	tasks.forEach((task, index) => {
		const taskItem = document.createElement('div');
		taskItem.className = 'task-item';
		
		if (placedTasksSet.has(task)) {
			taskItem.classList.add('placed');
		}
		
		const taskTypeObj = taskTypes.find(t => t.name === task.type) || taskTypes[0];
		taskItem.style.borderLeftColor = taskTypeObj.color;
		
		// Icône de fragmentation
		const fragmentIcon = task.fragmentation ? '<span class="fragment-icon">F</span>' : '';
		
		// Indicateurs de dates
		let dateIndicators = '';
		
		if (task.bornline) {
			const bornlineDate = new Date(task.bornline);
			if (bornlineDate > now) {
				const dateStr = bornlineDate.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
				const timeStr = bornlineDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
				dateIndicators += `<span class="date-indicator bornline-future">📅 ${dateStr} ${timeStr}</span>`;
			}
		}
		
		if (task.deadline) {
			const deadlineDate = new Date(task.deadline);
			const timeUntilDeadline = deadlineDate - now;
			const daysUntilDeadline = Math.floor(timeUntilDeadline / (1000 * 60 * 60 * 24));
			
			const dateStr = deadlineDate.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
			const timeStr = deadlineDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
			
			if (timeUntilDeadline < 0) {
				dateIndicators += `<span class="date-indicator deadline-overdue">⚠️ Échue</span>`;
			} else if (daysUntilDeadline === 0) {
				dateIndicators += `<span class="date-indicator deadline-today">⏰ ${timeStr}</span>`;
			} else if (daysUntilDeadline <= 1) {
				dateIndicators += `<span class="date-indicator deadline-urgent">🔴 ${dateStr} ${timeStr}</span>`;
			} else if (daysUntilDeadline <= 3) {
				dateIndicators += `<span class="date-indicator deadline-soon">🟡 ${dateStr} ${timeStr}</span>`;
			} else if (daysUntilDeadline <= 7) {
				dateIndicators += `<span class="date-indicator deadline-normal">🟢 ${dateStr} ${timeStr}</span>`;
			} else {
				dateIndicators += `<span class="date-indicator deadline-normal">🟢 ${dateStr} ${timeStr}</span>`;
			}
		}
		
		taskItem.innerHTML = `
			<div class="task-name">${task.name} ${fragmentIcon}</div>
			<div class="task-duration">${minutesToTime(task.duration)} (${task.duration} min)</div>
			${dateIndicators ? '<div class="task-dates">' + dateIndicators + '</div>' : ''}
		`;
		taskItem.onclick = () => openTaskEditor(index);
		taskList.appendChild(taskItem);
	});
}

// Open task editor
function openTaskEditor(taskIndex = -1){
	if (!canEditData()) return;
	
	editingTaskIndex = taskIndex;
	
	if(taskIndex >= 0){
		// Edit existing task
		const task = tasks[taskIndex];
		taskEditorTitle.textContent = 'Modifier la tâche';
		taskName.value = task.name;
		taskDuration.value = task.duration;
		taskType.value = task.type;
		
		// Bornline
		if (task.bornline) {
			const [date, time] = task.bornline.split('T');
			taskBornline.value = date;
			taskBornlineTime.value = time || '00:00';
			taskBornline.disabled = false;
			taskBornlineTime.disabled = false;
			toggleBornlineBtn.textContent = 'Désactiver';
			toggleBornlineBtn.classList.remove('btn-secondary');
			toggleBornlineBtn.classList.add('btn-primary');
		} else {
			taskBornline.value = '';
			taskBornlineTime.value = '';
			taskBornline.disabled = true;
			taskBornlineTime.disabled = true;
			toggleBornlineBtn.textContent = 'Activer';
			toggleBornlineBtn.classList.remove('btn-primary');
			toggleBornlineBtn.classList.add('btn-secondary');
		}
		
		// Deadline
		if (task.deadline) {
			const [date, time] = task.deadline.split('T');
			taskDeadline.value = date;
			taskDeadlineTime.value = time || '23:59';
			taskDeadline.disabled = false;
			taskDeadlineTime.disabled = false;
			toggleDeadlineBtn.textContent = 'Désactiver';
			toggleDeadlineBtn.classList.remove('btn-secondary');
			toggleDeadlineBtn.classList.add('btn-primary');
		} else {
			taskDeadline.value = '';
			taskDeadlineTime.value = '';
			taskDeadline.disabled = true;
			taskDeadlineTime.disabled = true;
			toggleDeadlineBtn.textContent = 'Activer';
			toggleDeadlineBtn.classList.remove('btn-primary');
			toggleDeadlineBtn.classList.add('btn-secondary');
		}
		
		deleteTaskBtn.style.display = 'block';
	} else {
		// New task
		taskEditorTitle.textContent = 'Nouvelle tâche';
		taskName.value = '';
		taskDuration.value = '60';
		taskType.value = taskTypes[0].name;
		
		// Reset bornline
		taskBornline.value = '';
		taskBornlineTime.value = '';
		taskBornline.disabled = true;
		taskBornlineTime.disabled = true;
		toggleBornlineBtn.textContent = 'Activer';
		toggleBornlineBtn.classList.remove('btn-primary');
		toggleBornlineBtn.classList.add('btn-secondary');
		
		// Reset deadline
		taskDeadline.value = '';
		taskDeadlineTime.value = '';
		taskDeadline.disabled = true;
		taskDeadlineTime.disabled = true;
		toggleDeadlineBtn.textContent = 'Activer';
		toggleDeadlineBtn.classList.remove('btn-primary');
		toggleDeadlineBtn.classList.add('btn-secondary');
		
		deleteTaskBtn.style.display = 'none';
	}
	
	// Rendre la fragmentation
	renderFragmentation();
	
	taskEditor.classList.add('open');
	updateFloatingButtonVisibility();
}

// Close task editor
function closeTaskEditorFunc(){
	taskEditor.classList.remove('open');
	editingTaskIndex = -1;
	
	// Toujours rouvrir le menu des tâches après fermeture de l'éditeur
	setTimeout(() => {
		openTaskPanel();
	}, 100); // Petit délai pour permettre l'animation
}


function renderFragmentation() {
	const container = document.getElementById('fragmentationContainer');
	const currentTask = editingTaskIndex >= 0 ? tasks[editingTaskIndex] : null;
	const duration = parseInt(taskDuration.value) || 0;
	
	if (!currentTask || !currentTask.fragmentation) {
		container.innerHTML = '<button class="btn-secondary" id="addFragmentationBtn" style="width: 100%;">Ajouter une fragmentation</button>';
		document.getElementById('addFragmentationBtn').addEventListener('click', createFragmentation);
		return;
	}
	
	const fragments = currentTask.fragmentation;
	let html = '<div class="fragmentation-list">';
	
	fragments.forEach((frag, index) => {
		html += `
			<div class="fragment-item">
				<span>Partie ${index + 1}:</span>
				<input type="number" class="fragment-input" data-index="${index}" value="${frag}" min="15" step="15">
				<span>min</span>
				<button class="btn-danger fragment-delete-btn" data-index="${index}">×</button>
			</div>
		`;
	});
	
	const sum = fragments.reduce((a, b) => a + b, 0);
	const isValid = sum === duration;
	
	html += `
		<div class="fragment-sum ${isValid ? 'valid' : 'invalid'}">
			Total: ${sum} min ${isValid ? '✓' : `(doit être ${duration})`}
		</div>
		<button class="btn-secondary" id="addFragmentPartBtn" style="width: 100%; margin-top: 8px;">Ajouter une partie</button>
		<button class="btn-danger" id="removeFragmentationBtn" style="width: 100%; margin-top: 8px;">Supprimer la fragmentation</button>
	</div>`;
	
	container.innerHTML = html;
	
	// Event listeners
	document.querySelectorAll('.fragment-input').forEach(input => {
		input.addEventListener('change', (e) => updateFragmentValue(parseInt(e.target.dataset.index), parseInt(e.target.value)));
	});
	
	document.querySelectorAll('.fragment-delete-btn').forEach(btn => {
		btn.addEventListener('click', (e) => deleteFragmentPart(parseInt(e.target.dataset.index)));
	});
	
	document.getElementById('addFragmentPartBtn')?.addEventListener('click', addFragmentPart);
	document.getElementById('removeFragmentationBtn')?.addEventListener('click', removeFragmentation);
}

function createFragmentation() {
	if (!canEditData()) return;
	if (editingTaskIndex < 0) return;
	
	const duration = parseInt(taskDuration.value);
	if (!duration || duration < MIN_TASK_DURATION) {
		alert(`La tâche doit durer au moins ${MIN_TASK_DURATION} minutes pour être fragmentée`);
		return;
	}
	
	const half = Math.floor(duration / 2 / MIN_FRAGMENT_DURATION) * MIN_FRAGMENT_DURATION;
	const remainder = duration - half;
	tasks[editingTaskIndex].fragmentation = [half, remainder];
	
	renderFragmentation();
}

function updateFragmentValue(index, value) {
	if (!canEditData()) return;
	if (editingTaskIndex < 0 || !tasks[editingTaskIndex].fragmentation) return;
	
	if (value < MIN_FRAGMENT_DURATION) value = MIN_FRAGMENT_DURATION;
	tasks[editingTaskIndex].fragmentation[index] = value;
	
	renderFragmentation();
}

function addFragmentPart() {
	if (!canEditData()) return;
	if (editingTaskIndex < 0 || !tasks[editingTaskIndex].fragmentation) return;
	
	tasks[editingTaskIndex].fragmentation.push(MIN_FRAGMENT_DURATION);
	renderFragmentation();
	registerTasks();
}

function deleteFragmentPart(index) {
	if (!canEditData()) return;
	if (editingTaskIndex < 0 || !tasks[editingTaskIndex].fragmentation) return;
	if (tasks[editingTaskIndex].fragmentation.length <= 1) {
		alert('Une fragmentation doit avoir au moins 1 partie');
		return;
	}
	
	tasks[editingTaskIndex].fragmentation.splice(index, 1);
	renderFragmentation();
}


function removeFragmentation() {
	if (!canEditData()) return;
	if (editingTaskIndex < 0) return;
	
	delete tasks[editingTaskIndex].fragmentation;
	renderFragmentation();
	renderTaskList();
}



// Save task
function saveTask(){
	if (!canEditData()) return;
	
	const name = taskName.value.trim();
	const duration = parseInt(taskDuration.value);
	const type = taskType.value;
	
	if(!name || !duration || duration < MIN_FRAGMENT_DURATION){
		alert('Veuillez remplir tous les champs correctement');
		return;
	}
	
	// Récupérer bornline et deadline avec heures
	let bornline = null;
	let deadline = null;
	
	if (!taskBornline.disabled && taskBornline.value) {
		const time = taskBornlineTime.value || '00:00';
		bornline = `${taskBornline.value}T${time}`;
	}
	
	if (!taskDeadline.disabled && taskDeadline.value) {
		const time = taskDeadlineTime.value || '23:59';
		deadline = `${taskDeadline.value}T${time}`;
	}
	
	// Validation des dates
	if (bornline && deadline && bornline >= deadline) {
		alert('La date de début (bornline) doit être strictement avant la date de fin (deadline)');
		return;
	}
	
	const task = {name, duration, type, bornline, deadline};
	
	// Conserver et ajuster la fragmentation si elle existe
	if(editingTaskIndex >= 0 && tasks[editingTaskIndex].fragmentation){
		const fragments = [...tasks[editingTaskIndex].fragmentation];
		let sum = fragments.reduce((a, b) => a + b, 0);
		
		if (sum < duration) {
			const diff = duration - sum;
			fragments[fragments.length - 1] += diff;
			task.fragmentation = fragments;
		} else if (sum > duration) {
			while (sum > duration && fragments.length > 0) {
				const lastIndex = fragments.length - 1;
				const excess = sum - duration;
				
				if (fragments[lastIndex] > excess) {
					fragments[lastIndex] -= excess;
					
					if (fragments[lastIndex] < 15) {
						fragments.splice(lastIndex, 1);
					}
					break;
				} else {
					sum -= fragments[lastIndex];
					fragments.splice(lastIndex, 1);
				}
			}
			
			if (fragments.length > 1) {
				task.fragmentation = fragments;
			}
		} else {
			task.fragmentation = fragments;
		}
	}
	
	if(editingTaskIndex >= 0){
		tasks[editingTaskIndex] = task;
	} else {
		tasks.push(task);
	}
	
	renderTaskList();
	closeTaskEditorFunc();

	registerTasks();
}

// Delete task
function deleteTask(){
	if (!canEditData()) return;
	
	if(editingTaskIndex < 0)
		return;

	const taskToDelete = tasks[editingTaskIndex];
	
	// 1. Supprimer la tâche du array tasks
	tasks.splice(editingTaskIndex, 1);
	
	// 2. Nettoyer les completions - retirer tous les expandedTasks qui référencent cette tâche
	const slotsToUpdate = [];
	completions.forEach((expandedTaskList, slot) => {
		// Filtrer les expandedTasks pour retirer ceux qui référencent la tâche supprimée
		const filteredTasks = expandedTaskList.filter(expandedTask => expandedTask.reference !== taskToDelete);
		
		// Si la liste a changé, marquer le slot pour mise à jour
		if (filteredTasks.length !== expandedTaskList.length) {
			slotsToUpdate.push(slot);
			
			if (filteredTasks.length === 0) {
				// Plus de tâches assignées : supprimer l'entrée de la Map
				completions.delete(slot);
			} else {
				// Mettre à jour avec la liste filtrée
				expandedTaskList.length = 0;
				expandedTaskList.push(...filteredTasks);
			}
		}
	});
	
	
	// 3. Mettre à jour l'affichage
	renderTaskList();
	renderGrid();
	
	// 4. Mettre à jour le menu du slot si ouvert
	if (currentEditingSlot && slotMenu.classList.contains('open')) {
		updateSlotInfo(currentEditingSlot);
	}
	
	// 5. Vérifier l'état des boutons de placement
	updatePlacementButtonsState();
	
	closeTaskEditorFunc();
	registerTasks();
}


// Delete slot
function deleteSlot() {
	if (!canEditData()) return;
	
	if (!currentEditingSlot) return;
	
	const slotName = currentEditingSlot.name || "Ce créneau";
	const hasAssignedTasks = completions.has(currentEditingSlot) && completions.get(currentEditingSlot).length > 0;
	
	// Message de confirmation différent selon s'il y a des tâches assignées
	let confirmMessage = `Êtes-vous sûr de vouloir supprimer "${slotName}" ?`;
	if (hasAssignedTasks) {
		const taskCount = completions.get(currentEditingSlot).length;
		confirmMessage += `\n\nAttention : ce créneau contient ${taskCount} tâche(s) assignée(s) qui seront aussi supprimées du planning.`;
	}
	
	
	// 1. Supprimer du store
	const key = isoDateKey(viewDate);
	if (store[key]) {
		const slotIndex = store[key].indexOf(currentEditingSlot);
		if (slotIndex > -1) {
			store[key].splice(slotIndex, 1);
		}
	}
	
	// 2. Supprimer des completions si présent
	if (completions.has(currentEditingSlot)) {
		completions.delete(currentEditingSlot);
	}
	
	// 3. Fermer le menu
	closeSideMenu();
	currentEditingSlot = null;
	
	// 4. Mettre à jour l'affichage
	renderGrid();
	
	// 5. Mettre à jour l'état des boutons de placement
	updatePlacementButtonsState();

	registerStores();
}

function emptySlot() {
	if (!canEditData()) return;
	
	if (!currentEditingSlot) return;

	const completion = completions.get(currentEditingSlot);
	if (!completion) return;

	completion.length = 0; // empty array

	updateSlotInfo(currentEditingSlot);
	renderGrid();
	renderTaskList();
	updatePlacementButtonsState();
}


// Update floating button visibility
// Remplacer cette fonction :
function updateFloatingButtonVisibility(){
	const anyMenuOpen = taskPanel.classList.contains('open') || 
										 taskEditor.classList.contains('open') || 
										 slotMenu.classList.contains('open') ||
										 settingsPanel.classList.contains('open');
	
	if(anyMenuOpen){
		openTaskPannelBtn.classList.add('hidden');
		settingsBtn.classList.add('hidden');
	} else {
		openTaskPannelBtn.classList.remove('hidden');
		settingsBtn.classList.remove('hidden');
	}
}

// Render grid
// À la fin de la fonction renderGrid(), ajouter :
function renderGrid(){
	slotLayer.innerHTML='';
	const key=isoDateKey(viewDate);
	const daySlots=store[key]||[];
	daySlots.forEach(slot=>{
		const el=document.createElement('div');
		el.className='slot';
		el.dataset.start=slot.start;
		el.dataset.end=slot.end;
		el.style.top=(slot.start/60*hourHeight+6)+'px';
		el.style.height=Math.max(28,(slot.end-slot.start)/60*hourHeight-6)+'px';
		el.style.left='6px'; el.style.right='6px';
		el.style.cursor='pointer';
		
		// Appliquer la couleur basée sur les préférences
		const slotColor = getSlotColor(slot);
		el.style.borderLeftColor = slotColor;
		el.style.background = `linear-gradient(90deg, ${slotColor}16, ${slotColor}08)`;
		
		el.innerHTML=`<div class="title">${slot.name || "Créneau"}</div><div class="time">${minutesToTime(slot.start)} — ${minutesToTime(slot.end)}</div>`;

		// Événements de drag
		el.addEventListener('mousedown', (e) => startSlotDrag(e, slot, el));
		el.addEventListener('touchstart', (e) => startSlotDrag(e, slot, el), {passive: false});

		slotLayer.appendChild(el);
	});
	
	// Appeler showCompletions après avoir créé tous les slots
	showCompletions();
}

// Open slot menu
function openSlotMenu(slot){
	if(slotMenu.classList.contains('open') || taskPanel.classList.contains('open') || taskEditor.classList.contains('open') || settingsPanel.classList.contains('open')) return; // Ajouter settingsPanel.classList.contains('open')
	
	currentEditingSlot = slot;
	
	// Initialiser les préférences si elles n'existent pas
	if(!slot.taskPreferences) {
		slot.taskPreferences = {};
		taskTypes.forEach(type => {
			slot.taskPreferences[type.name] = DEFAULT_PREFERENCE;
		});
	}
	
	updateSlotInfo(slot);
	renderTaskTypeGrid(slot.taskPreferences);
	slotMenu.classList.add('open');
	updateFloatingButtonVisibility(); // Ajouter cette ligne
}

function formatDateForInput(d) {
	const year = d.getFullYear();
	const month = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

function updateSlotInfo(slot) {
	const duration = slot.end - slot.start;
	
	// Récupérer les tâches assignées à ce slot (ce sont des expandedTasks)
	const assignedTasks = completions.get(slot) || [];
	
	let tasksHtml = '';
	if (assignedTasks.length > 0) {
		tasksHtml = `
			<div class="assigned-tasks-section">
				<h4>Tâches assignées</h4>
				<div class="assigned-tasks-list">
					${assignedTasks.map((expandedTask, index) => {
						const taskTypeObj = taskTypes.find(t => t.name === expandedTask.type);
						const taskColor = taskTypeObj ? taskTypeObj.color : '#4f46e5';
						// Trouver l'index de la vraie tâche
						const realTaskIndex = tasks.indexOf(expandedTask.reference);
						return `
							<div class="assigned-task-item" data-task-index="${realTaskIndex}" style="border-left-color: ${taskColor}">
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
			<span class="slot-info-label">Nom:</span>
			<input type="text" class="editable-name" id="slotNameInput" value="${slot.name || 'Créneau'}">
		</div>
		<div class="slot-info-row">
			<span class="slot-info-label">Date:</span>
			<input type="date" class="editable-date" id="slotDateInput" value="${formatDateForInput(viewDate)}">
		</div>
		<div class="slot-info-row">
			<span class="slot-info-label">Heure début:</span>
			<input type="time" class="editable-time" id="startTimeInput" value="${minutesToTime(slot.start)}">
		</div>
		<div class="slot-info-row">
			<span class="slot-info-label">Heure fin:</span>
			<input type="time" class="editable-time" id="endTimeInput" value="${minutesToTime(slot.end)}">
		</div>
		<div class="slot-info-row">
			<span class="slot-info-label">Durée:</span>
			<span class="duration-display">${formatDuration(duration)}</span>
		</div>
		${tasksHtml}
	`;
	
	// Ajouter les événements de clic sur les tâches assignées
	const assignedTaskItems = document.querySelectorAll('.assigned-task-item');
	assignedTaskItems.forEach(item => {
		item.addEventListener('click', () => {
			const taskIndex = parseInt(item.dataset.taskIndex);
			if (taskIndex >= 0 && taskIndex < tasks.length) {
				// Fermer le menu du slot et ouvrir l'éditeur de tâche
				closeSideMenu();
				setTimeout(() => {
					openTaskEditor(taskIndex);
				}, 100);
			}
		});
	});
	
	// Événements existants pour le nom
	const slotNameInput = document.getElementById('slotNameInput');
	
	function updateSlotName() {
		if (!canEditData()) return;
	
		const newName = slotNameInput.value.trim();
		if (newName) {
			slot.name = newName;
			renderGrid();
		}

		registerStores();
	}
	
	slotNameInput.addEventListener('blur', updateSlotName);
	slotNameInput.addEventListener('keypress', (e) => {
		if (e.key === 'Enter') {
			e.target.blur();
		}
	});
	
	// Événements pour la date
	const slotDateInput = document.getElementById('slotDateInput');
	
	function updateSlotDate() {
		if (!canEditData()) return;
	
		const newDateStr = slotDateInput.value;
		if (!newDateStr) return;
		
		const newDate = new Date(newDateStr);
		if (isNaN(newDate.getTime())) return;
		
		moveSlotToNewDateTime(slot, newDate, slot.start);
		closeSideMenu();
	}
	
	slotDateInput.addEventListener('change', updateSlotDate);
	
	// Événements pour les heures - utiliser 'change' au lieu de 'blur'
	const startTimeInput = document.getElementById('startTimeInput');
	const endTimeInput = document.getElementById('endTimeInput');
	
	function updateSlotTimes() {
		if (!canEditData()) return;
	
		const startMinutes = parseTimeInput(startTimeInput.value);
		const endMinutes = parseTimeInput(endTimeInput.value);
		
		if (startMinutes !== null && endMinutes !== null && endMinutes > startMinutes) {
			slot.start = startMinutes;
			slot.end = endMinutes;
			
			const newDuration = slot.end - slot.start;
			document.querySelector('.duration-display').textContent = formatDuration(newDuration);
			
			renderGrid();
		} else {
			// Restaurer les valeurs valides
			startTimeInput.value = minutesToTime(slot.start);
			endTimeInput.value = minutesToTime(slot.end);
		}

		registerStores();
	}
	
	// Utiliser 'change' pour les inputs de type time
	startTimeInput.addEventListener('change', updateSlotTimes);
	endTimeInput.addEventListener('change', updateSlotTimes);
}

function closeSideMenu(){ 
	slotMenu.classList.remove('open'); 
	updateFloatingButtonVisibility(); // Ajouter cette ligne
}

// Open task panel
function openTaskPanel(){
	taskPanel.classList.add('open');
	updateFloatingButtonVisibility();
}

// Close task panel
function closeTaskPanelFunc(){
	taskPanel.classList.remove('open');
	updateFloatingButtonVisibility();
}

// Navigation
function openDay(d){
	viewDate=new Date(d); viewDate.setHours(0,0,0,0);
	dateTitle.textContent=viewDate.toLocaleDateString('fr-FR',{weekday:'long', day:'2-digit', month:'long', year:'numeric'});
	renderGrid();
}


// Ajouter cette fonction après les autres fonctions utilitaires :
function showCompletions() {
	// Parcourir tous les slots actuellement affichés
	const slotElements = document.querySelectorAll('.slot');
	
	slotElements.forEach(slotElement => {
		// Retrouver le slot object correspondant via les data attributes
		const start = parseInt(slotElement.dataset.start);
		const end = parseInt(slotElement.dataset.end);
		
		// Trouver le slot object dans le store
		const key = isoDateKey(viewDate);
		const daySlots = store[key] || [];
		const slot = daySlots.find(s => s.start === start && s.end === end);
		
		// Nettoyer les anciennes tâches affichées
		let tasksContainer = slotElement.querySelector('.slot-tasks');
		if (tasksContainer) {
			tasksContainer.remove();
		}

		if (slot && completions.has(slot)) {
			const assignedTasks = completions.get(slot);
			
			// Créer la zone des tâches seulement s'il y en a
			if (assignedTasks.length > 0) {
				tasksContainer = document.createElement('div');
				tasksContainer.className = 'slot-tasks';
				
				// Remplir avec les tâches (qui peuvent être des fragments)
				assignedTasks.forEach(expandedTask => {
					const taskElement = document.createElement('div');
					taskElement.className = 'slot-task';
					taskElement.textContent = expandedTask.name; // Inclut déjà "(i/n)" pour les fragments
					
					// Trouver la couleur du type de tâche
					const taskTypeObj = taskTypes.find(t => t.name === expandedTask.type);
					if (taskTypeObj) {
						taskElement.style.backgroundColor = taskTypeObj.color;
					}
					
					tasksContainer.appendChild(taskElement);
				});
				
				slotElement.appendChild(tasksContainer);
			}
		}
	});
}




// Mettre à jour l'état des boutons de placement selon les completions
function updatePlacementButtonsState() {
	const hasAnyCompletions = completions.size > 0;
	
	if (hasAnyCompletions) {
		// Il y a encore des tâches assignées
		removePlacementTasksBtn.classList.remove("hidden");
		placeTasksBtn.classList.add("hidden");
	} else {
		// Plus aucune tâche assignée
		removePlacementTasksBtn.classList.add("hidden");
		placeTasksBtn.classList.remove("hidden");
	}
}

function renderTaskList(){
	taskList.innerHTML = '';
	
	const placedTasksSet = new Set();
	completions.forEach((expandedTaskList) => {
		expandedTaskList.forEach(expandedTask => {
			placedTasksSet.add(expandedTask.reference);
		});
	});
	
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	
	tasks.forEach((task, index) => {
		const taskItem = document.createElement('div');
		taskItem.className = 'task-item';
		
		if (placedTasksSet.has(task)) {
			taskItem.classList.add('placed');
		}
		
		const taskTypeObj = taskTypes.find(t => t.name === task.type) || taskTypes[0];
		taskItem.style.borderLeftColor = taskTypeObj.color;
		
		// Icône de fragmentation
		const fragmentIcon = task.fragmentation ? '<span class="fragment-icon">F</span>' : '';
		
		// Indicateurs de dates
		let dateIndicators = '';
		
		if (task.bornline) {
			const bornlineDate = new Date(task.bornline);
			bornlineDate.setHours(0, 0, 0, 0);
			if (bornlineDate > today) {
				dateIndicators += '<span class="date-indicator bornline-future">📅 Début: ' + task.bornline + '</span>';
			}
		}
		
		if (task.deadline) {
			const deadlineDate = new Date(task.deadline);
			deadlineDate.setHours(0, 0, 0, 0);
			const daysUntilDeadline = Math.floor((deadlineDate - today) / (1000 * 60 * 60 * 24));
			
			if (daysUntilDeadline < 0) {
				dateIndicators += '<span class="date-indicator deadline-overdue">⚠️ Échue</span>';
			} else if (daysUntilDeadline === 0) {
				dateIndicators += '<span class="date-indicator deadline-today">⏰ Aujourd\'hui</span>';
			} else if (daysUntilDeadline <= 1) {
				dateIndicators += '<span class="date-indicator deadline-urgent">🔴 ' + daysUntilDeadline + 'jour</span>';
			} else if (daysUntilDeadline <= 3) {
				dateIndicators += '<span class="date-indicator deadline-soon">🟡 ' + daysUntilDeadline + 'jours</span>';
			} else if (daysUntilDeadline <= 7) {
				dateIndicators += '<span class="date-indicator deadline-normal">🟢 ' + daysUntilDeadline + 'jours</span>';
			} else {
				dateIndicators += '<span class="date-indicator deadline-normal">🟢 ' + task.deadline + '</span>';
			}
		}
		
		taskItem.innerHTML = `
			<div class="task-name">${task.name} ${fragmentIcon}</div>
			<div class="task-duration">${minutesToTime(task.duration)} (${task.duration} min)</div>
			${dateIndicators ? '<div class="task-dates">' + dateIndicators + '</div>' : ''}
		`;
		taskItem.onclick = () => openTaskEditor(index);
		taskList.appendChild(taskItem);
	});
}


// Event listeners
closeMenu.addEventListener('click', e=>{ e.stopPropagation(); closeSideMenu(); });
prevBtn.addEventListener('click',()=>{ 
	if (!canEditData()) return; // Ajouter cette ligne
	const d=new Date(viewDate); 
	d.setDate(d.getDate()-1); 
	openDay(d); 
});

nextBtn.addEventListener('click',()=>{ 
	if (!canEditData()) return; // Ajouter cette ligne
	const d=new Date(viewDate); 
	d.setDate(d.getDate()+1); 
	openDay(d); 
});
document.getElementById('deleteSlotBtn').addEventListener('click', deleteSlot);
document.getElementById('emptySlotBtn').addEventListener('click', emptySlot);




openTaskPannelBtn.addEventListener('click', e => {
	e.stopPropagation();
	openTaskPanel();
});


addTaskBtn.addEventListener('click', () => {
	taskPanel.classList.remove('open'); // Close task panel first
	openTaskEditor();
});

closeTaskEditor.addEventListener('click', closeTaskEditorFunc);
cancelTaskBtn.addEventListener('click', closeTaskEditorFunc);
saveTaskBtn.addEventListener('click', saveTask);
deleteTaskBtn.addEventListener('click', deleteTask);

// Toggle bornline
// Toggle bornline
toggleBornlineBtn.addEventListener('click', () => {
	if (taskBornline.disabled) {
		// Activer
		taskBornline.disabled = false;
		taskBornlineTime.disabled = false;
		taskBornline.value = formatDateForInput(new Date());
		taskBornlineTime.value = '00:00';
		toggleBornlineBtn.textContent = 'Désactiver';
		toggleBornlineBtn.classList.remove('btn-secondary');
		toggleBornlineBtn.classList.add('btn-primary');
	} else {
		// Désactiver
		taskBornline.disabled = true;
		taskBornlineTime.disabled = true;
		taskBornline.value = '';
		taskBornlineTime.value = '';
		toggleBornlineBtn.textContent = 'Activer';
		toggleBornlineBtn.classList.remove('btn-primary');
		toggleBornlineBtn.classList.add('btn-secondary');
	}
});

// Toggle deadline
toggleDeadlineBtn.addEventListener('click', () => {
	if (taskDeadline.disabled) {
		// Activer
		taskDeadline.disabled = false;
		taskDeadlineTime.disabled = false;
		// Par défaut : dans 7 jours à 23:59
		const defaultDeadline = new Date();
		defaultDeadline.setDate(defaultDeadline.getDate() + 7);
		taskDeadline.value = formatDateForInput(defaultDeadline);
		taskDeadlineTime.value = '23:59';
		toggleDeadlineBtn.textContent = 'Désactiver';
		toggleDeadlineBtn.classList.remove('btn-secondary');
		toggleDeadlineBtn.classList.add('btn-primary');
	} else {
		// Désactiver
		taskDeadline.disabled = true;
		taskDeadlineTime.disabled = true;
		taskDeadline.value = '';
		taskDeadlineTime.value = '';
		toggleDeadlineBtn.textContent = 'Activer';
		toggleDeadlineBtn.classList.remove('btn-primary');
		toggleDeadlineBtn.classList.add('btn-secondary');
	}
});

// Update task type background color when changed
// taskType.addEventListener('change', () => {
//   Background stays fixed as var(--bg)
// });

// Drag functionality (keeping existing drag code)
let isDragging=false, dragStartY=0, selectionEl=null, dragStartMin=0, hasMoved=false;

function pageYFromEvt(e){ if(e.touches && e.touches.length) return e.touches[0].clientY; return e.clientY; }
function clientRectTop(el){ return el.getBoundingClientRect().top + (window.scrollY||window.pageYOffset); }
function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }

function startDrag(e){
	if (!canEditData()) return;

	if(e.type==='mousedown' && e.button!==0) return;
	if(isDraggingSlot) return;
	if(slotMenu.classList.contains('open') || taskPanel.classList.contains('open') || taskEditor.classList.contains('open') || settingsPanel.classList.contains('open')) return;

	if(e.target.closest('.slot')) return; // Ne pas créer de nouveau slot si on clique sur un slot existant

	isDragging=true;
	hasMoved=false;
	const y=pageYFromEvt(e), top=clientRectTop(slotLayer);
	dragStartY=clamp(y-top,0,slotLayer.offsetHeight);
	dragStartMin=Math.floor(dragStartY/hourHeight*60/15)*15;

	selectionEl=document.createElement('div');
	selectionEl.className='selection';
	selectionEl.style.top=(dragStartMin/60*hourHeight+6)+'px';
	selectionEl.style.height='28px';
	selectionEl.style.left='6px';
	selectionEl.style.right='6px';
	selectionEl.innerHTML=`<div style="font-size:12px;padding:4px">${minutesToTime(dragStartMin)} — ${minutesToTime(dragStartMin+60)}</div>`;
	slotLayer.appendChild(selectionEl);

	window.addEventListener('mousemove', onDrag);
	window.addEventListener('mouseup', endDrag);
	window.addEventListener('touchmove', onDrag, {passive:false});
	window.addEventListener('touchend', endDrag);
}

function onDrag(e){
	if(!isDragging) return;
	const y=pageYFromEvt(e), top=clientRectTop(slotLayer);
	const moveDist=Math.abs(y-(dragStartY+top));
	if(moveDist>5) hasMoved=true;
	if(!hasMoved) return;

	e.preventDefault();

	const curY=clamp(y-top,0,slotLayer.offsetHeight);
	const topY=Math.min(dragStartY,curY), bottomY=Math.max(dragStartY,curY);
	const startMin=Math.floor(topY/hourHeight*60/15)*15;
	const endMin=Math.ceil(bottomY/hourHeight*60/15)*15;

	selectionEl.style.top=(startMin/60*hourHeight+6)+'px';
	selectionEl.style.height=Math.max(28,(endMin-startMin)/60*hourHeight-6)+'px';
	selectionEl.innerHTML=`<div style="font-size:12px;padding:4px">${minutesToTime(startMin)} — ${minutesToTime(endMin)}</div>`;
}

function endDrag(e){
	if(!isDragging) return;
	isDragging = false;
	window.removeEventListener('mousemove', onDrag);
	window.removeEventListener('mouseup', endDrag);
	window.removeEventListener('touchmove', onDrag);
	window.removeEventListener('touchend', endDrag);

	e.stopPropagation();
	e.preventDefault();
	const rect = slotLayer.getBoundingClientRect();

	function isOverlapping(slot){
		const key = isoDateKey(viewDate);
		const daySlots = store[key] || [];
		return daySlots.some(s => !(slot.end <= s.start || slot.start >= s.end));
	}

	function addSlot(slot){
		// Initialiser les préférences de tâches ET le nom
		slot.taskPreferences = {};
		slot.name = slot.name || "Créneau"; // Ajouter cette ligne
		taskTypes.forEach(type => {
			slot.taskPreferences[type.name] = DEFAULT_PREFERENCE;
		});
		
		const key = isoDateKey(viewDate);
		if(!store[key]) store[key] = [];
		store[key].push(slot);
		registerStores();
		renderGrid();


		const slotEls = slotLayer.getElementsByClassName('slot');
		const newSlotEl = slotEls[slotEls.length-1];
		newSlotEl.onclick = (ev) => {
			if(slotMenu.classList.contains('open') || taskPanel.classList.contains('open') || taskEditor.classList.contains('open') || settingsPanel.classList.contains('open')) return;
			ev.stopPropagation();
			openSlotMenu(slot);
		};

		isCreatingNewSlot = true;
		openSlotMenu(slot);
		
		// Reset le flag après un court délai
		setTimeout(() => {
			isCreatingNewSlot = false;
		}, 50);
	}

	let targetEl;
	if(e.changedTouches && e.changedTouches.length){
		const touch = e.changedTouches[0];
		targetEl = document.elementFromPoint(touch.clientX, touch.clientY)?.closest('.slot');
	} else {
		targetEl = e.target.closest('.slot');
	}
	if(targetEl){
		if(selectionEl){ selectionEl.remove(); selectionEl = null; }
		return;
	}

	if(slotMenu.classList.contains('open') || taskPanel.classList.contains('open') || taskEditor.classList.contains('open') || settingsPanel.classList.contains('open')){ // Ajouter settingsPanel.classList.contains('open')
		if(selectionEl){ selectionEl.remove(); selectionEl = null; }
		return;
	}

	if(!hasMoved){
		let y;
		if(e.changedTouches && e.changedTouches.length) y = e.changedTouches[0].clientY;
		else y = e.clientY;
		y -= rect.top;

		let minute = Math.floor(y / hourHeight * 60 / 15) * 15;
		minute = clamp(minute, 0, 24*60 - 60);
		const slot = { start: minute, end: minute + 60 };

		if(!isOverlapping(slot)){
			addSlot(slot);
		} else {
			if(selectionEl){ selectionEl.remove(); selectionEl = null; }
		}

	} else {
		const topY = parseFloat(selectionEl.style.top) - 6;
		const height = parseFloat(selectionEl.style.height) + 6;
		let startMin = Math.floor(topY / hourHeight * 60 / 15) * 15;
		let duration = Math.ceil(height / hourHeight * 60 / 15) * 15;
		if(duration < 15) duration = 60;
		startMin = clamp(startMin, 0, 24*60 - 1);
		let endMin = clamp(startMin + duration, startMin + 15, 24*60);
		const slot = { start: startMin, end: endMin };

		if(!isOverlapping(slot)){
			addSlot(slot);
		} else {
			if(selectionEl){ selectionEl.remove(); selectionEl = null; }
		}
	}

	if(selectionEl){ selectionEl.remove(); selectionEl = null; }
}

function startSlotDrag(e, slot, element) {
	if (!canEditData()) return;
	
	if (e.type === 'mousedown' && e.button !== 0) return;
	if (slotMenu.classList.contains('open') || taskPanel.classList.contains('open') || taskEditor.classList.contains('open') || settingsPanel.classList.contains('open')) return;
	
	e.stopPropagation();
	e.preventDefault(); // AJOUTER pour empêcher autres événements
	
	let hasMoved = false;
	const startX = e.touches ? e.touches[0].clientX : e.clientX;
	const startY = e.touches ? e.touches[0].clientY : e.clientY;
	
	const rect = element.getBoundingClientRect();
	slotDragOffset = {
		x: (e.touches ? e.touches[0].clientX : e.clientX) - rect.left,
		y: (e.touches ? e.touches[0].clientY : e.clientY) - rect.top
	};
	
	function onMove(moveEvent) {
		const currentX = moveEvent.touches ? moveEvent.touches[0].clientX : moveEvent.clientX;
		const currentY = moveEvent.touches ? moveEvent.touches[0].clientY : moveEvent.clientY;
		const distance = Math.sqrt(Math.pow(currentX - startX, 2) + Math.pow(currentY - startY, 2));
		
		if (distance > 5 && !hasMoved) {
			hasMoved = true;
			isDraggingSlot = true;
			draggedSlot = slot;
			draggedSlotElement = element;
			element.style.cursor = 'grabbing';
			moveEvent.preventDefault();
		}
		
		if (hasMoved) {
			moveEvent.preventDefault();
			onSlotDrag(moveEvent);
		}
	}
	
	function onEnd(endEvent) {
		window.removeEventListener('mousemove', onMove);
		window.removeEventListener('mouseup', onEnd);
		window.removeEventListener('touchmove', onMove);
		window.removeEventListener('touchend', onEnd);
		
		if (hasMoved) {
			endSlotDrag(endEvent);
		} else {
			// Clic simple - ouvrir le menu
			setTimeout(() => {
				if (!slotMenu.classList.contains('open') && !taskPanel.classList.contains('open') && !taskEditor.classList.contains('open') && !settingsPanel.classList.contains('open')) {
					openSlotMenu(slot);
				}
			}, 10); // Petit délai pour éviter les conflits
		}
		
		element.style.cursor = 'pointer';
		isDraggingSlot = false; // AJOUTER pour nettoyer
		draggedSlot = null;
		draggedSlotElement = null;
	}
	
	window.addEventListener('mousemove', onMove, {passive: false});
	window.addEventListener('mouseup', onEnd);
	window.addEventListener('touchmove', onMove, {passive: false});
	window.addEventListener('touchend', onEnd);
}





// Modifier la fonction onSlotDrag pour mettre à jour les heures en temps réel :
function onSlotDrag(e) {
	if (!isDraggingSlot || !draggedSlotElement) return;
	
	e.preventDefault();
	
	const clientY = e.touches ? e.touches[0].clientY : e.clientY;
	
	// Calculer la nouvelle position en tenant compte de l'offset initial
	const calendarWrap = document.querySelector('.calendar-wrap');
	const calendarRect = calendarWrap.getBoundingClientRect();
	const relativeY = clientY - calendarRect.top + calendarWrap.scrollTop - slotDragOffset.y;
	const newStartMinute = Math.max(0, Math.min(24 * 60 - (draggedSlot.end - draggedSlot.start), Math.floor(relativeY / hourHeight * 60 / 15) * 15));
	const newEndMinute = newStartMinute + (draggedSlot.end - draggedSlot.start);
	
	// Mettre à jour visuellement la position du slot
	draggedSlotElement.style.top = (newStartMinute / 60 * hourHeight + 6) + 'px';
	
	// Mettre à jour l'affichage des heures en temps réel
	const timeDisplay = draggedSlotElement.querySelector('.time');
	if (timeDisplay) {
		timeDisplay.textContent = `${minutesToTime(newStartMinute)} — ${minutesToTime(newEndMinute)}`;
	}
}


// Modifier la fonction endSlotDrag :
function endSlotDrag(e) {
	if (!isDraggingSlot || !draggedSlot || !draggedSlotElement) return;
	
	isDraggingSlot = false;
	
	const clientY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;
	
	// Calculer la nouvelle position en tenant compte de l'offset initial
	const calendarWrap = document.querySelector('.calendar-wrap');
	const calendarRect = calendarWrap.getBoundingClientRect();
	const relativeY = clientY - calendarRect.top + calendarWrap.scrollTop - slotDragOffset.y;
	const duration = draggedSlot.end - draggedSlot.start;
	const newStartMinute = Math.max(0, Math.min(24 * 60 - duration, Math.floor(relativeY / hourHeight * 60 / 15) * 15));
	
	// Vérifier les chevauchements
	const key = isoDateKey(viewDate);
	const daySlots = store[key] || [];
	const newSlot = { start: newStartMinute, end: newStartMinute + duration };
	const hasOverlap = daySlots.some(s => 
		s !== draggedSlot && !(newSlot.end <= s.start || newSlot.start >= s.end)
	);
	
	if (!hasOverlap) {
		// Mettre à jour les données du slot
		draggedSlot.start = newStartMinute;
		draggedSlot.end = newStartMinute + duration;
	}
	
	registerStores();

	// Re-rendre la grille pour finaliser l'affichage
	renderGrid();
	
	// Nettoyer
	draggedSlot = null;
	draggedSlotElement = null;
}


function moveSlotToNewDateTime(slot, newDate, newStartMinute) {
	const duration = slot.end - slot.start;
	const oldKey = isoDateKey(viewDate);
	const newKey = isoDateKey(newDate);
	
	// Valider les nouvelles heures
	if (newStartMinute < 0) newStartMinute = 0;
	if (newStartMinute + duration > 24 * 60) newStartMinute = 24 * 60 - duration;
	
	const newSlot = {
		...slot,
		start: newStartMinute,
		end: newStartMinute + duration
	};
	
	// Vérifier les chevauchements dans le nouveau jour
	const newDaySlots = store[newKey] || [];
	const hasOverlap = newDaySlots.some(s => 
		s !== slot && !(newSlot.end <= s.start || newSlot.start >= s.end)
	);
	
	if (hasOverlap) {
		// Annuler le déplacement en cas de chevauchement
		renderGrid();
		return;
	}
	
	// Supprimer de l'ancien jour
	if (store[oldKey]) {
		const index = store[oldKey].indexOf(slot);
		if (index > -1) {
			store[oldKey].splice(index, 1);
		}
	}
	
	// Ajouter au nouveau jour
	if (!store[newKey]) store[newKey] = [];
	store[newKey].push(newSlot);
	
	registerStores();

	// Si on change de jour, naviguer vers le nouveau jour
	if (oldKey !== newKey) {
		openDay(newDate);
	} else {
		renderGrid();
	}
}



grid.addEventListener('mousedown', startDrag);
grid.addEventListener('touchstart', startDrag, {passive:false});

function renderTaskTypeGrid(preferences) {
	const taskTypeGrid = document.getElementById('taskTypeGrid');
	
	// Vider tout le contenu
	taskTypeGrid.innerHTML = '';
	
	// Recréer le titre
	const title = document.createElement('h3');
	title.textContent = 'Préférences des types de tâches';
	taskTypeGrid.appendChild(title);
	
	taskTypes.forEach(type => {
		const row = document.createElement('div');
		row.className = 'task-type-row';
		
		const preference = preferences[type.name] || 0.0;
		
		row.innerHTML = `
			<div class="task-type-info">
				<div class="task-type-color" style="background-color: ${type.color}"></div>
				<div class="task-type-name">${type.name}</div>
			</div>
			<input type="range" class="task-type-slider" min="0" max="1" step="0.05" value="${preference}" data-type="${type.name}">
			<div class="task-preference-value">${Math.round(preference * 100)}%</div>
		`;
		
		const slider = row.querySelector('.task-type-slider');
		const valueDisplay = row.querySelector('.task-preference-value');
		
		slider.addEventListener('input', () => {
			if (!canEditData()) return;
	
			const value = parseFloat(slider.value);
			valueDisplay.textContent = Math.round(value * 100) + '%';
			if(currentEditingSlot) {
				currentEditingSlot.taskPreferences[type.name] = value;
				// Mettre à jour la couleur du slot en temps réel
				registerStores();
				renderGrid();
			}
		});
		
		taskTypeGrid.appendChild(row);
	});
}

// Render task types list in settings
function renderTaskTypesList() {
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
		
		// Event listeners
		const colorPicker = item.querySelector('.color-picker');
		const nameInput = item.querySelector('input[type="text"]');
		const deleteBtn = item.querySelector('.delete-type-btn');
		
		colorPicker.addEventListener('change', (e) => {
			updateTaskTypeColor(index, e.target.value);
		});
		
		nameInput.addEventListener('blur', (e) => {
			updateTaskTypeName(index, e.target.value.trim());
		});
		
		nameInput.addEventListener('keypress', (e) => {
			if (e.key === 'Enter') {
				e.target.blur();
			}
		});
		
		deleteBtn.addEventListener('click', () => {
			deleteTaskType(index);
		});
		
		taskTypesList.appendChild(item);
	});
}

// Update task type color
function updateTaskTypeColor(index, newColor) {
	if (!canEditData()) return;
	
	const oldColor = taskTypes[index].color;
	taskTypes[index].color = newColor;
	
	// Mettre à jour l'affichage
	registerTypes();
	renderTaskTypesList();
	renderTaskList();
	initTaskTypes();
	renderGrid();
	
	// Mettre à jour le menu des créneaux s'il est ouvert
	if (currentEditingSlot && slotMenu.classList.contains('open')) {
		renderTaskTypeGrid(currentEditingSlot.taskPreferences);
	}
}

// Update task type name
function updateTaskTypeName(index, newName) {
	if (!canEditData()) return;
	
	if (!newName || newName === taskTypes[index].name) return;
	
	// Vérifier que le nom n'existe pas déjà
	if (taskTypes.some((type, i) => i !== index && type.name === newName)) {
		alert('Ce nom de type existe déjà !');
		renderTaskTypesList();
		return;
	}
	
	const oldName = taskTypes[index].name;
	taskTypes[index].name = newName;
	
	// Mettre à jour toutes les tâches avec l'ancien nom
	tasks.forEach(task => {
		if (task.type === oldName) {
			task.type = newName;
		}
	});
	
	// Mettre à jour tous les slots avec l'ancien nom
	Object.keys(store).forEach(dateKey => {
		store[dateKey].forEach(slot => {
			if (slot.taskPreferences && slot.taskPreferences[oldName] !== undefined) {
				slot.taskPreferences[newName] = slot.taskPreferences[oldName];
				delete slot.taskPreferences[oldName];
			}
		});
	});

	registerTypes();
	registerTasks(); // Car les tâches sont aussi modifiées
	registerStores(); // Car les slots sont aussi modifiés
	
	// Mettre à jour l'affichage
	renderTaskTypesList();
	renderTaskList();
	initTaskTypes();
	renderGrid();
	
	// Mettre à jour le menu des créneaux s'il est ouvert
	if (currentEditingSlot && slotMenu.classList.contains('open')) {
		renderTaskTypeGrid(currentEditingSlot.taskPreferences);
	}
}

// Delete task type
function deleteTaskType(index) {
	const typeToDelete = taskTypes[index];
	
	// Vérifier s'il y a des tâches de ce type
	const tasksWithType = tasks.filter(task => task.type === typeToDelete.name);
	if (tasksWithType.length > 0) {
		const confirmDelete = confirm(
			`Attention ! ${tasksWithType.length} tâche(s) de type "${typeToDelete.name}" seront supprimées.\n\nVoulez-vous continuer ?`
		);
		if (!confirmDelete) return;
	}
	
	// Vérifier si des slots auraient tous leurs types à 0% après suppression
	let slotsWithOnlyThisType = [];
	Object.keys(store).forEach(dateKey => {
		store[dateKey].forEach(slot => {
			if (slot.taskPreferences) {
				const otherTypes = Object.keys(slot.taskPreferences).filter(typeName => 
					typeName !== typeToDelete.name && slot.taskPreferences[typeName] > 0
				);
				if (otherTypes.length === 0 && slot.taskPreferences[typeToDelete.name] > 0) {
					slotsWithOnlyThisType.push(slot);
				}
			}
		});
	});
	
	if (slotsWithOnlyThisType.length > 0) {
		alert(`Impossible de supprimer ce type : ${slotsWithOnlyThisType.length} créneau(x) n'auraient plus aucun type avec une préférence > 0%. Modifiez d'abord les préférences de ces créneaux.`);
		return;
	}
	
	// Supprimer le type
	taskTypes.splice(index, 1);
	
	// Supprimer les tâches de ce type
	for (let i = tasks.length - 1; i >= 0; i--) {
		if (tasks[i].type === typeToDelete.name) {
			tasks.splice(i, 1);
		}
	}
	
	// Nettoyer les completions - retirer les tâches de ce type
	completions.forEach((expandedTaskList, slot) => {
		// Filtrer les expandedTasks pour retirer celles du type supprimé
		const filteredTasks = expandedTaskList.filter(expandedTask => expandedTask.type !== typeToDelete.name);
		
		if (filteredTasks.length === 0) {
			// Plus de tâches assignées : supprimer l'entrée de la Map
			completions.delete(slot);
		} else if (filteredTasks.length !== expandedTaskList.length) {
			// La liste a changé : vider et remplir avec les tâches filtrées
			expandedTaskList.length = 0;
			expandedTaskList.push(...filteredTasks);
		}
	});
	
	// Nettoyer les préférences des slots
	Object.keys(store).forEach(dateKey => {
		store[dateKey].forEach(slot => {
			if (slot.taskPreferences && slot.taskPreferences[typeToDelete.name] !== undefined) {
				delete slot.taskPreferences[typeToDelete.name];
			}
		});
	});
	
	registerTypes();
	registerTasks(); // Car des tâches sont supprimées
	registerStores(); // Car les slots sont modifiés
	
	// Mettre à jour l'affichage
	renderTaskTypesList();
	renderTaskList();
	initTaskTypes();
	renderGrid();
	
	// Mettre à jour le menu des créneaux s'il est ouvert
	if (currentEditingSlot && slotMenu.classList.contains('open')) {
		renderTaskTypeGrid(currentEditingSlot.taskPreferences);
	}
	
	// Mettre à jour l'état des boutons de placement
	updatePlacementButtonsState();
}

// Add new task type
function addNewTaskType() {
	if (!canEditData()) return;
	
	const newType = {
		name: `Nouveau type ${taskTypes.length + 1}`,
		color: `#${Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')}`
	};
	
	taskTypes.push(newType);
	
	// Ajouter ce type à tous les slots existants avec une préférence par défaut
	Object.keys(store).forEach(dateKey => {
		store[dateKey].forEach(slot => {
			if (slot.taskPreferences) {
				slot.taskPreferences[newType.name] = DEFAULT_PREFERENCE;
			}
		});
	});
	
	

	registerTypes();
	registerStores(); // Car les slots sont modifiés (nouvelles préférences)
	renderTaskTypesList();
	initTaskTypes();
	
	// Mettre à jour le menu des créneaux s'il est ouvert
	if (currentEditingSlot && slotMenu.classList.contains('open')) {
		renderTaskTypeGrid(currentEditingSlot.taskPreferences);
	}
}

// Open settings panel
function openSettingsPanel() {
	settingsPanel.classList.add('open');
	renderTaskTypesList();
	updateFloatingButtonVisibility();
}

// Close settings panel
function closeSettingsPanelFunc() {
	settingsPanel.classList.remove('open');
	updateFloatingButtonVisibility();
}






// Place tasks functionality
async function placeTasks() {
	// Désactiver le bouton et afficher le loading
	placeTasksBtn.disabled = true;
	
	// Démarrer le compteur de temps écoulé
	const startTime = Date.now();
	let elapsedTime = 0;
	
	// Afficher le loading
	algoLoading.style.display = 'flex';
	
	// Récupérer les éléments une seule fois
	const loadingElapsed = algoLoading.querySelector('.loading-elapsed');
	
	// Mettre à jour seulement le texte du temps écoulé
	function updateElapsedTime() {
		elapsedTime = (Date.now() - startTime) / 1000;
		loadingElapsed.textContent = `Temps écoulé : ${elapsedTime.toFixed(1)}s`;
	}
	
	// Timer pour mettre à jour le temps écoulé
	const timer = setInterval(updateElapsedTime, 100);
	
	try {
		const newCompletions = await runAlgoInWorker(store, tasks, taskTypes);
		
		// Nettoyer le timer
		clearInterval(timer);
		
		// Appliquer les nouvelles completions
		completions.clear();
		newCompletions.forEach((taskList, slot) => {
			completions.set(slot, taskList);
		});
		
		// Mettre à jour l'affichage
		renderGrid();
		renderTaskList();
		
		// Cacher le loading
		algoLoading.style.display = 'none';
		placeTasksBtn.disabled = false;

		// Hide pannels
		closeSideMenu();
		closeTaskPanelFunc();
		closeSettingsPanelFunc();

		removePlacementTasksBtn.classList.remove("hidden");
		placeTasksBtn.classList.add("hidden");

	} catch (error) {
		// Nettoyer le timer
		clearInterval(timer);
		
		console.error(error);
		algoLoading.style.display = 'none';
		placeTasksBtn.disabled = false;
	}
}

function cancelAlgo() {
	if (stopAlgoInWorker()) {
		algoLoading.style.display = 'none';
		placeTasksBtn.disabled = false;
	}
}




function cancelAlgo() {
	if (stopAlgoInWorker()) {
		algoLoading.style.display = 'none';
		placeTasksBtn.disabled = false;
	}
}

function cancelAlgo() {
	if (stopAlgoInWorker()) {
		algoLoading.style.display = 'none';
		placeTasksBtn.disabled = false;
	}
}

// Event listeners for place tasks
placeTasksBtn.addEventListener('click', placeTasks);
cancelAlgoBtn.addEventListener('click', cancelAlgo);

removePlacementTasksBtn.addEventListener('click', () => {
	if (!canEditData()) return;
	// Vider toutes les completions
	completions.clear();
	
	// Mettre à jour l'affichage
	renderGrid();
	renderTaskList();
	
	// Mettre à jour le menu du slot si ouvert
	if (currentEditingSlot && slotMenu.classList.contains('open')) {
		updateSlotInfo(currentEditingSlot);
	}
	
	// Mettre à jour l'état des boutons
	updatePlacementButtonsState();
});







// Close panels on outside click
document.addEventListener('click', e => {
	

	if(slotMenu.classList.contains('open') && !slotMenu.contains(e.target) && !isCreatingNewSlot) {
		closeSideMenu();
		e.stopPropagation();
	}

	if(taskPanel.classList.contains('open') && !taskPanel.contains(e.target) && e.target !== openTaskPannelBtn){
		closeTaskPanelFunc();
		e.stopPropagation();
	}
	
	if (settingsPanel.classList.contains('open') && !settingsPanel.contains(e.target) && e.target !== settingsBtn) {
		closeSettingsPanelFunc();
		e.stopPropagation();
	}
});





// Ajoutez après les autres event listeners

// Settings event listeners
settingsBtn.addEventListener('click', e => {
	e.stopPropagation();
	openSettingsPanel();
});

closeSettingsPanel.addEventListener('click', e => {
	e.stopPropagation();
	closeSettingsPanelFunc();
});

addTypeBtn.addEventListener('click', addNewTaskType);

taskDuration.addEventListener('change', () => {
	if (editingTaskIndex >= 0) {
		renderFragmentation();
	}
});







































// Ajouter cette fonction pour tester le système de completions
function initTest(kind=0) {
	store = {};
	tasks.length = 0;
	taskTypes.length = 0;

	if (kind === 0) {
		taskTypes.length = 0;
		taskTypes.push(
			{name: "Maths", color: "#3b82f6"},
			{name: "Français", color: "#10b981"},
			{name: "Histoire", color: "#f59e0b"},
			{name: "Sciences", color: "#8b5cf6"},
			{name: "Sport", color: "#ef4444"},
			{name: "Musique", color: "#06b6d4"},
			{name: "Art", color: "#f97316"},
			{name: "Pause", color: "#6b7280"}
		);

		const testTasks = [
			{name: "t0", duration: 5*15, type: "Maths"},
			{name: "t1", duration: 4*15, type: "Maths"},
			{name: "t2", duration: 4*15, type: "Maths"},
			{name: "t3", duration: 4*15, type: "Maths"},
			{name: "t4", duration: 3*15, type: "Maths"},
			{name: "t5", duration: 2*15, type: "Maths"},
			{name: "t6", duration: 2*15, type: "Maths"},
			{name: "t7", duration: 1*15, type: "Maths"},
			{name: "t8", duration: 1*15, type: "Maths"},
			{name: "t9", duration: 1*15, type: "Maths"},
		];

		tasks.push(...testTasks);
		const key = isoDateKey(viewDate);
		if (!store[key]) store[key] = [];

		const slot1 = {
			start: 9 * 60, // 9h00
			end: 12 * 60, // 12h00 - Slot de 3h pour tester beaucoup de tâches
			name: "Session Intensive",
			taskPreferences: {
				"Maths": 0.8,
				"Français": 0.7,
				"Histoire": 0.6,
				"Sciences": 0.9,
				"Sport": 0.2,
				"Musique": 0.3,
				"Art": 0.4,
				"Pause": 0.5
			}
		};
		
		const slot2 = {
			start: 14 * 60, // 14h00
			end: 16 * 60, // 16h00
			name: "Session Après-midi",
			taskPreferences: {
				"Maths": 0.2,
				"Français": 0.7,
				"Histoire": 0.9,
				"Sciences": 0.4,
				"Sport": 0.3,
				"Musique": 0.6,
				"Art": 0.8,
				"Pause": 0.2
			}
		};
		
		const slot3 = {
			start: 17 * 60, // 17h00
			end: 18 * 60 + 30, // 18h30
			name: "Session Sport",
			taskPreferences: {
				"Maths": 0.1,
				"Français": 0.1,
				"Histoire": 0.1,
				"Sciences": 0.2,
				"Sport": 0.9,
				"Musique": 0.3,
				"Art": 0.2,
				"Pause": 0.4
			}
		};

		store[key].push(slot1, slot2, slot3);
		

	} else if (kind === 1) {
		taskTypes.length = 0;
		taskTypes.push(
			{name: "Maths", color: "#3b82f6"},
			{name: "Français", color: "#10b981"},
			{name: "Histoire", color: "#f59e0b"},
			{name: "Sciences", color: "#8b5cf6"},
			{name: "Sport", color: "#ef4444"},
			{name: "Musique", color: "#06b6d4"},
			{name: "Art", color: "#f97316"},
			{name: "Pause", color: "#6b7280"}
		);

		const testTasks = [
			// Maths
			{ name: "Algèbre avancée", duration: 60, type: "Maths" },
			{ name: "Analyse", duration: 55, type: "Maths" },
			{ name: "Équations différentielles", duration: 50, type: "Maths" },
			{ name: "Probabilités", duration: 45, type: "Maths" },
			{ name: "Statistiques", duration: 40, type: "Maths" },
			{ name: "Géométrie avancée", duration: 35, type: "Maths" },
			{ name: "Topologie", duration: 60, type: "Maths" },
			{ name: "Logique mathématique", duration: 55, type: "Maths" },
			{ name: "Calcul matriciel", duration: 50, type: "Maths" },

			// Français
			{ name: "Lecture approfondie", duration: 45, type: "Français" },
			{ name: "Rédaction d'essai", duration: 60, type: "Français" },
			{ name: "Analyse de texte", duration: 40, type: "Français" },
			{ name: "Commentaire composé", duration: 55, type: "Français" },
			{ name: "Dissertation", duration: 60, type: "Français" },
			{ name: "Résumé de texte", duration: 35, type: "Français" },
			{ name: "Exposé oral", duration: 50, type: "Français" },

			// Sciences
			{ name: "Projet physique", duration: 60, type: "Sciences" },
			{ name: "TP chimie", duration: 55, type: "Sciences" },
			{ name: "Expériences biologie", duration: 50, type: "Sciences" },
			{ name: "Mécanique", duration: 45, type: "Sciences" },
			{ name: "Électromagnétisme", duration: 60, type: "Sciences" },
			{ name: "Thermodynamique", duration: 55, type: "Sciences" },
			{ name: "Génétique", duration: 40, type: "Sciences" },
			{ name: "Astrophysique", duration: 60, type: "Sciences" },

			// Histoire
			{ name: "Antiquité approfondie", duration: 40, type: "Histoire" },
			{ name: "Révolutions modernes", duration: 55, type: "Histoire" },
			{ name: "Moyen Âge", duration: 45, type: "Histoire" },
			{ name: "Première Guerre mondiale", duration: 60, type: "Histoire" },
			{ name: "Seconde Guerre mondiale", duration: 60, type: "Histoire" },
			{ name: "Guerre froide", duration: 55, type: "Histoire" },
			{ name: "Histoire contemporaine", duration: 50, type: "Histoire" },

			// Art
			{ name: "Peinture grand format", duration: 55, type: "Art" },
			{ name: "Sculpture", duration: 60, type: "Art" },
			{ name: "Dessin technique", duration: 50, type: "Art" },
			{ name: "Croquis", duration: 40, type: "Art" },
			{ name: "Calligraphie", duration: 45, type: "Art" },
			{ name: "Art moderne", duration: 60, type: "Art" },
			{ name: "Histoire de l’art", duration: 55, type: "Art" },

			// Sport
			{ name: "Entraînement intensif", duration: 60, type: "Sport" },
			{ name: "Cardio prolongé", duration: 55, type: "Sport" },
			{ name: "Musculation complète", duration: 60, type: "Sport" },
			{ name: "Natation", duration: 50, type: "Sport" },
			{ name: "Yoga avancé", duration: 40, type: "Sport" },
			{ name: "Boxe", duration: 60, type: "Sport" },
			{ name: "Football", duration: 60, type: "Sport" }
		];


		tasks.push(...testTasks);


		// Jour 1 (aujourd'hui)
		{
			const key = isoDateKey(viewDate);
			if (!store[key]) store[key] = [];

			store[key].push(
				{
					start: 8 * 60,
					end: 12 * 60,
					name: "Sciences (Jour 1)",
					taskPreferences: { "Sciences": 0.9, "Maths": 0.6, "Pause": 0.3 }
				},
				{
					start: 13 * 60 + 30,
					end: 17 * 60 + 30,
					name: "Lettres (Jour 1)",
					taskPreferences: { "Français": 0.9, "Histoire": 0.7, "Art": 0.4 }
				},
				{
					start: 18 * 60,
					end: 19 * 60 + 30,
					name: "Sport (Jour 1)",
					taskPreferences: { "Sport": 0.9, "Pause": 0.5 }
				}
			);
		}

		// Jour 2 (demain)
		{
			let tomorrow = new Date(viewDate);
			tomorrow.setDate(tomorrow.getDate() + 1);
			const key = isoDateKey(tomorrow);
			if (!store[key]) store[key] = [];

			store[key].push(
				{
					start: 8 * 60,
					end: 12 * 60,
					name: "Sciences (Jour 2)",
					taskPreferences: { "Sciences": 0.9, "Maths": 0.6, "Pause": 0.3 }
				},
				{
					start: 13 * 60 + 30,
					end: 17 * 60 + 30,
					name: "Lettres (Jour 2)",
					taskPreferences: { "Français": 0.9, "Histoire": 0.7, "Art": 0.4 }
				},
				{
					start: 18 * 60,
					end: 19 * 60 + 30,
					name: "Sport (Jour 2)",
					taskPreferences: { "Sport": 0.9, "Pause": 0.5 }
				}
			);
		}

		// Jour 3 (après-demain)
		/*{
			let afterTomorrow = new Date(viewDate);
			afterTomorrow.setDate(afterTomorrow.getDate() + 2);
			const key = isoDateKey(afterTomorrow);
			if (!store[key]) store[key] = [];

			store[key].push(
				{
					start: 8 * 60,
					end: 12 * 60,
					name: "Sciences (Jour 3)",
					taskPreferences: { "Sciences": 0.9, "Maths": 0.6, "Pause": 0.3 }
				},
				{
					start: 13 * 60 + 30,
					end: 17 * 60 + 30,
					name: "Lettres (Jour 3)",
					taskPreferences: { "Français": 0.9, "Histoire": 0.7, "Art": 0.4 }
				},
				{
					start: 18 * 60,
					end: 19 * 60 + 30,
					name: "Sport (Jour 3)",
					taskPreferences: { "Sport": 0.9, "Pause": 0.5 }
				}
			);
		}*/

	}


	renderTaskList();
	openDay(viewDate);
	updateFloatingButtonVisibility();

	registerStores();
	registerTasks();
	registerTypes();

}










// Initialize
loadData();
initTaskTypes();
initTimes();
renderTaskList();
openDay(viewDate);
updateFloatingButtonVisibility();

// Centrer la vue sur 8h00 au chargement
setTimeout(() => {
	const calendarWrap = document.querySelector('.calendar-wrap');
	const targetScroll = 8 * hourHeight; // 8h * hauteur d'une heure
	calendarWrap.scrollTop = targetScroll;
}, 100);


