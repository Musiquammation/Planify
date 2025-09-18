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
const taskPanelContent = document.getElementById('taskPanelContent');


let viewDate = new Date();
viewDate.setHours(0,0,0,0);
const store = {};

function isoDateKey(d){ return d.toISOString().slice(0,10); }
function minutesToTime(min){ const h=Math.floor(min/60), m=min%60; return String(h).padStart(2,'0')+':'+String(m).padStart(2,'0'); }

// --- Initialisation des heures ---
function initTimes(){
	if(timesCol.children.length) return;
	for(let h=0; h<24; h++){
		const div=document.createElement('div');
		div.className='hour';
		div.textContent=(h%24).toString().padStart(2,'0')+":00";
		timesCol.appendChild(div);
	}
}

// --- Render créneaux ---
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
		el.innerHTML=`<div class="title">Créneau</div><div class="time">${minutesToTime(slot.start)} — ${minutesToTime(slot.end)}</div>`;

		el.onclick = (ev) => {
        if(slotMenu.classList.contains('open') || taskPanel.classList.contains('open')) return;
        ev.stopPropagation();
        openSlotMenu(slot);
    };

		slotLayer.appendChild(el);
	});
}

// --- Menu slot ---
function openMenu(slot){
	slotInfo.innerHTML=`<p><strong>Heure début:</strong> ${minutesToTime(slot.start)}</p>
											<p><strong>Heure fin:</strong> ${minutesToTime(slot.end)}</p>`;
	slotMenu.classList.add('open');
}
function closeSideMenu(){ slotMenu.classList.remove('open'); }

closeMenu.addEventListener('click', e=>{ e.stopPropagation(); closeSideMenu(); });


// --- Navigation jours ---
function openDay(d){
	viewDate=new Date(d); viewDate.setHours(0,0,0,0);
	dateTitle.textContent=viewDate.toLocaleDateString('fr-FR',{weekday:'long', day:'2-digit', month:'long', year:'numeric'});
	renderGrid();
}
prevBtn.addEventListener('click',()=>{ const d=new Date(viewDate); d.setDate(d.getDate()-1); openDay(d); });
nextBtn.addEventListener('click',()=>{ const d=new Date(viewDate); d.setDate(d.getDate()+1); openDay(d); });

initTimes();
openDay(viewDate);

// --- Clic sur slot ---
slotLayer.addEventListener('click', e=>{
	const slotEl = e.target.closest('.slot');
	if(!slotEl) return;

	// Prevent opening slot menu if task panel is open
	if(taskPanel.classList.contains('open')) return;

	const slot={start:parseInt(slotEl.dataset.start), end:parseInt(slotEl.dataset.end)};
	openMenu(slot);
});


// --- Drag / Click pour créer slot ---
let isDragging=false, dragStartY=0, selectionEl=null, dragStartMin=0, hasMoved=false;

function pageYFromEvt(e){ if(e.touches && e.touches.length) return e.touches[0].clientY; return e.clientY; }
function clientRectTop(el){ return el.getBoundingClientRect().top + (window.scrollY||window.pageYOffset); }
function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }




// --- Fonction pour ouvrir le menu pour un slot ---
function openSlotMenu(slot){
	if(slotMenu.classList.contains('open')) return; // ignore si menu déjà ouvert
	slotInfo.innerHTML = `<p><strong>Heure début:</strong> ${minutesToTime(slot.start)}</p>
												<p><strong>Heure fin:</strong> ${minutesToTime(slot.end)}</p>`;
	slotMenu.classList.add('open');
}


function startDrag(e){
	if(e.type==='mousedown' && e.button!==0) return;
	if(slotMenu.classList.contains('open') || taskPanel.classList.contains('open')) return;
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
	if(e.type==='mousedown' && e.button!==0) return;
	if(slotMenu.classList.contains('open')) return; // ne démarre pas de drag

	if(!isDragging) return;
	const y=pageYFromEvt(e), top=clientRectTop(slotLayer);
	const moveDist=Math.abs(y-(dragStartY+top));
	if(moveDist>5) hasMoved=true;
	if(!hasMoved) return;

	e.preventDefault(); // empêcher scroll uniquement si vrai drag

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

	// --- utilitaire chevauchement ---
	function isOverlapping(slot){
		const key = isoDateKey(viewDate);
		const daySlots = store[key] || [];
		return daySlots.some(s => !(slot.end <= s.start || slot.start >= s.end));
	}

	// --- utilitaire ajout slot ---
	function addSlot(slot){
		const key = isoDateKey(viewDate);
		if(!store[key]) store[key] = [];
		store[key].push(slot);
		renderGrid();

		// Attacher onclick au slot créé
		const slotEls = slotLayer.getElementsByClassName('slot');
		const newSlotEl = slotEls[slotEls.length-1];
		newSlotEl.onclick = (ev) => {
			if(slotMenu.classList.contains('open')) return; // ne rien faire si menu déjà ouvert
			ev.stopPropagation();
			openSlotMenu(slot); // ouvre le menu seulement si menu fermé
		};

		// Ouvrir le menu automatiquement à la création
		openSlotMenu(slot);
	}


	// --- Vérifie si clic sur slot existant ---
	let targetEl;
	if(e.changedTouches && e.changedTouches.length){
		const touch = e.changedTouches[0];
		targetEl = document.elementFromPoint(touch.clientX, touch.clientY)?.closest('.slot');
	} else {
		targetEl = e.target.closest('.slot');
	}
	if(targetEl){
		// Si clic sur slot existant, ne pas ouvrir menu automatiquement
		if(selectionEl){ selectionEl.remove(); selectionEl = null; }
		return;
	}

	// --- Si menu ouvert, annule création ---
	if(slotMenu.classList.contains('open')){
		if(selectionEl){ selectionEl.remove(); selectionEl = null; }
		return;
	}

	// --- clic simple ---
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
		// --- drag ---
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






grid.addEventListener('mousedown', startDrag);
grid.addEventListener('touchstart', startDrag, {passive:false});



// Open the panel
function openTaskPanel(contentHTML = '') {
		taskPanelContent.innerHTML = contentHTML;
		taskPanel.classList.add('open');
		taskPanel.style.transform = 'translateX(0)';
}

// Close the panel
function closeTaskPanelFunc() {
		taskPanel.classList.remove('open');
		taskPanel.style.transform = 'translateX(100%)';
}

// Button event to open
openTaskPannelBtn.addEventListener('click', e => {
		e.stopPropagation(); // prevent creating a slot
		openTaskPanel('<p>Create a new task here!</p>');
});

// Close button
closeTaskPanel.addEventListener('click', e => {
		e.stopPropagation();
		closeTaskPanelFunc();
});

document.addEventListener('click', e => {
	// Close slotMenu if click outside
	if(slotMenu.classList.contains('open') && !slotMenu.contains(e.target)){
		closeSideMenu();
		e.stopPropagation(); // prevent slot creation
	}

	// Close taskPanel if click outside
	if(taskPanel.classList.contains('open') && !taskPanel.contains(e.target) && e.target !== openTaskPannelBtn){
		closeTaskPanelFunc();
		e.stopPropagation(); // prevent slot creation
	}
});
