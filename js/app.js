const STORAGE_KEY = 'garden-planner-data';

let state = {
  crops: [],
  tasks: []
};

let currentFilter = 'all';
let searchQuery = '';

const TYPE_BADGES = {
  'полив': 'badge-water',
  'подкормка': 'badge-feed',
  'прополка': 'badge-weed',
  'обработка': 'badge-treat',
  'сбор урожая': 'badge-harvest'
};

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      state.crops = data.crops || [];
      state.tasks = data.tasks || [];
    }
  } catch {
    state = { crops: [], tasks: [] };
  }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getCropName(id) {
  const crop = state.crops.find(c => c.id === id);
  return crop ? crop.name : 'Неизвестно';
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  const months = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  return `${parseInt(d)} ${months[parseInt(m) - 1]} ${y}`;
}

function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => toast.classList.remove('show'), 2500);
}

function updateStats() {
  document.getElementById('stat-crops').textContent = state.crops.length;
  document.getElementById('stat-tasks').textContent = state.tasks.length;
  const done = state.tasks.filter(t => t.done).length;
  document.getElementById('stat-done').textContent = done;
  document.getElementById('stat-pending').textContent = state.tasks.length - done;
}

function updateCropSelects() {
  const selects = [document.getElementById('task-crop'), document.getElementById('edit-crop')];
  selects.forEach(sel => {
    const prev = sel.value;
    sel.innerHTML = state.crops.length
      ? state.crops.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')
      : '<option value="" disabled selected>Добавьте культуру</option>';
    if (prev && state.crops.find(c => c.id === prev)) sel.value = prev;
  });
}

function renderCrops() {
  const container = document.getElementById('crops-list');
  const filtered = state.crops.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!filtered.length) {
    container.innerHTML = '<div class="empty-state">' +
      (searchQuery ? 'Культуры не найдены' : 'Пока нет культур. Добавьте первую!') +
      '</div>';
    return;
  }

  container.innerHTML = filtered.map(c => `
    <div class="card">
      <div class="card-header">
        <div class="card-title">${escapeHtml(c.name)}</div>
        <button class="crop-delete" data-id="${c.id}" title="Удалить">✕</button>
      </div>
      <div class="card-meta">📅 Посадка: <strong>${formatDate(c.plantDate)}</strong></div>
      <div class="card-meta">📍 Место: <strong>${escapeHtml(c.place)}</strong></div>
      ${c.note ? `<div class="card-note">${escapeHtml(c.note)}</div>` : ''}
    </div>
  `).join('');

  container.querySelectorAll('.crop-delete').forEach(btn => {
    btn.addEventListener('click', () => deleteCrop(btn.dataset.id));
  });
}

function renderTaskCard(task) {
  const badgeClass = TYPE_BADGES[task.type] || 'badge-weed';
  return `
    <div class="card task-card ${task.done ? 'done' : ''}" data-id="${task.id}">
      <div class="card-header">
        <div class="card-title">${escapeHtml(getCropName(task.cropId))}</div>
        <span class="badge ${badgeClass}">${escapeHtml(task.type)}</span>
      </div>
      <div class="card-meta">📅 <strong>${formatDate(task.date)}</strong></div>
      ${task.description ? `<div class="card-note">${escapeHtml(task.description)}</div>` : ''}
      <div class="card-actions">
        ${!task.done ? `<button class="btn btn-success btn-sm complete-btn" data-id="${task.id}">✓ Выполнить</button>` : ''}
        <button class="btn btn-secondary btn-sm edit-btn" data-id="${task.id}">✎ Изменить</button>
        <button class="btn btn-danger btn-sm delete-btn" data-id="${task.id}">🗑 Удалить</button>
      </div>
    </div>
  `;
}

function bindTaskActions(container) {
  container.querySelectorAll('.complete-btn').forEach(btn => {
    btn.addEventListener('click', () => toggleTask(btn.dataset.id, true));
  });
  container.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', () => openEditModal(btn.dataset.id));
  });
  container.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteTask(btn.dataset.id));
  });
}

function renderTasks() {
  const container = document.getElementById('tasks-list');
  let tasks;

  if (currentFilter === 'done') {
    tasks = state.tasks.filter(t => t.done);
  } else if (currentFilter === 'pending') {
    tasks = state.tasks.filter(t => !t.done);
  } else {
    tasks = state.tasks.slice();
  }

  if (!tasks.length) {
    container.innerHTML = '<div class="empty-state">Нет задач для отображения</div>';
    return;
  }

  container.innerHTML = tasks.map(renderTaskCard).join('');
  bindTaskActions(container);
}

function renderHistory() {
  const container = document.getElementById('history-list');
  const done = state.tasks.filter(t => t.done);

  if (!done.length) {
    container.innerHTML = '<div class="empty-state">Выполненных задач пока нет</div>';
    return;
  }

  container.innerHTML = done.map(renderTaskCard).join('');
  bindTaskActions(container);
}

function renderCalendar() {
  const container = document.getElementById('calendar');
  if (!state.tasks.length) {
    container.innerHTML = '<div class="empty-state">Календарь пуст</div>';
    return;
  }

  const grouped = {};
  state.tasks.forEach(t => {
    if (!grouped[t.date]) grouped[t.date] = [];
    grouped[t.date].push(t);
  });

  const sortedDates = Object.keys(grouped).sort();

  container.innerHTML = sortedDates.map(date => `
    <div class="calendar-day">
      <div class="calendar-date">${formatDate(date)}</div>
      <div class="calendar-tasks">
        ${grouped[date].map(t => `
          <div class="calendar-task ${t.done ? 'done' : ''}">
            <span><strong>${escapeHtml(getCropName(t.cropId))}</strong> — ${escapeHtml(t.type)}${t.description ? ': ' + escapeHtml(t.description) : ''}</span>
            <span>${t.done ? '✅' : '⏳'}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function render() {
  updateStats();
  updateCropSelects();
  renderCrops();
  renderTasks();
  renderHistory();
  renderCalendar();
}

function deleteCrop(id) {
  if (!confirm('Удалить культуру и все связанные задачи?')) return;
  state.crops = state.crops.filter(c => c.id !== id);
  state.tasks = state.tasks.filter(t => t.cropId !== id);
  save();
  render();
  showToast('Культура удалена');
}

function toggleTask(id, done) {
  const task = state.tasks.find(t => t.id === id);
  if (task) {
    task.done = done;
    save();
    render();
    showToast('Задача выполнена');
  }
}

function deleteTask(id) {
  if (!confirm('Удалить задачу?')) return;
  state.tasks = state.tasks.filter(t => t.id !== id);
  save();
  render();
  showToast('Задача удалена');
}

function openEditModal(id) {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;
  document.getElementById('edit-id').value = task.id;
  document.getElementById('edit-crop').value = task.cropId;
  document.getElementById('edit-date').value = task.date;
  document.getElementById('edit-type').value = task.type;
  document.getElementById('edit-desc').value = task.description || '';
  document.getElementById('edit-modal').classList.add('open');
}

function closeEditModal() {
  document.getElementById('edit-modal').classList.remove('open');
}

function initApp() {
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('crop-date').value = today;
  document.getElementById('task-date').value = today;

  document.getElementById('crop-form').addEventListener('submit', e => {
    e.preventDefault();
    const crop = {
      id: uid(),
      name: document.getElementById('crop-name').value.trim(),
      plantDate: document.getElementById('crop-date').value,
      place: document.getElementById('crop-place').value.trim(),
      note: document.getElementById('crop-note').value.trim()
    };
    state.crops.push(crop);
    save();
    e.target.reset();
    document.getElementById('crop-date').value = today;
    render();
    showToast(`Культура «${crop.name}» добавлена`);
  });

  document.getElementById('task-form').addEventListener('submit', e => {
    e.preventDefault();
    if (!state.crops.length) {
      alert('Сначала добавьте хотя бы одну культуру');
      return;
    }
    const task = {
      id: uid(),
      cropId: document.getElementById('task-crop').value,
      date: document.getElementById('task-date').value,
      type: document.getElementById('task-type').value,
      description: document.getElementById('task-desc').value.trim(),
      done: false
    };
    state.tasks.push(task);
    save();
    e.target.reset();
    document.getElementById('task-date').value = today;
    render();
    showToast('Задача добавлена');
  });

  document.getElementById('edit-form').addEventListener('submit', e => {
    e.preventDefault();
    const id = document.getElementById('edit-id').value;
    const task = state.tasks.find(t => t.id === id);
    if (task) {
      task.cropId = document.getElementById('edit-crop').value;
      task.date = document.getElementById('edit-date').value;
      task.type = document.getElementById('edit-type').value;
      task.description = document.getElementById('edit-desc').value.trim();
      save();
      closeEditModal();
      render();
      showToast('Задача обновлена');
    }
  });

  document.getElementById('edit-cancel').addEventListener('click', closeEditModal);
  document.getElementById('edit-modal').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeEditModal();
  });

  document.getElementById('crop-search').addEventListener('input', e => {
    searchQuery = e.target.value;
    renderCrops();
  });

  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      renderTasks();
    });
  });

  load();
  render();
}

document.addEventListener('DOMContentLoaded', initApp);
