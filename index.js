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
const closeTaskPanel = document.getElementById('closeTaskPanel');
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

let viewDate = new Date();
viewDate.setHours(0,0,0,0);
const store = {};
const tasks = [];
let editingTaskIndex = -1;
let currentEditingSlot = null;


// Ajouter après les variables existantes :
let isDraggingSlot = false;
let draggedSlot = null;
let draggedSlotElement = null;
let slotDragOffset = { x: 0, y: 0 };

// Task types
const taskTypes = [
  {name: "Maths", color: "#3b82f6"},
  {name: "Français", color: "#10b981"},
  {name: "Histoire", color: "#f59e0b"},
  {name: "Sciences", color: "#8b5cf6"},
  {name: "Sport", color: "#ef4444"},
  {name: "Musique", color: "#06b6d4"},
  {name: "Art", color: "#f97316"},
  {name: "Pause", color: "#6b7280"}
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
  if (!slot.taskPreferences) return '#4f46e5'; // Couleur par défaut (accent)
  
  let maxScore = 0;
  let dominantType = null;
  
  // Trouver le type avec le score le plus élevé
  Object.keys(slot.taskPreferences).forEach(typeName => {
    const score = slot.taskPreferences[typeName];
    if (score > maxScore) {
      maxScore = score;
      dominantType = typeName;
    }
  });
  
  // Si aucun type n'est majoritaire (> 0.5) ou si le score max est 0, couleur par défaut
  if (!dominantType || maxScore <= 0.5) {
    return '#4f46e5'; // Couleur par défaut (accent)
  }
  
  // Trouver la couleur du type dominant
  const typeObj = taskTypes.find(type => type.name === dominantType);
  return typeObj ? typeObj.color : '#4f46e5';
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
  tasks.forEach((task, index) => {
    const taskItem = document.createElement('div');
    taskItem.className = 'task-item';
    const taskTypeObj = taskTypes.find(t => t.name === task.type) || taskTypes[0];
    taskItem.style.borderLeftColor = taskTypeObj.color;
    taskItem.innerHTML = `
      <div class="task-name">${task.name}</div>
      <div class="task-duration">${minutesToTime(task.duration)} (${task.duration} min)</div>
    `;
    taskItem.onclick = () => openTaskEditor(index);
    taskList.appendChild(taskItem);
  });
}

// Open task editor
function openTaskEditor(taskIndex = -1){
  editingTaskIndex = taskIndex;
  
  if(taskIndex >= 0){
    // Edit existing task
    const task = tasks[taskIndex];
    taskEditorTitle.textContent = 'Modifier la tâche';
    taskName.value = task.name;
    taskDuration.value = task.duration;
    taskType.value = task.type;
    deleteTaskBtn.style.display = 'block';
  } else {
    // New task
    taskEditorTitle.textContent = 'Nouvelle tâche';
    taskName.value = '';
    taskDuration.value = '60';
    taskType.value = taskTypes[0].name;
    deleteTaskBtn.style.display = 'none';
  }
  
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
// Save task
function saveTask(){
  const name = taskName.value.trim();
  const duration = parseInt(taskDuration.value);
  const type = taskType.value;
  
  if(!name || !duration || duration < 15){
    alert('Veuillez remplir tous les champs correctement');
    return;
  }
  
  const task = {name, duration, type};
  
  if(editingTaskIndex >= 0){
    tasks[editingTaskIndex] = task;
  } else {
    tasks.push(task);
  }
  
  renderTaskList();
  closeTaskEditorFunc();
}

// Delete task
function deleteTask(){
  if(editingTaskIndex >= 0){
    tasks.splice(editingTaskIndex, 1);
    renderTaskList();
    closeTaskEditorFunc();
  }
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
function renderGrid(){
  slotLayer.innerHTML='';
  const key=isoDateKey(viewDate);
  const daySlots=store[key]||[];
  // Remplacer la création des slots dans renderGrid() :
  // Dans renderGrid(), remplacer la création des slots :
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
    el.style.background = `linear-gradient(90deg, ${slotColor}16, ${slotColor}08)`; // 16 et 08 en hex = 22% et 8% d'opacité
    
    el.innerHTML=`<div class="title">${slot.name || "Créneau"}</div><div class="time">${minutesToTime(slot.start)} — ${minutesToTime(slot.end)}</div>`;

    // Événements de drag
    el.addEventListener('mousedown', (e) => startSlotDrag(e, slot, el));
    el.addEventListener('touchstart', (e) => startSlotDrag(e, slot, el), {passive: false});

    slotLayer.appendChild(el);
  });
}

// Open slot menu
function openSlotMenu(slot){
  if(slotMenu.classList.contains('open') || taskPanel.classList.contains('open') || taskEditor.classList.contains('open') || settingsPanel.classList.contains('open')) return; // Ajouter settingsPanel.classList.contains('open')
  
  currentEditingSlot = slot;
  
  // Initialiser les préférences si elles n'existent pas
  if(!slot.taskPreferences) {
    slot.taskPreferences = {};
    taskTypes.forEach(type => {
      slot.taskPreferences[type.name] = 0.5;
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
      <input type="text" class="editable-time" id="startTimeInput" value="${minutesToTime(slot.start)}">
    </div>
    <div class="slot-info-row">
      <span class="slot-info-label">Heure fin:</span>
      <input type="text" class="editable-time" id="endTimeInput" value="${minutesToTime(slot.end)}">
    </div>
    <div class="slot-info-row">
      <span class="slot-info-label">Durée:</span>
      <span class="duration-display">${formatDuration(duration)}</span>
    </div>
  `;
  
  // Événements pour le nom (inchangés)
  const slotNameInput = document.getElementById('slotNameInput');
  
  function updateSlotName() {
    const newName = slotNameInput.value.trim();
    if (newName) {
      slot.name = newName;
      renderGrid();
    }
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
    const newDateStr = slotDateInput.value;
    if (!newDateStr) return;
    
    const newDate = new Date(newDateStr);
    if (isNaN(newDate.getTime())) return;
    
    moveSlotToNewDateTime(slot, newDate, slot.start);
    closeSideMenu(); // Fermer le menu après déplacement
  }
  
  slotDateInput.addEventListener('change', updateSlotDate);
  
  // Événements pour les heures (inchangés)
  const startTimeInput = document.getElementById('startTimeInput');
  const endTimeInput = document.getElementById('endTimeInput');
  
  function updateSlotTimes() {
    const startMinutes = parseTimeInput(startTimeInput.value);
    const endMinutes = parseTimeInput(endTimeInput.value);
    
    if (startMinutes !== null && endMinutes !== null && endMinutes > startMinutes) {
      slot.start = startMinutes;
      slot.end = endMinutes;
      
      const newDuration = slot.end - slot.start;
      document.querySelector('.duration-display').textContent = formatDuration(newDuration);
      
      renderGrid();
    } else {
      startTimeInput.value = minutesToTime(slot.start);
      endTimeInput.value = minutesToTime(slot.end);
    }
  }
  
  startTimeInput.addEventListener('blur', updateSlotTimes);
  startTimeInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.target.blur();
    }
  });
  
  endTimeInput.addEventListener('blur', updateSlotTimes);
  endTimeInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.target.blur();
    }
  });
}

// Remplacer cette fonction :
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

// Event listeners
closeMenu.addEventListener('click', e=>{ e.stopPropagation(); closeSideMenu(); });
prevBtn.addEventListener('click',()=>{ const d=new Date(viewDate); d.setDate(d.getDate()-1); openDay(d); });
nextBtn.addEventListener('click',()=>{ const d=new Date(viewDate); d.setDate(d.getDate()+1); openDay(d); });

openTaskPannelBtn.addEventListener('click', e => {
  e.stopPropagation();
  openTaskPanel();
});

closeTaskPanel.addEventListener('click', e => {
  e.stopPropagation();
  closeTaskPanelFunc();
});

addTaskBtn.addEventListener('click', () => {
  taskPanel.classList.remove('open'); // Close task panel first
  openTaskEditor();
});

closeTaskEditor.addEventListener('click', closeTaskEditorFunc);
cancelTaskBtn.addEventListener('click', closeTaskEditorFunc);
saveTaskBtn.addEventListener('click', saveTask);
deleteTaskBtn.addEventListener('click', deleteTask);

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
  if(e.type==='mousedown' && e.button!==0) return;
  if(isDraggingSlot) return; // Ajouter cette ligne
  if(slotMenu.classList.contains('open') || taskPanel.classList.contains('open') || taskEditor.classList.contains('open') || settingsPanel.classList.contains('open')) return;

  isDragging=true;
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
      slot.taskPreferences[type.name] = 0.5;
    });
    
    const key = isoDateKey(viewDate);
    if(!store[key]) store[key] = [];
    store[key].push(slot);
    renderGrid();


    const slotEls = slotLayer.getElementsByClassName('slot');
    const newSlotEl = slotEls[slotEls.length-1];
    newSlotEl.onclick = (ev) => {
      if(slotMenu.classList.contains('open') || taskPanel.classList.contains('open') || taskEditor.classList.contains('open') || settingsPanel.classList.contains('open')) return;
      ev.stopPropagation();
      openSlotMenu(slot);
    };

    openSlotMenu(slot);
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


// Ajouter ces nouvelles fonctions après la fonction endDrag() :

// Modifier la fonction startSlotDrag pour détecter le mouvement :
function startSlotDrag(e, slot, element) {
  if (e.type === 'mousedown' && e.button !== 0) return;
  if (slotMenu.classList.contains('open') || taskPanel.classList.contains('open') || taskEditor.classList.contains('open') || settingsPanel.classList.contains('open')) return;
  
  e.stopPropagation();
  e.preventDefault();
  
  let hasMovedForDrag = false; // Ajouter cette variable
  const startX = e.touches ? e.touches[0].clientX : e.clientX;
  const startY = e.touches ? e.touches[0].clientY : e.clientY;
  
  const rect = element.getBoundingClientRect();
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  
  slotDragOffset = {
    x: clientX - rect.left,
    y: clientY - rect.top
  };
  
  function onMove(moveEvent) {
    const currentX = moveEvent.touches ? moveEvent.touches[0].clientX : moveEvent.clientX;
    const currentY = moveEvent.touches ? moveEvent.touches[0].clientY : moveEvent.clientY;
    const distance = Math.sqrt(Math.pow(currentX - startX, 2) + Math.pow(currentY - startY, 2));
    
    if (distance > 5 && !hasMovedForDrag) { // Seuil de 5px pour commencer le drag
      hasMovedForDrag = true;
      isDraggingSlot = true;
      draggedSlot = slot;
      draggedSlotElement = element;
      
      // Pas d'effets visuels bizarres, juste le curseur
      element.style.cursor = 'grabbing';
    }
    
    if (hasMovedForDrag) {
      onSlotDrag(moveEvent);
    }
  }
  
  function onEnd(endEvent) {
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onEnd);
    window.removeEventListener('touchmove', onMove);
    window.removeEventListener('touchend', onEnd);
    
    if (hasMovedForDrag) {
      endSlotDrag(endEvent);
    } else {
      // Clic simple - ouvrir le menu
      if (!slotMenu.classList.contains('open') && !taskPanel.classList.contains('open') && !taskEditor.classList.contains('open') && !settingsPanel.classList.contains('open')) {
        openSlotMenu(slot);
      }
    }
    
    element.style.cursor = 'pointer';
  }
  
  window.addEventListener('mousemove', onMove);
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
    
    const preference = preferences[type.name] || 0.5;
    
    row.innerHTML = `
      <div class="task-type-info">
        <div class="task-type-color" style="background-color: ${type.color}"></div>
        <div class="task-type-name">${type.name}</div>
      </div>
      <input type="range" class="task-type-slider" min="0" max="1" step="0.1" value="${preference}" data-type="${type.name}">
      <div class="task-preference-value">${Math.round(preference * 100)}%</div>
    `;
    
    const slider = row.querySelector('.task-type-slider');
    const valueDisplay = row.querySelector('.task-preference-value');
    
    slider.addEventListener('input', () => {
      const value = parseFloat(slider.value);
      valueDisplay.textContent = Math.round(value * 100) + '%';
      if(currentEditingSlot) {
        currentEditingSlot.taskPreferences[type.name] = value;
        // Mettre à jour la couleur du slot en temps réel
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
  const oldColor = taskTypes[index].color;
  taskTypes[index].color = newColor;
  
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

// Update task type name
function updateTaskTypeName(index, newName) {
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
  
  // Nettoyer les préférences des slots
  Object.keys(store).forEach(dateKey => {
    store[dateKey].forEach(slot => {
      if (slot.taskPreferences && slot.taskPreferences[typeToDelete.name] !== undefined) {
        delete slot.taskPreferences[typeToDelete.name];
      }
    });
  });
  
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

// Add new task type
function addNewTaskType() {
  const newType = {
    name: `Nouveau type ${taskTypes.length + 1}`,
    color: `#${Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')}`
  };
  
  taskTypes.push(newType);
  
  // Ajouter ce type à tous les slots existants avec une préférence par défaut
  Object.keys(store).forEach(dateKey => {
    store[dateKey].forEach(slot => {
      if (slot.taskPreferences) {
        slot.taskPreferences[newType.name] = 0.5;
      }
    });
  });
  
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










// Close panels on outside click
document.addEventListener('click', e => {
  if(slotMenu.classList.contains('open') && !slotMenu.contains(e.target)){
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
const saveSlotBtn = document.getElementById('saveSlotBtn');
saveSlotBtn.addEventListener('click', () => {
  // Les préférences sont déjà sauvegardées en temps réel
  closeSideMenu();
});

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



















// Initialize
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