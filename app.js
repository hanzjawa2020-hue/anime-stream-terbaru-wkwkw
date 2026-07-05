/* ==========================================================================
   DENZ STREAM — app.js
   Sumber data: wajik-anime-api (https://wajik-anime-api.vercel.app/otakudesu)
   Catatan: beberapa endpoint (home, genre detail, detail anime, episode,
   server) tidak punya dokumentasi skema publik yang lengkap, jadi kode ini
   membaca data secara "defensif" — mencoba beberapa nama field yang umum
   dipakai oleh scraper Otakudesu, supaya tetap tampil walau skema sedikit
   berbeda dari yang diharapkan.
   ========================================================================== */

const API_BASE = 'https://wajik-anime-api.vercel.app/otakudesu';
const app = document.getElementById('app');

/* ---------------------------- helpers ---------------------------- */

function pick(obj, keys, fallback = null) {
  if (!obj) return fallback;
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];
  }
  return fallback;
}

function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// find every array item anywhere in an object tree that "looks like" an anime card
function firstArray(obj, candidateKeys) {
  if (!obj) return [];
  for (const k of candidateKeys) {
    if (Array.isArray(obj[k])) return obj[k];
  }
  // fallback: first array found one level deep
  for (const k in obj) {
    if (Array.isArray(obj[k]) && obj[k].length && typeof obj[k][0] === 'object') return obj[k];
  }
  return [];
}

// recursively scan an object/array for entries containing a serverId (streaming server options)
function findServerOptions(node, groupLabel = '') {
  let out = [];
  if (Array.isArray(node)) {
    node.forEach(n => out = out.concat(findServerOptions(n, groupLabel)));
  } else if (node && typeof node === 'object') {
    if (node.serverId || node.server_id) {
      out.push({
        serverId: node.serverId || node.server_id,
        label: pick(node, ['title', 'serverName', 'name', 'quality']) || groupLabel || 'Server',
        group: groupLabel
      });
    }
    for (const k in node) {
      const v = node[k];
      if (Array.isArray(v) || typeof v === 'object') {
        const nextLabel = /^\d{3,4}p$/i.test(k) ? k : groupLabel;
        out = out.concat(findServerOptions(v, nextLabel));
      }
    }
  }
  return out;
}

// recursively scan for first plausible playable URL string in a response
function findStreamUrl(node) {
  if (!node) return null;
  if (typeof node === 'string' && /^https?:\/\//i.test(node)) return node;
  if (Array.isArray(node)) {
    for (const n of node) { const r = findStreamUrl(n); if (r) return r; }
    return null;
  }
  if (typeof node === 'object') {
    for (const k of ['url', 'streamUrl', 'embedUrl', 'link', 'src']) {
      if (typeof node[k] === 'string' && /^https?:\/\//i.test(node[k])) return node[k];
    }
    for (const k in node) {
      const r = findStreamUrl(node[k]);
      if (r) return r;
    }
  }
  return null;
}

function findDownloadLinks(node, out = []) {
  if (!node) return out;
  if (Array.isArray(node)) node.forEach(n => findDownloadLinks(n, out));
  else if (typeof node === 'object') {
    if (typeof node.url === 'string' && /^https?:\/\//i.test(node.url)) {
      out.push({ label: pick(node, ['title', 'quality', 'resolution', 'provider']) || 'Unduh', url: node.url });
    }
    for (const k in node) if (typeof node[k] === 'object') findDownloadLinks(node[k], out);
  }
  return out;
}

async function api(path) {
  const res = await fetch(`${API_BASE}${path}`, { headers: { 'Accept': 'application/json' } });
  if (!res.ok) throw new Error(`Gagal memuat data (status ${res.status})`);
  const json = await res.json();
  return json.data !== undefined ? json : { data: json };
}

function loadingGrid(n = 10) {
  return `<div class="grid">${Array.from({length:n}).map(()=>`<div class="skel skel-card"></div>`).join('')}</div>`;
}

function stateBox(icon, title, msg, retryFn, rawData) {
  const id = 'retry_' + Math.random().toString(36).slice(2);
  const dbgId = 'dbg_' + Math.random().toString(36).slice(2);
  setTimeout(() => {
    const b = document.getElementById(id);
    if (b && retryFn) b.onclick = retryFn;
    const d = document.getElementById(dbgId);
    if (d) d.onclick = () => {
      const pre = d.nextElementSibling;
      pre.style.display = pre.style.display === 'none' ? 'block' : 'none';
    };
  }, 0);
  return `<div class="state-box">
    <div class="icon">${icon}</div>
    <h3>${esc(title)}</h3>
    <p>${esc(msg)}</p>
    ${retryFn ? `<button class="btn btn-ghost" id="${id}">↻ Coba lagi</button>` : ''}
    ${rawData !== undefined ? `<button class="btn btn-ghost" id="${dbgId}" style="margin-left:8px;">🐞 Lihat data mentah</button><pre style="display:none;text-align:left;max-width:700px;margin:16px auto 0;background:#000;padding:14px;border-radius:10px;font-size:11px;color:#7ee787;overflow:auto;max-height:300px;">${esc(JSON.stringify(rawData, null, 2))}</pre>` : ''}
  </div>`;
}

function debugPanel(label, rawData) {
  const id = 'dbg_' + Math.random().toString(36).slice(2);
  setTimeout(() => {
    const b = document.getElementById(id);
    if (!b) return;
    b.onclick = () => {
      const pre = b.nextElementSibling;
      pre.style.display = pre.style.display === 'none' ? 'block' : 'none';
    };
  }, 0);
  return `<button id="${id}" style="font-size:11px;color:var(--text-dim);border:1px dashed var(--border);padding:5px 10px;border-radius:8px;margin-top:10px;">🐞 ${esc(label)}</button><pre style="display:none;text-align:left;margin-top:10px;background:#000;padding:14px;border-radius:10px;font-size:11px;color:#7ee787;overflow:auto;max-height:280px;">${esc(JSON.stringify(rawData, null, 2))}</pre>`;
}

/* ---------------------------- anime card ---------------------------- */

function animeCard(a) {
  const title = pick(a, ['title', 'judul', 'animeTitle'], 'Tanpa judul');
  const poster = pick(a, ['poster', 'thumbnail', 'image', 'cover'], '');
  const id = pick(a, ['animeId', 'id', 'slug'], '');
  const eps = pick(a, ['episodes', 'episodeCount', 'totalEpisode'], null);
  const score = pick(a, ['score', 'rating'], null);
  const status = pick(a, ['status', 'releaseDay', 'latestReleaseDate'], null);
  const type = pick(a, ['type'], null);
  return `<a class="card" href="#/anime/${encodeURIComponent(id)}">
    <div class="poster">
      ${poster ? `<img src="${esc(poster)}" alt="${esc(title)}" loading="lazy" onerror="this.style.opacity=0">` : ''}
      ${eps ? `<div class="tag">EP ${esc(eps)}</div>` : (type ? `<div class="tag">${esc(type)}</div>` : '')}
      ${score ? `<div class="score">★ ${esc(score)}</div>` : ''}
      <div class="play-hint"><div class="circle">▶</div></div>
    </div>
    <div class="body">
      <h3>${esc(title)}</h3>
      <div class="sub"><span>${esc(status || '')}</span></div>
    </div>
  </a>`;
}

function cardGrid(list) {
  if (!list.length) return stateBox('📭', 'Belum ada data', 'Tidak ada anime yang bisa ditampilkan di sini.');
  return `<div class="grid">${list.map(animeCard).join('')}</div>`;
}

function pager(current, hasPrev, hasNext, onGoto) {
  const id = 'pager_' + Math.random().toString(36).slice(2);
  setTimeout(() => {
    const el = document.getElementById(id);
    if (!el) return;
    el.querySelector('.prev').onclick = () => onGoto(current - 1);
    el.querySelector('.next').onclick = () => onGoto(current + 1);
  }, 0);
  return `<div class="pager" id="${id}">
    <button class="prev" ${!hasPrev ? 'disabled' : ''}>←</button>
    <span class="pgnum">HALAMAN ${current}</span>
    <button class="next" ${!hasNext ? 'disabled' : ''}>→</button>
  </div>`;
}

/* ---------------------------- ticker ---------------------------- */

async function loadTicker() {
  const el = document.getElementById('tickerInner');
  try {
    const { data } = await api('/schedule');
    const days = Array.isArray(data) ? data : firstArray(data, ['days', 'scheduleList', 'schedule']);
    let items = [];
    days.forEach(d => {
      const dayName = pick(d, ['day', 'title', 'name'], '');
      const list = firstArray(d, ['animeList', 'anime', 'list']);
      list.slice(0, 6).forEach(a => items.push(`<span>${esc(dayName)}</span> ${esc(pick(a, ['title'], ''))}`));
    });
    if (!items.length) throw new Error('empty');
    el.innerHTML = items.concat(items).join('&nbsp; • &nbsp;');
  } catch {
    el.innerHTML = Array(2).fill('<span>DENZ STREAM</span> Nonton anime sub Indo, update tiap hari, gratis &amp; tanpa ribet.').join('&nbsp; • &nbsp;');
  }
}

/* ---------------------------- genre dropdown ---------------------------- */

let genreCache = null;
async function loadGenreList() {
  if (genreCache) return genreCache;
  const { data } = await api('/genre');
  const list = firstArray(data, ['genreList', 'genres', 'list']);
  genreCache = list.map(g => ({
    id: pick(g, ['genreId', 'id', 'slug'], ''),
    title: pick(g, ['title', 'name', 'genreName'], '')
  })).filter(g => g.id && g.title);
  return genreCache;
}

async function populateGenreDropdown() {
  const panel = document.getElementById('genreDDPanel');
  try {
    const list = await loadGenreList();
    panel.innerHTML = list.map(g => `<a href="#/genre/${encodeURIComponent(g.id)}/1">${esc(g.title)}</a>`).join('');
  } catch {
    panel.innerHTML = `<span style="color:var(--text-dim);font-size:12px;">Gagal memuat genre</span>`;
  }
}

/* ---------------------------- ROUTES ---------------------------- */

async function viewHome() {
  app.innerHTML = `
    <div class="hero" id="heroBox">${loadingGrid(0)}<div style="padding:160px 0;text-align:center;color:var(--text-dim);">Memuat sorotan<span class="loader-dot"><span></span><span></span><span></span></span></div></div>
    <section class="section"><div class="section-head"><div><span class="eyebrow">Sedang Tayang</span><h2>Anime Ongoing</h2></div><a class="more" href="#/ongoing/1">Lihat semua →</a></div><div id="homeOngoing">${loadingGrid()}</div></section>
    <section class="section"><div class="section-head"><div><span class="eyebrow">Rating Tertinggi</span><h2>Paling Populer</h2></div><a class="more" href="#/populer/1">Lihat semua →</a></div><div id="homePopuler">${loadingGrid()}</div></section>
    <section class="section"><div class="section-head"><div><span class="eyebrow">Selesai Tayang</span><h2>Anime Tamat</h2></div><a class="more" href="#/completed/1">Lihat semua →</a></div><div id="homeCompleted">${loadingGrid()}</div></section>
  `;

  let ongoingList = [];
  try {
    const { data } = await api('/ongoing?page=1');
    ongoingList = firstArray(data, ['animeList']);
    document.getElementById('homeOngoing').innerHTML = cardGrid(ongoingList.slice(0, 10));
  } catch (e) {
    document.getElementById('homeOngoing').innerHTML = stateBox('⚠️', 'Gagal memuat', e.message, () => viewHome());
  }
  renderHero(ongoingList.slice(0, 5));

  try {
    const pages = await Promise.all([1, 2].map(p => api(`/completed?page=${p}`).catch(() => null)));
    let comp = [];
    pages.forEach(r => { if (r) comp = comp.concat(firstArray(r.data, ['animeList'])); });
    document.getElementById('homeCompleted').innerHTML = cardGrid(comp.slice(0, 10));
    const populer = [...comp].sort((a, b) => (parseFloat(pick(b, ['score'], 0)) || 0) - (parseFloat(pick(a, ['score'], 0)) || 0));
    document.getElementById('homePopuler').innerHTML = cardGrid(populer.slice(0, 10));
  } catch (e) {
    document.getElementById('homeCompleted').innerHTML = stateBox('⚠️', 'Gagal memuat', e.message, () => viewHome());
    document.getElementById('homePopuler').innerHTML = stateBox('⚠️', 'Gagal memuat', e.message, () => viewHome());
  }
}

let heroTimer = null;
function renderHero(list) {
  const box = document.getElementById('heroBox');
  if (!box) return;
  if (!list.length) { box.innerHTML = stateBox('🎬', 'Sorotan tidak tersedia', 'Coba muat ulang halaman.'); return; }
  box.innerHTML = list.map((a, i) => {
    const title = pick(a, ['title'], '');
    const poster = pick(a, ['poster'], '');
    const id = pick(a, ['animeId', 'id'], '');
    const eps = pick(a, ['episodes'], '');
    const day = pick(a, ['releaseDay'], '');
    return `<div class="hero-slide ${i===0?'active':''}" data-i="${i}">
      <img src="${esc(poster)}" alt="">
      <div class="hero-fade"></div>
      <div class="hero-content">
        <span class="hero-badge">ON AIR</span>
        <h1>${esc(title)}</h1>
        <div class="hero-meta">
          ${eps ? `<span class="chip">Episode ${esc(eps)}</span>` : ''}
          ${day ? `<span class="chip">Rilis ${esc(day)}</span>` : ''}
        </div>
        <div class="hero-cta">
          <a class="btn btn-primary" href="#/anime/${encodeURIComponent(id)}">▶ Tonton Sekarang</a>
          <a class="btn btn-ghost" href="#/ongoing/1">Lihat Ongoing</a>
        </div>
      </div>
    </div>`;
  }).join('') + `<div class="hero-dots">${list.map((_, i) => `<button data-i="${i}" class="${i===0?'active':''}"></button>`).join('')}</div>`;

  let idx = 0;
  clearInterval(heroTimer);
  const slides = box.querySelectorAll('.hero-slide');
  const dots = box.querySelectorAll('.hero-dots button');
  function go(i) {
    idx = i;
    slides.forEach((s, j) => s.classList.toggle('active', j === i));
    dots.forEach((d, j) => d.classList.toggle('active', j === i));
  }
  dots.forEach(d => d.onclick = () => go(parseInt(d.dataset.i)));
  heroTimer = setInterval(() => go((idx + 1) % list.length), 5500);
}

async function viewList(kind, page) {
  const titles = { ongoing: ['Sedang Tayang', 'Anime Ongoing'], completed: ['Selesai Tayang', 'Anime Tamat'], movie: ['Layar Lebar', 'Anime Movie'] };
  const [eyebrow, title] = titles[kind] || ['', ''];
  app.innerHTML = `<section class="section">
    <div class="section-head"><div><span class="eyebrow">${eyebrow}</span><h2>${title}</h2></div></div>
    <div id="listBox">${loadingGrid()}</div>
  </section>`;

  try {
    let data, list, pagination;
    if (kind === 'movie') {
      const genres = await loadGenreList();
      const movieGenre = genres.find(g => /movie/i.test(g.title) || /movie/i.test(g.id));
      if (!movieGenre) {
        document.getElementById('listBox').innerHTML = stateBox('🎞️', 'Kategori Movie tidak ditemukan', 'Sumber data tidak menyediakan genre "Movie" secara terpisah — coba jelajahi lewat Genre lengkap.');
        return;
      }
      ({ data } = await api(`/genre/${encodeURIComponent(movieGenre.id)}?page=${page}`));
      list = firstArray(data, ['animeList']);
      pagination = data.pagination;
    } else {
      ({ data } = await api(`/${kind}?page=${page}`));
      list = firstArray(data, ['animeList']);
      pagination = data.pagination;
    }
    document.getElementById('listBox').innerHTML = cardGrid(list) + pager(
      page,
      page > 1,
      pagination ? pagination.hasNextPage : list.length > 0,
      (p) => { if (p >= 1) location.hash = `#/${kind}/${p}`; }
    );
  } catch (e) {
    document.getElementById('listBox').innerHTML = stateBox('⚠️', 'Gagal memuat daftar', e.message, () => viewList(kind, page));
  }
}

async function viewPopuler(page) {
  app.innerHTML = `<section class="section">
    <div class="section-head"><div><span class="eyebrow">Rating Tertinggi</span><h2>Anime Populer</h2></div></div>
    <p style="color:var(--text-dim);font-size:12.5px;margin-bottom:18px;">*Diurutkan dari skor tertinggi pada daftar anime yang sudah tamat.</p>
    <div id="listBox">${loadingGrid()}</div>
  </section>`;
  try {
    const pages = await Promise.all([1,2,3].map(p => api(`/completed?page=${p}`).catch(() => null)));
    let list = [];
    pages.forEach(r => { if (r) list = list.concat(firstArray(r.data, ['animeList'])); });
    list.sort((a, b) => (parseFloat(pick(b, ['score'], 0)) || 0) - (parseFloat(pick(a, ['score'], 0)) || 0));
    const perPage = 20;
    const start = (page - 1) * perPage;
    const slice = list.slice(start, start + perPage);
    document.getElementById('listBox').innerHTML = cardGrid(slice) + pager(
      page, page > 1, start + perPage < list.length,
      (p) => { if (p >= 1) location.hash = `#/populer/${p}`; }
    );
  } catch (e) {
    document.getElementById('listBox').innerHTML = stateBox('⚠️', 'Gagal memuat', e.message, () => viewPopuler(page));
  }
}

async function viewGenreIndex() {
  app.innerHTML = `<section class="section">
    <div class="section-head"><div><span class="eyebrow">Jelajahi</span><h2>Semua Genre</h2></div></div>
    <div id="genreBox" class="genre-grid">${Array.from({length:18}).map(()=>`<div class="skel" style="height:56px;"></div>`).join('')}</div>
  </section>`;
  try {
    const list = await loadGenreList();
    document.getElementById('genreBox').innerHTML = list.map(g =>
      `<a class="genre-tile" href="#/genre/${encodeURIComponent(g.id)}/1">${esc(g.title)}</a>`
    ).join('') || stateBox('📭', 'Genre tidak ditemukan', '');
  } catch (e) {
    document.getElementById('genreBox').innerHTML = stateBox('⚠️', 'Gagal memuat genre', e.message, () => viewGenreIndex());
  }
}

async function viewGenreDetail(genreId, page) {
  app.innerHTML = `<section class="section">
    <div class="section-head"><div><span class="eyebrow">Genre</span><h2>${esc(genreId)}</h2></div><a class="more" href="#/genre">← Semua genre</a></div>
    <div id="listBox">${loadingGrid()}</div>
  </section>`;
  try {
    const { data } = await api(`/genre/${encodeURIComponent(genreId)}?page=${page}`);
    const list = firstArray(data, ['animeList']);
    const p = data.pagination;
    document.getElementById('listBox').innerHTML = cardGrid(list) + pager(
      page, page > 1, p ? p.hasNextPage : list.length > 0,
      (np) => { if (np >= 1) location.hash = `#/genre/${encodeURIComponent(genreId)}/${np}`; }
    );
  } catch (e) {
    document.getElementById('listBox').innerHTML = stateBox('⚠️', 'Gagal memuat', e.message, () => viewGenreDetail(genreId, page));
  }
}

async function viewSearch(q, page) {
  app.innerHTML = `<section class="section">
    <div class="section-head"><div><span class="eyebrow">Hasil Pencarian</span><h2>"${esc(q)}"</h2></div></div>
    <div id="listBox">${loadingGrid()}</div>
  </section>`;
  try {
    const { data } = await api(`/search?q=${encodeURIComponent(q)}`);
    const list = firstArray(data, ['animeList']);
    document.getElementById('listBox').innerHTML = list.length ? cardGrid(list) :
      stateBox('🔎', 'Tidak ditemukan', `Tidak ada anime yang cocok dengan "${q}".`);
  } catch (e) {
    document.getElementById('listBox').innerHTML = stateBox('⚠️', 'Gagal mencari', e.message, () => viewSearch(q, page));
  }
}

async function viewDetail(animeId) {
  app.innerHTML = `<div class="detail-hero">${loadingGrid(0)}<div style="padding:120px;text-align:center;color:var(--text-dim);">Memuat detail anime…</div></div>`;
  try {
    const { data } = await api(`/anime/${encodeURIComponent(animeId)}`);
    const title = pick(data, ['title', 'englishTitle', 'english'], 'Tanpa judul');
    const poster = pick(data, ['poster'], '');
    const jp = pick(data, ['japanese'], '');
    const synopsisRaw = pick(data, ['synopsis', 'sinopsis'], '');
    const synopsis = typeof synopsisRaw === 'object' ? (synopsisRaw.paragraphs || []).join(' ') : synopsisRaw;
    const genres = firstArray(data, ['genreList', 'genres']);
    const meta = {
      'Skor': pick(data, ['score']),
      'Status': pick(data, ['status']),
      'Tipe': pick(data, ['type']),
      'Total Episode': pick(data, ['totalEpisode', 'episodes', 'episodeCount']),
      'Durasi': pick(data, ['duration']),
      'Tanggal Rilis': pick(data, ['releaseDate', 'aired', 'released']),
      'Musim': pick(data, ['season']),
      'Sumber': pick(data, ['source']),
      'Studio': pick(data, ['studio', 'studios']),
      'Produser': pick(data, ['producers']),
      'Sinonim': pick(data, ['synonyms'])
    };
    const episodes = firstArray(data, ['episodeList', 'episodes']);

    app.innerHTML = `
    <div class="detail-hero">
      <div class="bg">${poster ? `<img src="${esc(poster)}">` : ''}</div>
      <div class="detail-flex">
        <div class="detail-poster"><img src="${esc(poster)}" alt="${esc(title)}"></div>
        <div class="detail-info">
          <h1>${esc(title)}</h1>
          ${jp ? `<div class="jp">${esc(jp)}</div>` : ''}
          <div class="detail-genres">${genres.map(g => `<a class="chip" href="#/genre/${encodeURIComponent(pick(g,['genreId','id'],''))}/1">${esc(pick(g,['title','name'],''))}</a>`).join('')}</div>
          <dl class="meta-table">
            ${Object.entries(meta).filter(([,v]) => v).map(([k,v]) => `<dt>${esc(k)}</dt><dd>${esc(Array.isArray(v)?v.join(', '):v)}</dd>`).join('')}
          </dl>
          ${synopsis ? `<p class="synopsis">${esc(synopsis)}</p>` : ''}
          <div class="detail-actions">
            ${episodes.length ? `<a class="btn btn-primary" href="#/watch/${encodeURIComponent(pick(episodes[0], ['episodeId','id'],''))}">▶ Tonton Episode 1</a>` : ''}
          </div>
        </div>
      </div>
    </div>
    <div class="ep-list">
      <div class="section-head"><div><span class="eyebrow">Daftar Episode</span><h2>${episodes.length} Episode</h2></div></div>
      <div class="ep-grid">
        ${episodes.length ? episodes.map(e => {
          const eid = pick(e, ['episodeId', 'id'], '');
          const etitle = pick(e, ['title', 'episode'], eid);
          return `<a class="ep-item" href="#/watch/${encodeURIComponent(eid)}"><span>${esc(etitle)}</span><span class="num">▶</span></a>`;
        }).join('') : stateBox('📭', 'Belum ada episode', 'Data episode tidak tersedia untuk anime ini.', null, data)}
      </div>
    </div>
    <div class="wrap" style="padding:0;">${debugPanel('Lihat data mentah anime ini', data)}</div>`;
  } catch (e) {
    app.innerHTML = stateBox('⚠️', 'Gagal memuat detail', e.message, () => viewDetail(animeId));
  }
}

async function viewWatch(episodeId) {
  app.innerHTML = `<div class="watch-wrap">
    <div class="player-shell"><div class="player-placeholder">Memuat episode<span class="loader-dot"><span></span><span></span><span></span></span></div></div>
  </div>`;
  try {
    const { data } = await api(`/episode/${encodeURIComponent(episodeId)}`);
    const title = pick(data, ['title'], episodeId);
    const animeId = pick(data, ['animeId'], '');
    const prevId = pick(data, ['prevEpisodeId', 'prevEpisode'], null);
    const nextId = pick(data, ['nextEpisodeId', 'nextEpisode'], null);
    const serverOpts = findServerOptions(data.streamingServers || data.server || data.servers || data);
    const downloads = findDownloadLinks(data.downloadUrl || data.download || {});

    app.innerHTML = `
    <div class="watch-wrap">
      <div class="player-shell" id="playerShell">
        <div class="player-placeholder">
          <div style="font-size:30px;">▶</div>
          <div>${serverOpts.length ? 'Pilih server di bawah untuk mulai menonton' : 'Server streaming tidak ditemukan untuk episode ini'}</div>
        </div>
      </div>
      <div class="watch-title">
        <h1>${esc(title)}</h1>
        <div class="watch-nav">
          <button id="btnPrev" ${prevId ? '' : 'disabled'}>← Sebelumnya</button>
          ${animeId ? `<a class="btn btn-ghost" href="#/anime/${encodeURIComponent(animeId)}" style="padding:9px 16px;font-size:13px;">≡ Semua Episode</a>` : ''}
          <button id="btnNext" ${nextId ? '' : 'disabled'}>Selanjutnya →</button>
        </div>
      </div>
      <div class="server-block">
        <h4>Pilih Server</h4>
        <div id="serverArea">${serverOpts.length ? renderServerGroups(serverOpts) : stateBox('🛰️', 'Server tidak tersedia', 'Coba episode lain atau muat ulang halaman.', null, data)}</div>
      </div>
      ${downloads.length ? `<div class="server-block"><h4>Tautan Unduh</h4><div class="dl-list">${downloads.map(d => `<a href="${esc(d.url)}" target="_blank" rel="noopener">⬇ ${esc(d.label)}</a>`).join('')}</div></div>` : ''}
      ${debugPanel('Lihat data mentah episode ini', data)}
    </div>`;

    if (prevId) document.getElementById('btnPrev').onclick = () => location.hash = `#/watch/${encodeURIComponent(prevId)}`;
    if (nextId) document.getElementById('btnNext').onclick = () => location.hash = `#/watch/${encodeURIComponent(nextId)}`;

    document.querySelectorAll('.server-opts button').forEach(btn => {
      btn.onclick = async () => {
        document.querySelectorAll('.server-opts button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const shell = document.getElementById('playerShell');
        shell.innerHTML = `<div class="player-placeholder">Memuat server<span class="loader-dot"><span></span><span></span><span></span></span></div>`;
        try {
          const res = await api(`/server/${encodeURIComponent(btn.dataset.server)}`);
          const url = findStreamUrl(res.data);
          if (!url) throw new Error('URL streaming tidak ditemukan pada respons server ini.');
          shell.innerHTML = `<iframe src="${esc(url)}" allowfullscreen referrerpolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-presentation"></iframe>`;
        } catch (e) {
          shell.innerHTML = `<div class="player-placeholder"><div>⚠️ ${esc(e.message)}</div><div style="font-size:12px;">Coba pilih server lain.</div></div>`;
          console.warn('[DenzStream] Gagal ambil URL streaming untuk serverId:', btn.dataset.server, e);
        }
      };
    });
    // auto-click first server
    const firstBtn = document.querySelector('.server-opts button');
    if (firstBtn) firstBtn.click();
  } catch (e) {
    app.innerHTML = stateBox('⚠️', 'Gagal memuat episode', e.message, () => viewWatch(episodeId));
  }
}

function renderServerGroups(opts) {
  const groups = {};
  opts.forEach(o => { const g = o.group || 'Server'; (groups[g] = groups[g] || []).push(o); });
  return Object.entries(groups).map(([g, items]) => `
    <div class="server-group">
      <div class="glabel">${esc(g)}</div>
      <div class="server-opts">
        ${items.map(o => `<button data-server="${esc(o.serverId)}">${esc(o.label)}</button>`).join('')}
      </div>
    </div>`).join('');
}

/* ---------------------------- ROUTER ---------------------------- */

function setActiveNav(path) {
  document.querySelectorAll('[data-route]').forEach(a => {
    a.classList.toggle('active', a.dataset.route === path);
  });
}

function router() {
  const hash = location.hash.replace(/^#\/?/, '');
  const parts = hash.split('/').filter(Boolean);
  window.scrollTo({ top: 0, behavior: 'instant' });
  closeMobileMenu();

  if (parts.length === 0) { setActiveNav('/'); viewHome(); return; }

  const [seg, a, b] = parts;
  if (seg === 'ongoing') { setActiveNav('/ongoing'); viewList('ongoing', parseInt(a) || 1); return; }
  if (seg === 'completed') { setActiveNav('/completed'); viewList('completed', parseInt(a) || 1); return; }
  if (seg === 'movie') { setActiveNav('/movie'); viewList('movie', parseInt(a) || 1); return; }
  if (seg === 'populer') { setActiveNav('/populer'); viewPopuler(parseInt(a) || 1); return; }
  if (seg === 'genre' && !a) { setActiveNav('/genre'); viewGenreIndex(); return; }
  if (seg === 'genre' && a) { setActiveNav('/genre'); viewGenreDetail(decodeURIComponent(a), parseInt(b) || 1); return; }
  if (seg === 'search' && a) { setActiveNav(''); viewSearch(decodeURIComponent(a), parseInt(b) || 1); return; }
  if (seg === 'anime' && a) { setActiveNav(''); viewDetail(decodeURIComponent(a)); return; }
  if (seg === 'watch' && a) { setActiveNav(''); viewWatch(decodeURIComponent(a)); return; }

  setActiveNav('/');
  app.innerHTML = stateBox('🧭', 'Halaman tidak ditemukan', 'Coba kembali ke beranda.');
}

/* ---------------------------- UI wiring ---------------------------- */

document.getElementById('searchForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const q = document.getElementById('searchInput').value.trim();
  if (q) location.hash = `#/search/${encodeURIComponent(q)}/1`;
});

const burgerBtn = document.getElementById('burgerBtn');
const mobileMenu = document.getElementById('mobileMenu');
burgerBtn.addEventListener('click', () => mobileMenu.classList.toggle('open'));
function closeMobileMenu() { mobileMenu.classList.remove('open'); }

const genreDD = document.getElementById('genreDD');
genreDD.querySelector('a').addEventListener('click', (e) => {
  if (window.innerWidth > 900) { e.preventDefault(); genreDD.classList.toggle('open'); }
});
document.addEventListener('click', (e) => { if (!genreDD.contains(e.target)) genreDD.classList.remove('open'); });

window.addEventListener('hashchange', router);
window.addEventListener('DOMContentLoaded', () => {
  router();
  loadTicker();
  populateGenreDropdown();
});
if (document.readyState !== 'loading') { router(); loadTicker(); populateGenreDropdown(); }
