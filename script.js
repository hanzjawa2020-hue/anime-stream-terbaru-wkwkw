/* OtakuTide — vanilla JS frontend for Sanka anime endpoints.
   No Kuramanime routes are requested. Provider availability and response shapes
   can change upstream; failed providers are isolated so the rest of the site works. */
(() => {
  'use strict';

  const API_BASE = 'https://www.sankavollerei.web.id/anime';
  const REQUEST_TIMEOUT = 9500;
  const CACHE_TTL = 3 * 60 * 1000;
  const PAGE_SIZE = 18;
  const DEFAULT_GENRES = ['action', 'adventure', 'comedy', 'fantasy', 'romance'];

  // All known non-Kuramanime anime/donghua providers listed by the API project.
  // Nekopoi is intentionally omitted because it is an adult-content source.
  const PROVIDERS = [
    { id: 'otakudesu', name: 'Otakudesu', group: 'Anime' },
    { id: 'samehadaku', name: 'Samehadaku', group: 'Anime' },
    { id: 'animasu', name: 'Animasu', group: 'Anime' },
    { id: 'zoronime', name: 'Zoronime', group: 'Anime' },
    { id: 'anoboy', name: 'Anoboy', group: 'Anime' },
    { id: 'nimegami', name: 'Nimegami', group: 'Anime' },
    { id: 'kusonime', name: 'Kusonime', group: 'Anime' },
    { id: 'alqanime', name: 'Alqanime', group: 'Anime' },
    { id: 'oploverz', name: 'Oploverz', group: 'Anime' },
    { id: 'animeindo', name: 'Anime Indo', group: 'Anime' },
    { id: 'animekuindo', name: 'Animekuindo', group: 'Anime' },
    { id: 'winbu', name: 'Winbu', group: 'Anime' },
    { id: 'animekompi', name: 'Animekompi', group: 'Anime' },
    { id: 'donghua', name: 'Donghua / Anichin', group: 'Donghua', aliases: ['anichin'] },
    { id: 'donghub', name: 'Donghub', group: 'Donghua' },
    { id: 'dramabox', name: 'DramaBox', group: 'Drama' },
    { id: 'drachin', name: 'Drachin', group: 'Drama' }
  ];

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const state = {
    catalog: [], filteredCatalog: [], latest: [], searchResults: [], watchlist: readJSON('otakutide-watchlist', []),
    status: Object.fromEntries(PROVIDERS.map(p => [p.id, { state: 'idle', count: 0 }])),
    selectedSource: 'all', selectedGenre: '', page: 1, heroIndex: 0, heroItems: [], currentDetail: null,
    currentEpisode: null, currentStreams: [], activeServer: 0, currentSearch: '', currentView: 'home', availableGenres: [], genreSource: 'all',
    loading: false, toastTimer: null, observer: null, lastFocused: null
  };
  const requestCache = new Map();

  function readJSON(key, fallback) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || 'null');
      return parsed == null ? fallback : parsed;
    } catch { return fallback; }
  }
  function writeJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Private mode/storage full */ }
  }
  function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }
  function safeUrl(value) {
    if (typeof value !== 'string') return '';
    const trimmed = value.trim();
    if (!trimmed || trimmed.startsWith('data:') || trimmed.startsWith('javascript:')) return '';
    try {
      const url = new URL(trimmed, API_BASE + '/');
      if (url.protocol !== 'https:' && url.protocol !== 'http:') return '';
      return url.href;
    } catch { return ''; }
  }
  function cleanText(value) {
    if (value == null) return '';
    if (typeof value === 'string' || typeof value === 'number') return String(value).trim();
    if (Array.isArray(value)) return value.map(cleanText).filter(Boolean).join(', ');
    if (typeof value === 'object') return cleanText(value.name || value.title || value.label || value.text || '');
    return '';
  }
  function titleOf(item) {
    if (!item || typeof item !== 'object') return '';
    return cleanText(item.title || item.name || item.animeTitle || item.anime_title || item.judul || item.seriesName || item.movieTitle || item.nama) || 'Anime tanpa judul';
  }
  function posterOf(item) {
    if (!item || typeof item !== 'object') return '';
    const keys = ['poster', 'thumbnail', 'image', 'img', 'cover', 'imageUrl', 'posterUrl', 'coverImage', 'thumbnailUrl', 'image_url', 'poster_url', 'thumb', 'photo', 'banner'];
    for (const key of keys) {
      const candidate = item[key];
      if (typeof candidate === 'string' && candidate.trim()) {
        const url = safeUrl(candidate);
        if (url) return url;
      }
      if (candidate && typeof candidate === 'object') {
        const nested = safeUrl(candidate.url || candidate.src || candidate.original || '');
        if (nested) return nested;
      }
    }
    return '';
  }
  function textOf(item, keys) {
    for (const key of keys) {
      const result = cleanText(item?.[key]);
      if (result) return result;
    }
    return '';
  }
  function slugOf(item) {
    const candidate = textOf(item, ['animeId', 'slug', 'endpoint', 'animeSlug', 'detailId', 'id', 'anime_id', 'animeUrl', 'detailUrl', 'otakudesuUrl', 'samehadakuUrl', 'link', 'href', 'url']);
    if (!candidate) return titleOf(item).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    try {
      if (/^https?:\/\//i.test(candidate)) {
        const parsed = new URL(candidate);
        const parts = parsed.pathname.split('/').filter(Boolean);
        return parts.pop() || candidate;
      }
    } catch { /* keep candidate */ }
    return candidate.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean).pop() || candidate;
  }
  function flattenObjects(value, out = [], depth = 0) {
    if (!value || depth > 7) return out;
    if (Array.isArray(value)) {
      for (const entry of value) {
        if (entry && typeof entry === 'object') out.push(entry);
        flattenObjects(entry, out, depth + 1);
      }
      return out;
    }
    if (typeof value === 'object') {
      for (const entry of Object.values(value)) {
        if (Array.isArray(entry) || (entry && typeof entry === 'object')) flattenObjects(entry, out, depth + 1);
      }
    }
    return out;
  }
  function findAnimeList(raw) {
    if (Array.isArray(raw)) {
      const good = raw.filter(v => v && typeof v === 'object' && titleOf(v) !== 'Anime tanpa judul' && (posterOf(v) || slugOf(v)));
      if (good.length) return good;
    }
    const candidates = [];
    const seen = new Set();
    function walk(value, depth = 0) {
      if (!value || depth > 7) return;
      if (Array.isArray(value)) {
        const list = value.filter(v => v && typeof v === 'object' && titleOf(v) !== 'Anime tanpa judul' && (posterOf(v) || slugOf(v)));
        if (list.length && !seen.has(value)) { candidates.push({ list, score: list.length + list.filter(x => posterOf(x)).length * 2 }); seen.add(value); }
        for (const x of value.slice(0, 60)) if (x && typeof x === 'object') walk(x, depth + 1);
      } else if (typeof value === 'object') {
        for (const [key, child] of Object.entries(value)) {
          if (child && typeof child === 'object') {
            const keyWeight = /anime|latest|popular|ongoing|complete|recent|home|list|data|result|release|update/i.test(key) ? 4 : 0;
            if (Array.isArray(child)) {
              const list = child.filter(v => v && typeof v === 'object' && titleOf(v) !== 'Anime tanpa judul' && (posterOf(v) || slugOf(v)));
              if (list.length && !seen.has(child)) { candidates.push({ list, score: list.length + list.filter(x => posterOf(x)).length * 2 + keyWeight }); seen.add(child); }
            }
            walk(child, depth + 1);
          }
        }
      }
    }
    walk(raw);
    candidates.sort((a, b) => b.score - a.score);
    return candidates[0]?.list || [];
  }
  function findFirstObject(raw) {
    if (!raw || typeof raw !== 'object') return {};
    if (Array.isArray(raw)) return raw.find(v => v && typeof v === 'object') || {};
    for (const key of ['data', 'result', 'anime', 'detail', 'animeDetail', 'movie', 'item']) {
      const child = raw[key];
      if (child && typeof child === 'object' && !Array.isArray(child)) {
        const found = findFirstObject(child);
        if (Object.keys(found).length) return found;
      }
    }
    return raw;
  }
  function findEpisodes(raw) {
    const episodeKey = /episode|eps|listEpisode|episodeList|episode_list/i;
    const specificFields = ['episodeId', 'episodeNumber', 'episodeSlug', 'episodeUrl', 'episode_url', 'streamUrl', 'stream_url', 'ep'];
    const arrays = [];
    function visit(value, key = '', depth = 0) {
      if (!value || depth > 7) return;
      if (Array.isArray(value)) {
        const namedAsEpisodes = episodeKey.test(key);
        const possible = value.filter(entry => {
          if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return false;
          const hasEpisodeField = specificFields.some(field => entry[field] != null && cleanText(entry[field]) !== '');
          const title = textOf(entry, ['title', 'name', 'label']);
          const titleLooksLikeEpisode = /\b(ep(isode)?|episode|eps)\s*[-:#.]?\s*\d+/i.test(title);
          return (namedAsEpisodes || hasEpisodeField || titleLooksLikeEpisode) && (title || slugOf(entry));
        });
        if (possible.length && (namedAsEpisodes || possible.some(entry => specificFields.some(field => entry[field] != null)))) {
          arrays.push({ list: possible, score: possible.length + (namedAsEpisodes ? 300 : 100) });
        }
        for (const entry of value.slice(0, 100)) if (entry && typeof entry === 'object') visit(entry, key, depth + 1);
      } else if (typeof value === 'object') {
        for (const [childKey, child] of Object.entries(value)) {
          if (child && typeof child === 'object') visit(child, childKey, depth + 1);
        }
      }
    }
    visit(raw);
    arrays.sort((a, b) => b.score - a.score);
    return arrays[0]?.list || [];
  }
  function findDescription(raw, item) {
    const direct = textOf(item, ['synopsis', 'description', 'desc', 'plot', 'sinopsis', 'overview', 'story', 'summary']);
    if (direct) return direct;
    const objects = flattenObjects(raw);
    for (const object of objects) {
      const candidate = textOf(object, ['synopsis', 'description', 'desc', 'plot', 'sinopsis', 'overview', 'story', 'summary']);
      if (candidate && candidate.length > 35) return candidate;
    }
    return 'Sinopsis belum tersedia dari sumber API ini.';
  }
  function normaliseAnime(item, source) {
    return {
      raw: item,
      title: titleOf(item),
      poster: posterOf(item),
      slug: slugOf(item),
      source: source?.id || item.source || 'otakudesu',
      sourceName: source?.name || item.sourceName || item.source || 'Sumber anime',
      episode: textOf(item, ['episode', 'episodes', 'latestEpisode', 'latest_episode', 'episodeNumber', 'ep', 'chapter']),
      updated: textOf(item, ['releasedOn', 'releaseDate', 'latestReleaseDate', 'updatedAt', 'date', 'updated', 'release_day']),
      score: textOf(item, ['score', 'rating', 'rate', 'ratingScore']),
      type: textOf(item, ['type', 'format', 'status'])
    };
  }
  function dedupe(list) {
    const map = new Map();
    list.forEach(item => {
      const key = `${item.title.toLowerCase().replace(/[^a-z0-9]+/g, '')}|${item.poster || ''}`;
      const previous = map.get(key);
      if (!previous || (item.poster && !previous.poster)) map.set(key, item);
    });
    return [...map.values()];
  }
  function providerById(id) { return PROVIDERS.find(p => p.id === id) || PROVIDERS.find(p => p.aliases?.includes(id)) || PROVIDERS[0]; }
  function apiPath(source, kind, value = '') {
    const safeSource = encodeURIComponent(source);
    const safeValue = encodeURIComponent(String(value).trim().replace(/^\/+|\/+$/g, ''));
    if (kind === 'defaultHome') return `${API_BASE}/home`;
    if (kind === 'home') return `${API_BASE}/${safeSource}/home`;
    if (kind === 'search') return `${API_BASE}/${safeSource}/search/${safeValue}`;
    if (kind === 'detail') return `${API_BASE}/${safeSource}/detail/${safeValue}`;
    if (kind === 'episode') return `${API_BASE}/${safeSource}/episode/${safeValue}`;
    if (kind === 'genres') return `${API_BASE}/${safeSource}/genres`;
    if (kind === 'genre') return `${API_BASE}/${safeSource}/genre/${safeValue}`;
    return `${API_BASE}/${safeSource}/home`;
  }
  async function fetchJson(url, useCache = true) {
    const now = Date.now();
    const cached = requestCache.get(url);
    if (useCache && cached && now - cached.time < CACHE_TTL) return cached.data;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
    try {
      const response = await fetch(url, {
        method: 'GET', mode: 'cors', cache: 'no-store', signal: controller.signal,
        headers: { Accept: 'application/json, text/plain, */*' }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const contentType = response.headers.get('content-type') || '';
      const text = await response.text();
      if (!text) throw new Error('Respons API kosong');
      let parsed;
      try { parsed = JSON.parse(text); }
      catch {
        if (contentType.includes('text/html') || /<!doctype html|<html/i.test(text.slice(0, 180))) throw new Error('API mengembalikan HTML, bukan JSON');
        throw new Error('Format JSON tidak valid');
      }
      if (parsed && typeof parsed === 'object' && (parsed.statusCode >= 400 || parsed.status === 'error' || parsed.success === false)) {
        throw new Error(cleanText(parsed.message || parsed.error || 'API melaporkan error') || 'API error');
      }
      requestCache.set(url, { time: now, data: parsed });
      return parsed;
    } finally { clearTimeout(timeout); }
  }
  async function fetchProviderHome(provider, force = false) {
    const paths = [apiPath(provider.id, 'home')];
    (provider.aliases || []).forEach(alias => paths.push(apiPath(alias, 'home')));
    let lastError;
    for (const url of paths) {
      try {
        const data = await fetchJson(url, !force);
        const list = findAnimeList(data);
        if (!list.length) throw new Error('Tidak ada daftar anime pada respons');
        state.status[provider.id] = { state: 'online', count: list.length, at: Date.now() };
        return list.map(item => normaliseAnime(item, provider));
      } catch (error) { lastError = error; }
    }
    state.status[provider.id] = { state: 'offline', count: 0, error: lastError?.message || 'Tidak dapat terhubung', at: Date.now() };
    return [];
  }

  function skeletonCards(count = 6, grid = false) {
    return Array.from({ length: count }, () => `<div class="skeleton-card"><div class="skeleton-block skeleton-poster"></div><div class="skeleton-block skeleton-line"></div><div class="skeleton-block skeleton-line short"></div></div>`).join('');
  }
  function renderSkeletons() {
    $('#latestShelf').innerHTML = skeletonCards(6);
    $('#animeGrid').innerHTML = skeletonCards(12, true);
    $('#hero').classList.add('is-loading');
    renderSourceStatuses();
  }
  function posterFallback(title) {
    const initials = title.split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0]).join('').toUpperCase() || 'AN';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="420" viewBox="0 0 300 420"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#43220e"/><stop offset="1" stop-color="#100b08"/></linearGradient><radialGradient id="r"><stop stop-color="#ff822d" stop-opacity=".4"/><stop offset="1" stop-color="#ff822d" stop-opacity="0"/></radialGradient></defs><rect width="300" height="420" fill="url(#g)"/><circle cx="235" cy="75" r="150" fill="url(#r)"/><path d="M0 330 300 120M0 380 300 170" stroke="#ff822d" stroke-opacity=".12" stroke-width="2"/><text x="150" y="194" text-anchor="middle" fill="#ff9b54" font-family="sans-serif" font-size="58" font-weight="800">${initials.replace(/[&<>]/g, '')}</text><text x="150" y="237" text-anchor="middle" fill="#f2ddcd" font-family="sans-serif" font-size="11">POSTER TIDAK TERSEDIA</text></svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }
  function cardHTML(item, index = 0) {
    const poster = item.poster || posterFallback(item.title);
    const source = providerById(item.source);
    const label = item.episode ? `EP ${item.episode}` : (item.type || source.name);
    const score = item.score && Number.isFinite(Number(item.score)) ? `✦ ${escapeHTML(item.score)}` : '';
    return `<article class="anime-card" tabindex="0" role="button" aria-label="Lihat detail ${escapeHTML(item.title)}" data-open-anime="${index}">
      <div class="poster-wrap"><img class="poster-image" src="${escapeHTML(poster)}" alt="Poster ${escapeHTML(item.title)}" loading="lazy" decoding="async" data-fallback-title="${escapeHTML(item.title)}"><span class="poster-badge">${escapeHTML(label.slice(0, 22))}</span>${score ? `<span class="poster-rating">${score}</span>` : ''}<span class="card-play" aria-hidden="true">▶</span></div>
      <div class="card-title">${escapeHTML(item.title)}</div><div class="card-subtitle">${escapeHTML(item.updated || source.name)}</div>
    </article>`;
  }
  function emptyHTML(title, description, buttonLabel = '') {
    return `<div class="empty-state"><strong>${escapeHTML(title)}</strong><span>${escapeHTML(description)}</span>${buttonLabel ? `<button class="outline-button" type="button" data-empty-retry>${escapeHTML(buttonLabel)}</button>` : ''}</div>`;
  }
  function setLazyFallbacks(root) {
    $$('img[data-fallback-title]', root).forEach(img => {
      if (img.dataset.fallbackBound) return;
      img.dataset.fallbackBound = '1';
      img.addEventListener('error', () => {
        if (!img.src.startsWith('data:image/svg+xml')) img.src = posterFallback(img.dataset.fallbackTitle || 'Anime');
      }, { once: true });
    });
  }
  function renderShelf(list, rootSelector, max = 14) {
    const root = $(rootSelector);
    if (!list.length) {
      root.innerHTML = `<div class="empty-state" style="min-width:100%;grid-column:1/-1"><strong>Belum ada data dari sumber ini</strong><span>Periksa koneksi API atau pilih sumber lain.</span></div>`;
      return;
    }
    root.innerHTML = list.slice(0, max).map((item, i) => cardHTML(item, i)).join('');
    setLazyFallbacks(root);
  }
  function renderGrid(list, rootSelector, max = Infinity) {
    const root = $(rootSelector);
    if (!list.length) {
      root.innerHTML = emptyHTML('Anime belum ditemukan', 'Coba sumber lain, ubah kata kunci, atau muat ulang data API.', 'Coba muat ulang');
      return;
    }
    root.innerHTML = list.slice(0, max).map((item, i) => cardHTML(item, i)).join('');
    setLazyFallbacks(root);
  }
  function renderHero(items) {
    const valid = items.filter(item => item.title && item.title !== 'Anime tanpa judul');
    state.heroItems = valid.slice(0, 8);
    if (!state.heroItems.length) {
      $('#hero').classList.remove('is-loading');
      $('#heroArt').removeAttribute('src');
      $('#heroTitle').textContent = 'Cerita baru menunggumu.';
      $('#heroMeta').innerHTML = '<span>Katalog anime lintas sumber</span><span class="meta-dot">•</span><span>Sub Indo</span>';
      $('#heroDescription').textContent = 'Sumber belum mengirimkan katalog. Tekan Coba lagi atau pilih sumber yang tersedia di bawah.';
      $('#heroIndicators').innerHTML = '';
      return;
    }
    state.heroIndex = Math.min(state.heroIndex, state.heroItems.length - 1);
    drawHero();
  }
  function drawHero() {
    const item = state.heroItems[state.heroIndex];
    if (!item) return;
    $('#hero').classList.remove('is-loading');
    const art = $('#heroArt');
    art.alt = `Artwork ${item.title}`;
    art.src = item.poster || posterFallback(item.title);
    art.onerror = () => { art.onerror = null; art.src = posterFallback(item.title); };
    $('#heroTitle').textContent = item.title;
    $('#heroSource').textContent = item.sourceName.toUpperCase();
    const metaParts = [item.type
