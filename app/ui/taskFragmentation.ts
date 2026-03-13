import { tasks } from '../state/tasks.js';
import { editingTaskIndex } from '../state/tasks.js';
import { MIN_TASK_DURATION, MIN_FRAGMENT_DURATION } from '../types/constants.js';
import { canEditData } from '../algo/runAlgo.js';
import { saveTasks } from '../services/storage.js';

export function renderFragmentation(): void {
  const container = document.getElementById('fragmentationContainer')!;
  const taskDurationInput = document.getElementById('taskDuration') as HTMLInputElement;

  const currentTask = editingTaskIndex >= 0 ? tasks[editingTaskIndex] : null;
  const duration = parseInt(taskDurationInput.value) || 0;

  if (!currentTask?.fragmentation) {
    container.innerHTML = '<button class="btn-secondary" id="addFragmentationBtn" style="width: 100%;">Ajouter une fragmentation</button>';
    document.getElementById('addFragmentationBtn')!.addEventListener('click', createFragmentation);
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

  const sum     = fragments.reduce((a, b) => a + b, 0);
  const isValid = sum === duration;

  html += `
    <div class="fragment-sum ${isValid ? 'valid' : 'invalid'}">
      Total: ${sum} min ${isValid ? '✓' : `(doit être ${duration})`}
    </div>
    <button class="btn-secondary" id="addFragmentPartBtn" style="width: 100%; margin-top: 8px;">Ajouter une partie</button>
    <button class="btn-danger" id="removeFragmentationBtn" style="width: 100%; margin-top: 8px;">Supprimer la fragmentation</button>
  </div>`;

  container.innerHTML = html;

  container.querySelectorAll<HTMLInputElement>('.fragment-input').forEach(input => {
    input.addEventListener('change', e => {
      updateFragmentValue(
        parseInt((e.target as HTMLInputElement).dataset.index!),
        parseInt((e.target as HTMLInputElement).value),
      );
    });
  });

  container.querySelectorAll<HTMLButtonElement>('.fragment-delete-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      deleteFragmentPart(parseInt((e.target as HTMLButtonElement).dataset.index!));
    });
  });

  document.getElementById('addFragmentPartBtn')?.addEventListener('click', addFragmentPart);
  document.getElementById('removeFragmentationBtn')?.addEventListener('click', removeFragmentation);
}

export function createFragmentation(): void {
  if (!canEditData()) return;
  if (editingTaskIndex < 0) return;

  const taskDurationInput = document.getElementById('taskDuration') as HTMLInputElement;
  const duration = parseInt(taskDurationInput.value);
  if (!duration || duration < MIN_TASK_DURATION) {
    alert(`La tâche doit durer au moins ${MIN_TASK_DURATION} minutes pour être fragmentée`);
    return;
  }

  const half      = Math.floor(duration / 2 / MIN_FRAGMENT_DURATION) * MIN_FRAGMENT_DURATION;
  const remainder = duration - half;
  tasks[editingTaskIndex].fragmentation = [half, remainder];
  renderFragmentation();
}

export function updateFragmentValue(index: number, value: number): void {
  if (!canEditData()) return;
  if (editingTaskIndex < 0 || !tasks[editingTaskIndex].fragmentation) return;
  if (value < MIN_FRAGMENT_DURATION) value = MIN_FRAGMENT_DURATION;
  tasks[editingTaskIndex].fragmentation![index] = value;
  renderFragmentation();
}

export function addFragmentPart(): void {
  if (!canEditData()) return;
  if (editingTaskIndex < 0 || !tasks[editingTaskIndex].fragmentation) return;
  tasks[editingTaskIndex].fragmentation!.push(MIN_FRAGMENT_DURATION);
  renderFragmentation();
  saveTasks();
}

export function deleteFragmentPart(index: number): void {
  if (!canEditData()) return;
  if (editingTaskIndex < 0 || !tasks[editingTaskIndex].fragmentation) return;
  if (tasks[editingTaskIndex].fragmentation!.length <= 1) {
    alert('Une fragmentation doit avoir au moins 1 partie');
    return;
  }
  tasks[editingTaskIndex].fragmentation!.splice(index, 1);
  renderFragmentation();
}

export function removeFragmentation(): void {
  if (!canEditData()) return;
  if (editingTaskIndex < 0) return;
  delete tasks[editingTaskIndex].fragmentation;
  renderFragmentation();
}
