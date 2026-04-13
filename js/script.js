// script.js - maneja tareas: añadir, borrar, marcar completadas y persistencia en localStorage
const TASKS_KEY = 'tasks_v1';

const taskInput = document.getElementById('taskinput');
const addTaskBtn = document.getElementById('addtaskbtn');
const taskList = document.getElementById('tasklist');
const totalEl = document.getElementById('totaltaks');
const completedEl = document.getElementById('completedtasks');
const pendingEl = document.getElementById('pendingtasks');
const completedPercentEl = document.getElementById('completedPercent');
const progressBar = document.getElementById('progressBar');

let tasks = loadTasks();
let filterState = 'all'; // 'all' | 'completed' | 'pending'

function loadTasks() {
	try {
		const raw = localStorage.getItem(TASKS_KEY);
		const arr = raw ? JSON.parse(raw) : [];
		// Retro-fill createdAt for older entries that lack it
		let mutated = false;
		arr.forEach(t => {
			if (!t.createdAt) {
				t.createdAt = Date.now();
				mutated = true;
			}
			// Ensure pinned exists for older entries
			if (typeof t.pinned === 'undefined') {
				t.pinned = false;
				mutated = true;
			}
		});
		// If we mutated older data, persist back
		if (mutated) {
			try { localStorage.setItem(TASKS_KEY, JSON.stringify(arr)); } catch (e) { /* ignore */ }
		}
		return arr;
	} catch (e) {
		console.error('Error leyendo tareas desde localStorage', e);
		return [];
	}
}

function saveTasks() {
	try {
		localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
	} catch (e) {
		console.error('Error guardando tareas en localStorage', e);
	}
}

function renderTasks() {
	// Vaciar lista antes de renderizar
	taskList.innerHTML = '';

	if (tasks.length === 0) {
		const empty = document.createElement('p');
		empty.textContent = 'No hay tareas. Añade una en el campo arriba.';
		empty.style.opacity = '0.8';
		taskList.appendChild(empty);
		updateStats();
		return;
	}


		// Aplicar filtro antes de renderizar
		let visible = tasks.filter(t => {
			if (filterState === 'all') return true;
			if (filterState === 'completed') return !!t.completed;
			if (filterState === 'pending') return !t.completed;
			return true;
		});

		// Mostrar primero las tareas fijadas
		visible.sort((a, b) => {
			if (a.pinned && !b.pinned) return -1;
			if (!a.pinned && b.pinned) return 1;
			return 0;
		});

		visible.forEach(task => {
		const item = document.createElement('div');
		item.className = 'task-item' + (task.completed ? ' completed' : '');

		const left = document.createElement('div');
		left.className = 'task-left';

		const cb = document.createElement('input');
		cb.type = 'checkbox';
		cb.className = 'task-checkbox';
		cb.checked = !!task.completed;
		cb.dataset.id = task.id;

		const text = document.createElement('span');
		text.textContent = task.text;

		// Fecha de creación (formateada)
		const date = document.createElement('small');
		date.className = 'task-date';
		const created = task.createdAt ? new Date(task.createdAt) : new Date();
		date.textContent = created.toLocaleString();

		left.appendChild(cb);
		left.appendChild(text);
		left.appendChild(date);

		const del = document.createElement('button');
			del.className = 'delete-btn';
			del.textContent = '🗑️';
			del.dataset.id = task.id;
			del.setAttribute('aria-label', 'Borrar tarea');

		// Colocar el botón borrar junto al checkbox (dentro de la columna izquierda)
		// y deshabilitarlo si la tarea NO está completada
		del.disabled = !task.completed;
		del.title = task.completed ? 'Borrar tarea' : 'No puedes borrar una tarea no completada';
		if (!task.completed) del.classList.add('disabled');

		left.insertBefore(del, text);

		// Pin button (fijar)
		const pinBtn = document.createElement('button');
		pinBtn.className = 'pin-btn';
		pinBtn.dataset.id = task.id;
		pinBtn.textContent = task.pinned ? '📌' : '📍';
		pinBtn.title = task.pinned ? 'Desafijar tarea' : 'Fijar tarea';

		item.appendChild(left);
		item.appendChild(pinBtn);

		taskList.appendChild(item);
	});

	updateStats();
}

function updateStats() {
	const total = tasks.length;
	const completed = tasks.filter(t => t.completed).length;
	const pending = total - completed;

	if (totalEl) totalEl.textContent = total;
	if (completedEl) completedEl.textContent = completed;
	if (pendingEl) pendingEl.textContent = pending;
	// calcular porcentaje (redondeado) y mostrar
	if (completedPercentEl) {
		const pctLocal = total === 0 ? 0 : Math.round((completed / total) * 100);
		completedPercentEl.textContent = pctLocal + '%';
		// color dinámico
		completedPercentEl.classList.remove('low','high');
		if (pctLocal < 50) completedPercentEl.classList.add('low');
		else if (pctLocal > 50) completedPercentEl.classList.add('high');
	}
	// actualizar barra de progreso visual y label
	// Re-query DOM nodes here to be resilient if elements are re-created
	const pct = total === 0 ? 0 : Math.round((completed / total) * 100);
	const pb = document.getElementById('progressBar') || progressBar;
	if (pb) {
		// Ensure it's visible and update width/aria
		pb.style.display = 'block';
		pb.style.width = pct + '%';
		pb.setAttribute('aria-valuenow', String(pct));
		pb.classList.toggle('empty', pct === 0);
	}
	const progressLabel = document.getElementById('progressLabel');
	if (progressLabel) {
		progressLabel.textContent = pct + '%';
		progressLabel.classList.remove('low','high');
		if (pct < 50) progressLabel.classList.add('low');
		else if (pct > 50) progressLabel.classList.add('high');
	}

	// Update stats container color based on percentage
	const statsEl = document.querySelector('.task-stats');
	if (statsEl) {
		statsEl.classList.remove('low', 'high');
		if (pct < 50) statsEl.classList.add('low');
		else if (pct > 50) statsEl.classList.add('high');
		// exactly 50% -> neutral (no class)
	}
}

function addTask() {
	const text = taskInput.value.trim();
	if (!text) return;
	if (text.length < 5) {
		alert('La tarea debe tener al menos 5 caracteres.');
		taskInput.focus();
		return;
	}
	// Evitar tareas duplicadas (comparación case-insensitive)
	const exists = tasks.some(t => t.text && t.text.trim().toLowerCase() === text.toLowerCase());
	if (exists) {
		alert('Ya existe una tarea con el mismo texto. Evita duplicados.');
		taskInput.focus();
		return;
	}

	const task = {
		id: Date.now().toString(),
		text,
		completed: false,
		pinned: false,
		createdAt: Date.now(),
	};

	tasks.unshift(task);
	saveTasks();
	renderTasks();
	taskInput.value = '';
	taskInput.focus();
}

// Delegación para borrar y cambiar estado
// Delegación para manejar: pin/unpin, editar, cancelar y borrar
taskList.addEventListener('click', (e) => {
	const pin = e.target.closest('.pin-btn');
	if (pin) {
		const id = pin.dataset.id;
		const task = tasks.find(t => t.id === id);
		if (!task) return;
		task.pinned = !task.pinned;
		saveTasks();
		renderTasks();
		return;
	}

	const editBtn = e.target.closest('.edit-btn');
	if (editBtn) {
		const id = editBtn.dataset.id;
		const task = tasks.find(t => t.id === id);
		const itemEl = editBtn.closest('.task-item');
		if (!task || !itemEl) return;

		// Si estamos en modo edición, este botón actúa como 'Guardar'
		if (editBtn.dataset.mode === 'editing') {
			const input = itemEl.querySelector('.task-edit-input');
			if (!input) { renderTasks(); return; }
			const newText = input.value.trim();
			if (!newText) { alert('La tarea no puede estar vacía.'); input.focus(); return; }
			if (newText.length < 5) { alert('La tarea debe tener al menos 5 caracteres.'); input.focus(); return; }
			const exists = tasks.some(t => t.text && t.text.trim().toLowerCase() === newText.toLowerCase() && t.id !== id);
			if (exists) { alert('Ya existe una tarea con el mismo texto. Evita duplicados.'); input.focus(); return; }

			task.text = newText;
			saveTasks();
			renderTasks();
			return;
		}

		// Iniciar edición: reemplazar el span por un input
		const span = itemEl.querySelector('.task-text');
		if (!span) return;
		const input = document.createElement('input');
		input.type = 'text';
		input.className = 'task-edit-input';
		input.value = task.text;
		span.replaceWith(input);
		input.focus();

		// Cambiar el botón a modo 'Guardar'
		editBtn.textContent = '💾';
		editBtn.dataset.mode = 'editing';

		// Añadir botón cancelar justo después
		const cancel = document.createElement('button');
		cancel.className = 'cancel-btn';
		cancel.textContent = '✖️';
		cancel.dataset.id = id;
		editBtn.insertAdjacentElement('afterend', cancel);

		// Teclas rápidas dentro del input: Enter = guardar, Esc = cancelar
		input.addEventListener('keydown', (ke) => {
			if (ke.key === 'Enter') {
				editBtn.click();
			} else if (ke.key === 'Escape') {
				renderTasks();
			}
		});

		return;
	}

	const cancel = e.target.closest('.cancel-btn');
	if (cancel) {
		// Simplemente re-render para descartar cambios
		renderTasks();
		return;
	}

	const del = e.target.closest('.delete-btn');
	if (del) {
		// Si el botón está deshabilitado, prevenir acción y notificar
		if (del.disabled) {
			alert('No puedes borrar una tarea que no está completada. Marca la tarea como completada primero.');
			return;
		}

		const id = del.dataset.id;
		const task = tasks.find(t => t.id === id);
		const label = task ? task.text : 'esta tarea';
		if (!confirm(`¿Estás seguro que deseas eliminar "${label}"?`)) return;

		tasks = tasks.filter(t => t.id !== id);
		saveTasks();
		renderTasks();
		return;
	}
});

taskList.addEventListener('change', (e) => {
	const cb = e.target.closest('.task-checkbox');
	if (cb) {
		const id = cb.dataset.id;
		const task = tasks.find(t => t.id === id);
		if (task) {
			// Cambiar estado y mover al fondo si se marca completada
			task.completed = cb.checked;
			// Mover en el array: si ahora completada -> enviar al final; si ahora pendiente -> mover al inicio
			const idx = tasks.findIndex(t => t.id === id);
			if (idx > -1) {
				const [removed] = tasks.splice(idx, 1);
				if (removed.completed) tasks.push(removed);
				else tasks.unshift(removed);
			}
			saveTasks();
			renderTasks();
		}
	}
});

addTaskBtn.addEventListener('click', addTask);
taskInput.addEventListener('keydown', (e) => {
	// Soporta 'Enter' estándar y keyCode 13 por compatibilidad
	if (e.key === 'Enter' || e.keyCode === 13) {
		e.preventDefault();
		addTask();
	}
});


const sortA = document.getElementById('sortbtna');
const sortZ = document.getElementById('sortbtnz');
const completeAllBtn = document.getElementById('completeAllBtn');
const uncheckAllBtn = document.getElementById('uncheckAllBtn');
const deleteAllBtn = document.getElementById('deleteAllBtn');

// Filter buttons
const filterAll = document.getElementById('filterAll');
const filterPending = document.getElementById('filterPending');
const filterCompleted = document.getElementById('filterCompleted');

function setFilter(newFilter) {
	filterState = newFilter;
	// toggle active class
	[filterAll, filterPending, filterCompleted].forEach(btn => {
		if (!btn) return;
		btn.classList.toggle('active', btn.id === 'filter' + (newFilter === 'all' ? 'All' : newFilter === 'pending' ? 'Pending' : 'Completed'));
	});
	renderTasks();
}

if (filterAll) filterAll.addEventListener('click', () => setFilter('all'));
if (filterPending) filterPending.addEventListener('click', () => setFilter('pending'));
if (filterCompleted) filterCompleted.addEventListener('click', () => setFilter('completed'));

if (sortA) {
	sortA.textContent = 'A→Z';
	sortA.addEventListener('click', () => {
		tasks.sort((a, b) => a.text.localeCompare(b.text));
		saveTasks();
		renderTasks();
	});
}

if (sortZ) {
	sortZ.textContent = 'Z→A';
	sortZ.addEventListener('click', () => {
		tasks.sort((a, b) => b.text.localeCompare(a.text));
		saveTasks();
		renderTasks();
	});
}

if (completeAllBtn) {
	completeAllBtn.addEventListener('click', () => {
		if (tasks.length === 0) return;
		if (!confirm('¿Marcar todas las tareas como completadas?')) return;
		tasks.forEach(t => t.completed = true);
		saveTasks();
		renderTasks();
	});
}

if (uncheckAllBtn) {
	uncheckAllBtn.addEventListener('click', () => {
		if (tasks.length === 0) return;
		tasks.forEach(t => t.completed = false);
		saveTasks();
		renderTasks();
	});
}

if (deleteAllBtn) {
	deleteAllBtn.addEventListener('click', () => {
		if (tasks.length === 0) return;
		if (!confirm(`¿Estás seguro que deseas eliminar todas las tareas? (${tasks.length}) Esta acción no se puede deshacer.`)) return;
		tasks = [];
		saveTasks();
		renderTasks();
	});
}

// Render inicial
renderTasks();

