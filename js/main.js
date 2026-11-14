/* =========================================================
   js/main.js — Главная страница (оптимизированная)
   ========================================================= */

if (window.location.hash === '#admin' || window.location.search.includes('admin')) {
  window.location.href = 'admin.html';
}

const siteData = loadSiteData();
let currentLangFilter = 'all';
let currentWorkFilter = 'all';

// 1. Переключение темы
const themeBtn = document.getElementById('theme-toggle');
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('hs_theme', theme);
  if (themeBtn) themeBtn.textContent = theme === 'dark' ? 'светлая тема' : 'тёмная тема';
}
applyTheme(localStorage.getItem('hs_theme') || 'dark');
if (themeBtn) {
  themeBtn.addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme') || 'dark';
    applyTheme(cur === 'dark' ? 'light' : 'dark');
  });
}

// 2. Печать и стирание ников в верхней строке
const twEl = document.getElementById('typewriter-text');
let phraseIdx = 0;
let charIdx = 0;
let isDeleting = false;

function tickTypewriter() {
  const phrases = (siteData.phrases && siteData.phrases.length) ? siteData.phrases : ['hardovere', 'SodaBarblga'];
  const current = phrases[phraseIdx % phrases.length];

  if (isDeleting) {
    charIdx--;
  } else {
    charIdx++;
  }

  if (twEl) twEl.textContent = current.substring(0, charIdx);

  let delay = isDeleting ? 55 : 105;
  if (!isDeleting && charIdx === current.length) {
    delay = 1800;
    isDeleting = true;
  } else if (isDeleting && charIdx === 0) {
    isDeleting = false;
    phraseIdx = (phraseIdx + 1) % phrases.length;
    delay = 380;
  }
  setTimeout(tickTypewriter, delay);
}
tickTypewriter();

// Сброс всех видео к превью при смене вкладки
function resetAllVideosToPreview() {
  document.querySelectorAll('.work-media.video-box').forEach(box => {
    const vid = box.querySelector('video');
    const cover = box.querySelector('.video-preview-cover');
    if (vid && !vid.paused) {
      vid.pause();
    }
    if (cover) {
      cover.classList.remove('hidden');
    }
    box.classList.remove('playing');
  });
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    resetAllVideosToPreview();
  }
});

// 3. Переключение вкладок слева + горячие клавиши 1, 2, 3
const navItems = document.querySelectorAll('.nav-item');
const sections = document.querySelectorAll('.tab-section');

function switchTab(target) {
  resetAllVideosToPreview();
  navItems.forEach(n => n.classList.toggle('active', n.getAttribute('data-tab') === target));
  sections.forEach(s => s.classList.toggle('active', s.id === `tab-${target}`));
}

navItems.forEach(item => {
  item.addEventListener('click', () => {
    switchTab(item.getAttribute('data-tab'));
  });
});

window.addEventListener('keydown', e => {
  if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
  if (e.key === '1') switchTab('about');
  if (e.key === '2') switchTab('portfolio');
  if (e.key === '3') switchTab('langs');
  if (e.key === 'Escape') closeLightbox();
});

// 4. Рендер "О нас"
const GH_ICON = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56v-2c-3.2.7-3.87-1.54-3.87-1.54-.52-1.33-1.28-1.68-1.28-1.68-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.23-1.28-5.23-5.68 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11.05 11.05 0 015.78 0c2.2-1.49 3.16-1.18 3.16-1.18.63 1.59.24 2.76.12 3.05.74.81 1.18 1.83 1.18 3.09 0 4.41-2.69 5.38-5.25 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.51 11.51 0 0023.5 12C23.5 5.65 18.35.5 12 .5z"/></svg>`;
const TG_ICON = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21.9 4.4L2.9 11.7c-1.3.5-1.3 1.2-.2 1.6l4.9 1.5 11.3-7.1c.5-.3 1-.1.6.2l-9.2 8.3-.3 4.8c.5 0 .7-.2 1-.5l2.4-2.3 5 3.7c.9.5 1.6.2 1.8-.9L23.4 5.7c.3-1.2-.5-1.8-1.5-1.3z"/></svg>`;
const DS_ICON = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.54 5.34A16.3 16.3 0 0015.46 4c-.18.32-.38.75-.52 1.09a15.1 15.1 0 00-5.88 0C8.92 4.75 8.71 4.32 8.53 4a16.36 16.36 0 00-4.08 1.34C1.87 9.28 1.17 13.12 1.52 16.91a16.58 16.58 0 005.01 2.59c.4-.55.76-1.14 1.07-1.76-.59-.22-1.15-.5-1.68-.82.14-.1.28-.21.41-.32 3.24 1.51 6.76 1.51 9.96 0 .14.11.27.22.41.32-.53.32-1.1.6-1.69.82.31.62.67 1.21 1.07 1.76a16.52 16.52 0 005.02-2.59c.41-4.39-.7-8.19-2.56-11.57zM8.68 14.58c-.98 0-1.78-.9-1.78-2s.78-2 1.78-2c1 0 1.8.9 1.78 2 0 1.1-.78 2-1.78 2zm6.64 0c-.98 0-1.78-.9-1.78-2s.78-2 1.78-2c1 0 1.8.9 1.78 2 0 1.1-.78 2-1.78 2z"/></svg>`;

function renderProfiles() {
  const container = document.getElementById('profiles-container');
  if (!container) return;

  const keys = ['hardovere', 'sodabarblga'];
  container.innerHTML = keys.map(k => {
    const p = siteData.profiles[k];
    if (!p) return '';
    const iconsHtml = (p.langs || []).map(langKey => renderLangBadge(langKey)).join('');

    return `
      <div class="profile-card">
        <div style="display:flex;flex-direction:column;gap:16px;">
          <div class="profile-top">
            <img class="avatar" src="${p.avatar}" alt="${p.nick}" onerror="this.onerror=null;this.src='${p.avatarFallback || ''}'">
            <div>
              <div class="profile-nick">${p.nick}</div>
              <div class="profile-role">${p.role}</div>
            </div>
          </div>
          <div class="profile-bio">${p.bio}</div>
          <div class="profile-langs">${iconsHtml}</div>
        </div>

        <div class="profile-contacts">
          <a class="contact-pill" href="${p.contacts.github}" target="_blank" rel="noopener">
            ${GH_ICON}
            <span>GitHub</span>
          </a>
          <button class="contact-pill" onclick="copyText('${p.contacts.telegram}')">
            ${TG_ICON}
            <span>Telegram</span>
          </button>
          <button class="contact-pill" onclick="copyText('${p.contacts.discord}')">
            ${DS_ICON}
            <span>Discord</span>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// 5. Рендер портфолио + кастомный плеер с превью
function formatTime(sec) {
  if (!isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function renderPortfolio() {
  const container = document.getElementById('portfolio-container');
  if (!container) return;

  const allWorks = siteData.works || [];
  const works = allWorks.filter(w => {
    if (currentWorkFilter === 'all') return true;
    return (w.author || '').toLowerCase().includes(currentWorkFilter);
  });

  if (!works.length) {
    container.innerHTML = `<div class="empty-state">Работы пока не добавлены</div>`;
    return;
  }

  container.innerHTML = `<div class="portfolio-grid">` + works.map((w, idx) => {
    const isPhoto = w.mediaType === 'photo' || (w.url && /\.(png|jpe?g|webp|gif|avif|svg)$/i.test(w.url));
    const iconsHtml = (w.langs || []).map(l => renderLangBadge(l)).join('');

    if (isPhoto) {
      return `
        <div class="work-card">
          <div class="work-media">
            <img class="zoomable" src="${w.url}" alt="${w.title}" loading="lazy" onclick="openLightbox('${w.url}')">
          </div>
          <div class="work-body">
            <div class="work-meta">
              <span>${w.author || 'hardovere & SodaBarblga'}</span>
              <span>${w.date || ''}</span>
            </div>
            <div class="work-title">${w.title}</div>
            <div class="work-desc">${w.desc || ''}</div>
            <div class="work-langs">${iconsHtml}</div>
          </div>
        </div>
      `;
    }

    const previewImgTag = w.preview
      ? `<img src="${w.preview}" alt="${w.title}" class="preview-img">`
      : `<img src="" alt="${w.title}" class="preview-img" style="display:none;">`;

    return `
      <div class="work-card">
        <div class="work-media video-box" data-idx="${idx}">
          <div class="video-preview-cover" onclick="toggleCustomVideo(this.parentElement)">
            ${previewImgTag}
            <div class="play-badge">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            </div>
          </div>

          <video src="${w.url}" preload="metadata" playsinline onclick="toggleCustomVideo(this.parentElement)" oncontextmenu="return false;"></video>

          <div class="custom-controls">
            <button class="ctrl-btn play-pause-btn" onclick="toggleCustomVideo(this.closest('.video-box'))">
              <svg class="icon-play" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
              <svg class="icon-pause" viewBox="0 0 24 24" fill="currentColor" style="display:none;"><path d="M6 5h4v14H6V5zm8 0h4v14h-4V5z"/></svg>
            </button>
            <div class="ctrl-progress" onclick="seekCustomVideo(event, this)">
              <div class="ctrl-progress-fill"></div>
            </div>
            <span class="ctrl-time">0:00 / 0:00</span>
            <button class="ctrl-btn mute-btn" onclick="toggleMuteVideo(this)">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>
            </button>
            <button class="ctrl-btn fs-btn" onclick="fullscreenCustomVideo(this.closest('.video-box'))">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>
            </button>
          </div>
        </div>

        <div class="work-body">
          <div class="work-meta">
            <span>${w.author || 'hardovere & SodaBarblga'}</span>
            <span>${w.date || ''}</span>
          </div>
          <div class="work-title">${w.title}</div>
          <div class="work-desc">${w.desc || ''}</div>
          <div class="work-langs">${iconsHtml}</div>
        </div>
      </div>
    `;
  }).join('') + `</div>`;

  bindCustomVideoEvents();
}

function bindCustomVideoEvents() {
  document.querySelectorAll('.work-media.video-box').forEach(box => {
    const vid = box.querySelector('video');
    const cover = box.querySelector('.video-preview-cover');
    const previewImg = cover ? cover.querySelector('.preview-img') : null;
    const playIcon = box.querySelector('.icon-play');
    const pauseIcon = box.querySelector('.icon-pause');
    const fill = box.querySelector('.ctrl-progress-fill');
    const timeEl = box.querySelector('.ctrl-time');

    if (!vid) return;

    vid.addEventListener('loadedmetadata', () => {
      if (timeEl) timeEl.textContent = `0:00 / ${formatTime(vid.duration)}`;
      if (previewImg && !previewImg.getAttribute('src')) {
        vid.currentTime = 0.1;
      }
    });

    vid.addEventListener('seeked', () => {
      if (previewImg && !previewImg.getAttribute('src') && vid.paused) {
        try {
          const c = document.createElement('canvas');
          c.width = vid.videoWidth || 640;
          c.height = vid.videoHeight || 360;
          c.getContext('2d').drawImage(vid, 0, 0, c.width, c.height);
          const dataUrl = c.toDataURL('image/jpeg', 0.82);
          if (dataUrl && dataUrl.length > 100) {
            previewImg.src = dataUrl;
            previewImg.style.display = 'block';
          }
        } catch (e) {}
      }
    });

    vid.addEventListener('play', () => {
      document.querySelectorAll('.work-media.video-box').forEach(other => {
        if (other !== box) {
          const ov = other.querySelector('video');
          if (ov && !ov.paused) ov.pause();
        }
      });
      box.classList.add('playing');
      if (cover) cover.classList.add('hidden');
      if (playIcon) playIcon.style.display = 'none';
      if (pauseIcon) pauseIcon.style.display = 'block';
    });

    vid.addEventListener('pause', () => {
      box.classList.remove('playing');
      if (cover) cover.classList.remove('hidden');
      if (playIcon) playIcon.style.display = 'block';
      if (pauseIcon) pauseIcon.style.display = 'none';
    });

    vid.addEventListener('ended', () => {
      vid.currentTime = 0;
      box.classList.remove('playing');
      if (cover) cover.classList.remove('hidden');
      if (playIcon) playIcon.style.display = 'block';
      if (pauseIcon) pauseIcon.style.display = 'none';
    });

    vid.addEventListener('timeupdate', () => {
      const pct = vid.duration ? (vid.currentTime / vid.duration) * 100 : 0;
      if (fill) fill.style.width = `${pct}%`;
      if (timeEl) timeEl.textContent = `${formatTime(vid.currentTime)} / ${formatTime(vid.duration)}`;
    });
  });
}

window.toggleCustomVideo = function(box) {
  if (!box) return;
  const vid = box.querySelector('video');
  if (!vid) return;
  if (vid.paused) {
    const p = vid.play();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  } else {
    vid.pause();
  }
};

window.seekCustomVideo = function(e, bar) {
  e.stopPropagation();
  const box = bar.closest('.video-box');
  const vid = box ? box.querySelector('video') : null;
  if (!vid || !vid.duration) return;
  const rect = bar.getBoundingClientRect();
  const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  vid.currentTime = ratio * vid.duration;
};

window.toggleMuteVideo = function(btn) {
  const box = btn.closest('.video-box');
  const vid = box ? box.querySelector('video') : null;
  if (!vid) return;
  vid.muted = !vid.muted;
  btn.style.opacity = vid.muted ? '0.45' : '1';
};

window.fullscreenCustomVideo = function(box) {
  const vid = box ? box.querySelector('video') : null;
  if (!vid) return;
  if (vid.requestFullscreen) vid.requestFullscreen();
  else if (vid.webkitRequestFullscreen) vid.webkitRequestFullscreen();
};

document.querySelectorAll('.work-filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    currentWorkFilter = btn.getAttribute('data-wfilter');
    document.querySelectorAll('.work-filter-btn').forEach(b => b.classList.toggle('active', b === btn));
    renderPortfolio();
  });
});

window.openLightbox = function(src) {
  const lb = document.getElementById('lightbox');
  const img = document.getElementById('lightbox-img');
  if (lb && img) {
    img.src = src;
    lb.classList.add('open');
  }
};

window.closeLightbox = function() {
  const lb = document.getElementById('lightbox');
  if (lb) lb.classList.remove('open');
};

// 6. Рендер языков
function renderLanguages() {
  const bar = document.getElementById('gh-lang-bar');
  const grid = document.getElementById('langs-grid');
  if (!bar || !grid) return;

  const stats = computeLanguagePercentages(siteData, currentLangFilter);

  bar.innerHTML = stats.items.map(item => {
    if (item.pct <= 0) return '';
    return `<div class="gh-segment" style="width:${item.pct}%; background:${item.color}" title="${item.name}: ${item.pct}%"></div>`;
  }).join('');

  grid.innerHTML = stats.items.map(item => `
    <div class="lang-item">
      <div class="lang-item-left">
        <span class="lang-icon-badge" data-lang-name="${item.name}" style="width:28px; height:28px;">${item.svg}</span>
        <span class="lang-name">${item.name}</span>
      </div>
      <span class="lang-pct">${item.pct}%</span>
    </div>
  `).join('');
}

document.querySelectorAll('.lang-filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    currentLangFilter = btn.getAttribute('data-filter');
    document.querySelectorAll('.lang-filter-btn').forEach(b => b.classList.toggle('active', b === btn));
    renderLanguages();
  });
});

function copyText(txt) {
  navigator.clipboard.writeText(txt);
  const toast = document.getElementById('toast');
  if (toast) {
    toast.textContent = `Скопировано: ${txt}`;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 1800);
  }
}

// 7. Оптимизированный интерактивный фон (батчинг точек + пауза в неактивной вкладке)
const canvas = document.getElementById('bg-canvas');
const ctx = canvas.getContext('2d');
let cw = 0, ch = 0;
const trail = [];
let mouse = { x: -9999, y: -9999 };

function resizeCanvas() {
  cw = canvas.width = window.innerWidth;
  ch = canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

window.addEventListener('mousemove', e => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
  trail.push({ x: mouse.x, y: mouse.y, alpha: 0.42, r: 2.3 });
  if (trail.length > 26) trail.shift();
});

function drawBg() {
  if (!document.hidden) {
    ctx.clearRect(0, 0, cw, ch);
    const rgb = getComputedStyle(document.documentElement).getPropertyValue('--dot-rgb').trim() || '255, 255, 255';
    const step = 36;
    const activeDots = [];

    ctx.fillStyle = `rgba(${rgb}, 0.05)`;
    ctx.beginPath();
    for (let x = step / 2; x < cw; x += step) {
      for (let y = step / 2; y < ch; y += step) {
        const dx = x - mouse.x;
        const dy = y - mouse.y;
        const distSq = dx * dx + dy * dy;
        if (distSq < 22500) {
          activeDots.push({ x, y, dist: Math.sqrt(distSq) });
        } else {
          ctx.moveTo(x + 1, y);
          ctx.arc(x, y, 1, 0, Math.PI * 2);
        }
      }
    }
    ctx.fill();

    for (let i = 0; i < activeDots.length; i++) {
      const d = activeDots[i];
      const factor = 1 - d.dist / 150;
      const a = 0.05 + factor * 0.25;
      const r = 1 + factor * 1.1;
      ctx.fillStyle = `rgba(${rgb}, ${a})`;
      ctx.beginPath();
      ctx.arc(d.x, d.y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    for (let i = trail.length - 1; i >= 0; i--) {
      const p = trail[i];
      ctx.fillStyle = `rgba(${rgb}, ${p.alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      p.alpha *= 0.91;
      p.r *= 0.97;
      if (p.alpha < 0.02) trail.splice(i, 1);
    }
  }
  requestAnimationFrame(drawBg);
}
drawBg();

renderProfiles();
renderPortfolio();
renderLanguages();
