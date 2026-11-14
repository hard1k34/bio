/* =========================================================
   js/admin.js — Удобная панель управления (пароль: 3151020)
   ========================================================= */

let siteData = loadSiteData();
let serverAvailable = false;
let projectDirHandle = null;
let editingWorkIdx = null;
let adminWorkFilter = 'all';
let adminLangFilter = 'all';

const isSubfolder = window.location.pathname.includes('/admin/');
const pathPrefix = isSubfolder ? '../' : '';

function resolveAssetUrl(relPath) {
  if (!relPath) return '';
  if (relPath.startsWith('data:') || relPath.startsWith('http') || relPath.startsWith('blob:')) return relPath;
  return pathPrefix + relPath.replace(/^\/+/, '');
}

const loginView = document.getElementById('admin-login-view');
const dashView = document.getElementById('admin-dash-view');
const passInput = document.getElementById('admin-pass-input');
const loginBtn = document.getElementById('admin-login-btn');
const loginErr = document.getElementById('admin-login-err');

// 1. Тема оформления
const adminThemeBtn = document.getElementById('admin-theme-toggle');
function applyAdminTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('hs_theme', theme);
  if (adminThemeBtn) adminThemeBtn.textContent = theme === 'dark' ? 'светлая тема' : 'тёмная тема';
}
applyAdminTheme(localStorage.getItem('hs_theme') || 'dark');
if (adminThemeBtn) {
  adminThemeBtn.addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme') || 'dark';
    applyAdminTheme(cur === 'dark' ? 'light' : 'dark');
  });
}

function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2400);
}

// 2. Переключение вкладок админ-панели
const adminNavBtns = document.querySelectorAll('[data-atab]');
const adminSections = document.querySelectorAll('.content-area > .tab-section');

function switchAdminTab(target) {
  adminNavBtns.forEach(b => b.classList.toggle('active', b.getAttribute('data-atab') === target));
  adminSections.forEach(s => s.classList.toggle('active', s.id === `atab-${target}`));
  if (target === 'langs') renderAutoStatsPreview();
  if (target === 'storage') loadAssetsLibrary();
}

adminNavBtns.forEach(btn => {
  btn.addEventListener('click', () => switchAdminTab(btn.getAttribute('data-atab')));
});

window.addEventListener('keydown', e => {
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
  if (dashView.style.display === 'none') return;
  if (e.key === '1') switchAdminTab('portfolio');
  if (e.key === '2') switchAdminTab('profiles');
  if (e.key === '3') switchAdminTab('langs');
  if (e.key === '4') switchAdminTab('storage');
});

// 3. Определение режима работы (server.py или локальная папка)
async function detectServerMode() {
  const statusEl = document.getElementById('storage-mode-text');
  const bindBtn = document.getElementById('bind-folder-btn');
  const dot = document.getElementById('server-dot');
  const shortTxt = document.getElementById('server-status-short');

  try {
    const res = await fetch('/api/ping', { method: 'GET' });
    if (res.ok) {
      serverAvailable = true;
      if (dot) dot.className = 'status-dot online';
      if (shortTxt) shortTxt.textContent = 'server.py активен';
      if (statusEl) {
        statusEl.innerHTML = `✅ <b>Автосохранение активно (server.py):</b> все видео, скриншоты, превью и изменения в <code>js/data.js</code> сразу сохраняются в папки проекта.`;
      }
      if (bindBtn) bindBtn.style.display = 'none';
      loadAssetsLibrary();
      return;
    }
  } catch (e) {}

  if (dot) dot.className = 'status-dot local';
  if (shortTxt) shortTxt.textContent = 'локальный режим';
  if (statusEl) {
    statusEl.innerHTML = `Запустите <code>server.py</code> (или нажмите <b>«Привязать папку проекта»</b>), чтобы файлы автоматически сохранялись в <code>assets/videos/</code> и <code>assets/photos/</code>.`;
  }
}

const bindFolderBtn = document.getElementById('bind-folder-btn');
if (bindFolderBtn) {
  bindFolderBtn.addEventListener('click', async () => {
    if (!window.showDirectoryPicker) {
      showToast('Запустите server.py для автосохранения в папки');
      return;
    }
    try {
      projectDirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
      const statusEl = document.getElementById('storage-mode-text');
      const dot = document.getElementById('server-dot');
      const shortTxt = document.getElementById('server-status-short');
      if (dot) dot.className = 'status-dot online';
      if (shortTxt) shortTxt.textContent = 'папка привязана';
      if (statusEl) {
        statusEl.innerHTML = `✅ <b>Папка проекта привязана:</b> видео и превью автоматически сохраняются в <code>assets/videos/</code> и <code>assets/photos/</code>.`;
      }
      showToast('Папка проекта подключена');
    } catch (err) {
      showToast('Выбор папки отменён');
    }
  });
}

// 4. Загрузка медиафайлов в проект (быстрая бинарная передача через /api/upload-raw)
async function saveMediaFileToProject(file, folder) {
  const cleanName = (file.name || 'file.bin').replace(/[^a-zA-Z0-9._-]/g, '_');

  if (serverAvailable) {
    try {
      const res = await fetch('/api/upload-raw', {
        method: 'POST',
        headers: {
          'X-Folder': encodeURIComponent(folder),
          'X-Filename': encodeURIComponent(cleanName)
        },
        body: file
      });
      if (res.ok) {
        const out = await res.json();
        if (out && out.ok) return out.path;
      }
    } catch (e) {
      console.warn('Binary upload fallback:', e);
    }

    const dataUrl = await fileToDataUrl(file);
    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder, filename: cleanName, dataUrl })
    });
    const out = await res.json();
    if (out && out.ok) return out.path;
  }

  if (projectDirHandle) {
    try {
      const assetsHandle = await projectDirHandle.getDirectoryHandle('assets', { create: true });
      const subHandle = await assetsHandle.getDirectoryHandle(folder, { create: true });
      const fileHandle = await subHandle.getFileHandle(cleanName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(file);
      await writable.close();
      return `assets/${folder}/${cleanName}`;
    } catch (e) {
      console.warn('Direct folder write failed, falling back to dataURL:', e);
    }
  }

  return await fileToDataUrl(file);
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function buildDataJsFileContent() {
  return `const STORAGE_KEY = '${STORAGE_KEY}';\nconst ADMIN_PASSWORD = '${ADMIN_PASSWORD}';\nconst LANGUAGES_META = ${JSON.stringify(LANGUAGES_META, null, 2)};\n` +
    renderLangBadge.toString() + '\n\n' +
    `const DEFAULT_DATA = ${JSON.stringify(siteData, null, 2)};\n\n` +
    computeLanguagePercentages.toString() + '\n\n' +
    loadSiteData.toString() + '\n\n' +
    saveSiteData.toString() + '\n';
}

async function persistEverything() {
  saveSiteData(siteData);
  const jsCode = buildDataJsFileContent();

  if (serverAvailable) {
    try {
      await fetch('/api/save-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsCode })
      });
    } catch (e) {}
  } else if (projectDirHandle) {
    try {
      const jsDir = await projectDirHandle.getDirectoryHandle('js', { create: true });
      const fileHandle = await jsDir.getFileHandle('data.js', { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(jsCode);
      await writable.close();
    } catch (e) {}
  }
}

// 5. Авторизация
function checkAuth() {
  if (sessionStorage.getItem('hs_admin_auth') === '1') {
    loginView.style.display = 'none';
    dashView.style.display = 'grid';
    detectServerMode();
    initAdminForms();
  }
}

loginBtn.addEventListener('click', () => {
  if (passInput.value.trim() === ADMIN_PASSWORD) {
    sessionStorage.setItem('hs_admin_auth', '1');
    loginErr.textContent = '';
    checkAuth();
  } else {
    loginErr.textContent = 'Неверный пароль';
  }
});

passInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') loginBtn.click();
});

// 6. Инициализация форм и чекбоксов с иконками языков
function initAdminForms() {
  ['hardovere', 'sodabarblga'].forEach(k => {
    const p = siteData.profiles[k];
    if (!p) return;
    document.getElementById(`${k}-role`).value = p.role || '';
    document.getElementById(`${k}-avatar`).value = p.avatar || '';
    document.getElementById(`${k}-bio`).value = p.bio || '';
    document.getElementById(`${k}-github`).value = p.contacts.github || '';
    document.getElementById(`${k}-telegram`).value = p.contacts.telegram || '';
    document.getElementById(`${k}-discord`).value = p.contacts.discord || '';

    const avImg = document.getElementById(`${k}-avatar-preview`);
    if (avImg) {
      avImg.src = resolveAssetUrl(p.avatar);
      avImg.onerror = () => { if (p.avatarFallback) avImg.src = p.avatarFallback; };
    }

    const langChecksWrap = document.getElementById(`${k}-langs-checks`);
    if (langChecksWrap) {
      langChecksWrap.innerHTML = Object.keys(LANGUAGES_META).map(lKey => {
        const checked = (p.langs || []).includes(lKey) ? 'checked' : '';
        return `
          <label class="checkbox-pill">
            <input type="checkbox" value="${lKey}" class="${k}-lang-cb" ${checked}>
            ${LANGUAGES_META[lKey].svg}
            <span>${LANGUAGES_META[lKey].name}</span>
          </label>
        `;
      }).join('');
    }
  });

  const workLangsWrap = document.getElementById('work-langs-checks');
  if (workLangsWrap) {
    workLangsWrap.innerHTML = Object.keys(LANGUAGES_META).map(k => `
      <label class="checkbox-pill">
        <input type="checkbox" value="${k}" class="work-lang-cb">
        ${LANGUAGES_META[k].svg}
        <span>${LANGUAGES_META[k].name}</span>
      </label>
    `).join('');
  }

  renderAdminWorksList();
  renderAutoStatsPreview();
}

// 7. Кастомные зоны выбора файлов (Drag & Drop + живое превью в карточке)
const mediaDropCard = document.getElementById('media-drop-card');
const workFileInput = document.getElementById('work-file-input');
const adminVidPreview = document.getElementById('admin-video-preview');
const adminMediaImgPreview = document.getElementById('admin-media-img-preview');
const mediaFileLabel = document.getElementById('media-file-label');
const captureFrameBtn = document.getElementById('capture-frame-btn');

const previewDropCard = document.getElementById('preview-drop-card');
const workPreviewFile = document.getElementById('work-preview-file');
const adminCoverPreview = document.getElementById('admin-cover-preview');
const previewFileLabel = document.getElementById('preview-file-label');

function updateMediaPreviewUI(url, isPhotoType) {
  const cleanUrl = (url || '').trim();
  if (!cleanUrl) {
    mediaDropCard.classList.remove('has-media');
    adminVidPreview.pause();
    adminVidPreview.removeAttribute('src');
    adminMediaImgPreview.removeAttribute('src');
    return;
  }

  const isImg = isPhotoType || /\.(png|jpe?g|webp|gif|avif|svg)$/i.test(cleanUrl) || cleanUrl.startsWith('data:image/');
  mediaDropCard.classList.add('has-media');
  mediaFileLabel.textContent = cleanUrl.startsWith('data:') ? 'загруженный файл' : cleanUrl.split('/').pop();

  if (isImg) {
    adminVidPreview.pause();
    adminVidPreview.style.display = 'none';
    adminMediaImgPreview.style.display = 'block';
    adminMediaImgPreview.src = resolveAssetUrl(cleanUrl);
    if (captureFrameBtn) captureFrameBtn.style.display = 'none';
  } else {
    adminMediaImgPreview.style.display = 'none';
    adminVidPreview.style.display = 'block';
    adminVidPreview.src = resolveAssetUrl(cleanUrl);
    if (captureFrameBtn) captureFrameBtn.style.display = 'inline-block';
  }
}

function updateCoverPreviewUI(url) {
  const cleanUrl = (url || '').trim();
  if (!cleanUrl) {
    previewDropCard.classList.remove('has-media');
    adminCoverPreview.removeAttribute('src');
    return;
  }
  previewDropCard.classList.add('has-media');
  adminCoverPreview.src = resolveAssetUrl(cleanUrl);
  previewFileLabel.textContent = cleanUrl.startsWith('data:') ? 'обложка' : cleanUrl.split('/').pop();
}

// Клик и Drag-and-Drop для основного файла
mediaDropCard.addEventListener('click', e => {
  if (e.target.closest('button') || e.target.tagName === 'VIDEO') return;
  workFileInput.click();
});
document.getElementById('change-media-btn').addEventListener('click', e => {
  e.stopPropagation();
  workFileInput.click();
});

['dragover', 'dragenter'].forEach(ev => {
  mediaDropCard.addEventListener(ev, e => { e.preventDefault(); mediaDropCard.classList.add('dragover'); });
  previewDropCard.addEventListener(ev, e => { e.preventDefault(); previewDropCard.classList.add('dragover'); });
});
['dragleave', 'drop'].forEach(ev => {
  mediaDropCard.addEventListener(ev, e => { e.preventDefault(); mediaDropCard.classList.remove('dragover'); });
  previewDropCard.addEventListener(ev, e => { e.preventDefault(); previewDropCard.classList.remove('dragover'); });
});

mediaDropCard.addEventListener('drop', async e => {
  const file = e.dataTransfer.files && e.dataTransfer.files[0];
  if (file) await handleMainMediaFile(file);
});

workFileInput.addEventListener('change', async e => {
  const file = e.target.files && e.target.files[0];
  if (file) await handleMainMediaFile(file);
});

async function handleMainMediaFile(file) {
  const isImage = file.type.startsWith('image/');
  const targetFolder = isImage ? 'photos' : 'videos';
  document.getElementById('work-type').value = isImage ? 'photo' : 'video';

  // Мгновенно показываем локальное превью
  const blobUrl = URL.createObjectURL(file);
  updateMediaPreviewUI(blobUrl, isImage);
  mediaFileLabel.textContent = `⏳ загрузка ${file.name}...`;

  const savedPath = await saveMediaFileToProject(file, targetFolder);
  document.getElementById('work-url').value = savedPath;
  mediaFileLabel.textContent = savedPath.startsWith('data:') ? file.name : savedPath.split('/').pop();

  if (!document.getElementById('work-title').value.trim()) {
    document.getElementById('work-title').value = file.name.replace(/\.[^/.]+$/, '');
  }
  showToast(savedPath.startsWith('data:') ? 'Файл загружен' : `Сохранено в ${savedPath}`);
}

// Клик и Drag-and-Drop для превью-обложки
previewDropCard.addEventListener('click', e => {
  if (e.target.closest('button')) return;
  workPreviewFile.click();
});
document.getElementById('change-preview-btn').addEventListener('click', e => {
  e.stopPropagation();
  workPreviewFile.click();
});
document.getElementById('clear-preview-btn').addEventListener('click', e => {
  e.stopPropagation();
  document.getElementById('work-preview-url').value = '';
  workPreviewFile.value = '';
  updateCoverPreviewUI('');
});

previewDropCard.addEventListener('drop', async e => {
  const file = e.dataTransfer.files && e.dataTransfer.files[0];
  if (file) await handlePreviewImageFile(file);
});

workPreviewFile.addEventListener('change', async e => {
  const file = e.target.files && e.target.files[0];
  if (file) await handlePreviewImageFile(file);
});

async function handlePreviewImageFile(file) {
  const blobUrl = URL.createObjectURL(file);
  updateCoverPreviewUI(blobUrl);
  previewFileLabel.textContent = `⏳ ${file.name}...`;

  const savedPath = await saveMediaFileToProject(file, 'photos');
  document.getElementById('work-preview-url').value = savedPath;
  previewFileLabel.textContent = savedPath.startsWith('data:') ? file.name : savedPath.split('/').pop();
  showToast(savedPath.startsWith('data:') ? 'Превью загружено' : `Превью сохранено в ${savedPath}`);
}

// Захват кадра из видео в 1 клик и сохранение его как превью
if (captureFrameBtn) {
  captureFrameBtn.addEventListener('click', async e => {
    e.stopPropagation();
    if (!adminVidPreview || !adminVidPreview.videoWidth) {
      showToast('Сначала выберите видео и дождитесь его загрузки');
      return;
    }
    try {
      const canvas = document.createElement('canvas');
      canvas.width = adminVidPreview.videoWidth;
      canvas.height = adminVidPreview.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(adminVidPreview, 0, 0, canvas.width, canvas.height);

      const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.88));
      const frameFile = new File([blob], `preview_${Date.now()}.jpg`, { type: 'image/jpeg' });
      await handlePreviewImageFile(frameFile);
    } catch (err) {
      showToast('Не удалось захватить кадр');
    }
  });
}

// Синхронизация при ручном вводе пути
document.getElementById('work-url').addEventListener('input', e => {
  const isPhoto = document.getElementById('work-type').value === 'photo';
  updateMediaPreviewUI(e.target.value, isPhoto);
});
document.getElementById('work-preview-url').addEventListener('input', e => {
  updateCoverPreviewUI(e.target.value);
});

// 8. Добавление / сохранение редактируемой работы
function resetWorkForm() {
  editingWorkIdx = null;
  document.getElementById('form-mode-title').textContent = 'Добавить работу в портфолио';
  document.getElementById('add-work-btn').textContent = '＋ Добавить в портфолио';
  document.getElementById('cancel-edit-btn').style.display = 'none';

  document.getElementById('work-title').value = '';
  document.getElementById('work-author').value = 'hardovere & SodaBarblga';
  document.getElementById('work-type').value = 'video';
  document.getElementById('work-url').value = '';
  document.getElementById('work-preview-url').value = '';
  document.getElementById('work-desc').value = '';
  workFileInput.value = '';
  workPreviewFile.value = '';
  document.querySelectorAll('.work-lang-cb').forEach(cb => cb.checked = false);

  updateMediaPreviewUI('', false);
  updateCoverPreviewUI('');
  renderAdminWorksList();
}

document.getElementById('reset-work-form-btn').addEventListener('click', resetWorkForm);
document.getElementById('cancel-edit-btn').addEventListener('click', resetWorkForm);

document.getElementById('add-work-btn').addEventListener('click', async () => {
  const title = document.getElementById('work-title').value.trim();
  const author = document.getElementById('work-author').value;
  const mediaType = document.getElementById('work-type').value;
  const finalUrl = document.getElementById('work-url').value.trim();
  const previewUrl = document.getElementById('work-preview-url').value.trim();
  const desc = document.getElementById('work-desc').value.trim();

  if (!title) {
    showToast('Укажите название работы');
    return;
  }
  if (!finalUrl) {
    showToast('Выберите видео/фото или укажите путь');
    return;
  }

  const langs = Array.from(document.querySelectorAll('.work-lang-cb:checked')).map(cb => cb.value);
  if (!langs.length) {
    showToast('Отметьте хотя бы один язык проекта');
    return;
  }

  if (editingWorkIdx !== null && siteData.works[editingWorkIdx]) {
    siteData.works[editingWorkIdx] = {
      ...siteData.works[editingWorkIdx],
      title,
      author,
      mediaType,
      url: finalUrl,
      preview: previewUrl || '',
      desc,
      langs
    };
    showToast('Изменения в работе сохранены');
  } else {
    siteData.works.unshift({
      id: Date.now(),
      title,
      author,
      mediaType,
      url: finalUrl,
      preview: previewUrl || '',
      desc,
      langs,
      date: new Date().toLocaleDateString('ru-RU')
    });
    showToast('Работа добавлена в портфолио');
  }

  resetWorkForm();
  await persistEverything();
  renderAdminWorksList();
  renderAutoStatsPreview();
});

// 9. Визуальный список работ с живыми превью, сортировкой и редактированием
document.querySelectorAll('.admin-wfilter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    adminWorkFilter = btn.getAttribute('data-awfilter');
    document.querySelectorAll('.admin-wfilter-btn').forEach(b => b.classList.toggle('active', b === btn));
    renderAdminWorksList();
  });
});

function renderAdminWorksList() {
  const list = document.getElementById('admin-works-list');
  const countBadge = document.getElementById('nav-works-count');
  const allWorks = siteData.works || [];
  if (countBadge) countBadge.textContent = allWorks.length;

  const filtered = allWorks
    .map((w, idx) => ({ w, idx }))
    .filter(({ w }) => {
      if (adminWorkFilter === 'all') return true;
      return (w.author || '').toLowerCase().includes(adminWorkFilter);
    });

  if (!filtered.length) {
    list.innerHTML = `<div class="empty-state" style="grid-column: 1 / -1;">В портфолио пока нет работ. Добавьте первое видео или скриншот через форму выше!</div>`;
    return;
  }

  list.innerHTML = filtered.map(({ w, idx }) => {
    const isPhoto = w.mediaType === 'photo' || (w.url && /\.(png|jpe?g|webp|gif|avif|svg)$/i.test(w.url));
    const iconsHtml = (w.langs || []).map(l => renderLangBadge(l)).join('');
    const isEditing = editingWorkIdx === idx ? 'editing' : '';

    let thumbHtml = '';
    if (isPhoto) {
      thumbHtml = `<img src="${resolveAssetUrl(w.url)}" alt="${w.title}" loading="lazy">`;
    } else if (w.preview) {
      thumbHtml = `<img src="${resolveAssetUrl(w.preview)}" alt="${w.title}" loading="lazy">`;
    } else {
      thumbHtml = `<video src="${resolveAssetUrl(w.url)}" muted playsinline preload="metadata" onmouseenter="this.play()" onmouseleave="this.pause();this.currentTime=0;"></video>`;
    }

    const previewBadge = (!isPhoto && w.preview)
      ? `<span class="admin-tag ok">✓ превью</span>`
      : (!isPhoto ? `<span class="admin-tag">авто-кадр</span>` : '');

    return `
      <div class="admin-work-card ${isEditing}">
        <div class="admin-work-thumb">
          ${thumbHtml}
          <div class="admin-thumb-badges">
            <span class="admin-tag">${isPhoto ? 'ФОТО' : 'ВИДЕО'}</span>
            ${previewBadge}
          </div>
        </div>
        <div class="admin-work-body">
          <div class="admin-work-sub">${w.author || 'hardovere & SodaBarblga'} · ${w.date || ''}</div>
          <div class="admin-work-title">${w.title}</div>
          <div class="admin-work-desc">${w.desc || 'Без описания'}</div>
          <div class="work-langs" style="margin-top:2px;">${iconsHtml}</div>

          <div class="admin-work-actions">
            <div style="display:flex;gap:4px;">
              <button class="icon-btn" onclick="moveWork(${idx}, -1)" title="Поднять выше" ${idx === 0 ? 'disabled style="opacity:0.35"' : ''}>↑</button>
              <button class="icon-btn" onclick="moveWork(${idx}, 1)" title="Опустить ниже" ${idx === allWorks.length - 1 ? 'disabled style="opacity:0.35"' : ''}>↓</button>
              <button class="icon-btn" onclick="editWork(${idx})">✏️ Изменить</button>
            </div>
            <button class="icon-btn danger" onclick="deleteWork(${idx})">Удалить</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

window.editWork = function(idx) {
  const w = siteData.works[idx];
  if (!w) return;
  editingWorkIdx = idx;

  document.getElementById('form-mode-title').textContent = `Редактирование: ${w.title}`;
  document.getElementById('add-work-btn').textContent = '💾 Сохранить изменения в работе';
  document.getElementById('cancel-edit-btn').style.display = 'inline-block';

  document.getElementById('work-title').value = w.title || '';
  document.getElementById('work-author').value = w.author || 'hardovere & SodaBarblga';
  document.getElementById('work-type').value = w.mediaType || 'video';
  document.getElementById('work-url').value = w.url || '';
  document.getElementById('work-preview-url').value = w.preview || '';
  document.getElementById('work-desc').value = w.desc || '';

  const langSet = new Set(w.langs || []);
  document.querySelectorAll('.work-lang-cb').forEach(cb => {
    cb.checked = langSet.has(cb.value);
  });

  updateMediaPreviewUI(w.url || '', w.mediaType === 'photo');
  updateCoverPreviewUI(w.preview || '');
  renderAdminWorksList();

  document.querySelector('.content-area').scrollTo({ top: 0, behavior: 'smooth' });
};

window.moveWork = async function(idx, dir) {
  const targetIdx = idx + dir;
  if (targetIdx < 0 || targetIdx >= siteData.works.length) return;
  const temp = siteData.works[idx];
  siteData.works[idx] = siteData.works[targetIdx];
  siteData.works[targetIdx] = temp;
  if (editingWorkIdx === idx) editingWorkIdx = targetIdx;
  else if (editingWorkIdx === targetIdx) editingWorkIdx = idx;

  await persistEverything();
  renderAdminWorksList();
};

window.deleteWork = async function(idx) {
  const w = siteData.works[idx];
  if (!w) return;
  if (!confirm(`Удалить работу «${w.title}» из портфолио?`)) return;
  siteData.works.splice(idx, 1);
  if (editingWorkIdx === idx) resetWorkForm();
  await persistEverything();
  renderAdminWorksList();
  renderAutoStatsPreview();
  showToast('Работа удалена');
};

// 10. Редактирование профилей hardovere и SodaBarblga + живое превью аватарок
['hardovere', 'sodabarblga'].forEach(k => {
  const fileInp = document.getElementById(`${k}-avatar-file`);
  const pathInp = document.getElementById(`${k}-avatar`);
  const prevImg = document.getElementById(`${k}-avatar-preview`);

  if (fileInp) {
    fileInp.addEventListener('change', async e => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      if (prevImg) prevImg.src = URL.createObjectURL(file);
      const savedPath = await saveMediaFileToProject(file, 'avatars');
      pathInp.value = savedPath;
      if (prevImg) prevImg.src = resolveAssetUrl(savedPath);
      showToast(`Аватарка ${k} обновлена`);
    });
  }

  if (pathInp && prevImg) {
    pathInp.addEventListener('input', () => {
      prevImg.src = resolveAssetUrl(pathInp.value.trim());
    });
  }
});

async function saveProfilesAndAll() {
  ['hardovere', 'sodabarblga'].forEach(k => {
    if (!siteData.profiles[k]) return;
    siteData.profiles[k].role = document.getElementById(`${k}-role`).value.trim();
    siteData.profiles[k].avatar = document.getElementById(`${k}-avatar`).value.trim();
    siteData.profiles[k].bio = document.getElementById(`${k}-bio`).value;
    siteData.profiles[k].contacts.github = document.getElementById(`${k}-github`).value.trim();
    siteData.profiles[k].contacts.telegram = document.getElementById(`${k}-telegram`).value.trim();
    siteData.profiles[k].contacts.discord = document.getElementById(`${k}-discord`).value.trim();
    siteData.profiles[k].langs = Array.from(document.querySelectorAll(`.${k}-lang-cb:checked`)).map(cb => cb.value);
  });

  await persistEverything();
  renderAutoStatsPreview();
  showToast('Все изменения сохранены!');
}

document.getElementById('save-all-btn').addEventListener('click', saveProfilesAndAll);
document.getElementById('quick-save-btn').addEventListener('click', saveProfilesAndAll);

// 11. Предпросмотр процентов языков (Вкладка 3)
document.querySelectorAll('.admin-lfilter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    adminLangFilter = btn.getAttribute('data-alfilter');
    document.querySelectorAll('.admin-lfilter-btn').forEach(b => b.classList.toggle('active', b === btn));
    renderAutoStatsPreview();
  });
});

function renderAutoStatsPreview() {
  const wrap = document.getElementById('admin-auto-stats');
  const bar = document.getElementById('admin-gh-bar');
  const note = document.getElementById('admin-lang-mode-note');
  if (!wrap) return;

  const stats = computeLanguagePercentages(siteData, adminLangFilter);
  if (note) {
    note.textContent = stats.sourceMode === 'portfolio'
      ? `Расчёт по работам в портфолио (учтено работ: ${stats.worksCount}).`
      : `В портфолио пока нет работ для этого фильтра — проценты рассчитываются по языкам из карточек профилей.`;
  }

  if (bar) {
    bar.innerHTML = stats.items.map(item => {
      if (item.pct <= 0) return '';
      return `<div class="gh-segment" style="width:${item.pct}%; background:${item.color}" title="${item.name}: ${item.pct}%"></div>`;
    }).join('');
  }

  wrap.innerHTML = stats.items.map(item => `
    <div class="lang-item" style="padding:11px 14px;">
      <div class="lang-item-left">
        ${item.svg}
        <span class="lang-name">${item.name}</span>
      </div>
      <span class="lang-pct">${item.pct}%</span>
    </div>
  `).join('');
}

// 12. Медиатека файлов assets/ и управление кэшем (Вкладка 4)
function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

async function loadAssetsLibrary() {
  const container = document.getElementById('assets-library-container');
  if (!container || !serverAvailable) return;

  try {
    const res = await fetch('/api/assets');
    if (!res.ok) return;
    const data = await res.json();
    if (!data.ok) return;

    const allFiles = [
      ...(data.assets.videos || []).map(f => ({ ...f, type: 'video' })),
      ...(data.assets.photos || []).map(f => ({ ...f, type: 'photo' })),
      ...(data.assets.avatars || []).map(f => ({ ...f, type: 'avatar' }))
    ];

    if (!allFiles.length) {
      container.innerHTML = `<div class="empty-state">Папки assets/videos и assets/photos пока пусты.</div>`;
      return;
    }

    container.innerHTML = `<div class="assets-grid">` + allFiles.map(f => {
      const thumb = f.type === 'video'
        ? `<video src="${resolveAssetUrl(f.path)}" muted preload="metadata" onmouseenter="this.play()" onmouseleave="this.pause();this.currentTime=0;"></video>`
        : `<img src="${resolveAssetUrl(f.path)}" alt="${f.name}" loading="lazy">`;

      return `
        <div class="asset-card">
          <div class="asset-thumb">${thumb}</div>
          <div class="asset-meta">
            <div class="asset-name" title="${f.path}">${f.name}</div>
            <div style="font-size:10.5px;color:var(--muted);">${f.path} · ${formatBytes(f.size)}</div>
            <div style="display:flex;gap:6px;margin-top:4px;">
              <button class="icon-btn" style="flex:1;" onclick="navigator.clipboard.writeText('${f.path}');showToast('Путь скопирован')">Копировать путь</button>
              <button class="icon-btn danger" onclick="deleteAssetFile('${f.path}')">✕</button>
            </div>
          </div>
        </div>
      `;
    }).join('') + `</div>`;
  } catch (e) {}
}

window.deleteAssetFile = async function(relPath) {
  if (!confirm(`Удалить файл ${relPath} с диска?`)) return;
  try {
    const res = await fetch('/api/delete-asset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: relPath })
    });
    const out = await res.json();
    if (out.ok) {
      showToast('Файл удалён');
      loadAssetsLibrary();
    } else {
      showToast(out.error || 'Ошибка удаления');
    }
  } catch (e) {
    showToast('Ошибка связи с сервером');
  }
};

const refreshAssetsBtn = document.getElementById('refresh-assets-btn');
if (refreshAssetsBtn) refreshAssetsBtn.addEventListener('click', loadAssetsLibrary);

const exportBtn = document.getElementById('export-data-btn');
if (exportBtn) {
  exportBtn.addEventListener('click', () => {
    const content = buildDataJsFileContent();
    const blob = new Blob([content], { type: 'application/javascript;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'data.js';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Файл data.js скачан');
  });
}

const resetCacheBtn = document.getElementById('reset-cache-btn');
if (resetCacheBtn) {
  resetCacheBtn.addEventListener('click', () => {
    if (!confirm('Очистить кэш браузера (localStorage) и перезагрузить данные из js/data.js?')) return;
    localStorage.removeItem('hs_portfolio_data_v5');
    localStorage.removeItem(STORAGE_KEY);
    window.location.reload();
  });
}

checkAuth();
