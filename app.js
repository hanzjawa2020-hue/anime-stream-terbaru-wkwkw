/* ==========================================================================
   DENZ STREAM — Fixed Version (Tinggal Tempel)
   ========================================================================== */

const PROXY = 'https://corsproxy.io/?';
const API_BASE = PROXY + encodeURIComponent('https://wajik-anime-api.vercel.app/otakudesu');
const app = document.getElementById('app');

// Fungsi pembantu
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

async function api(path) {
  try {
    const res = await fetch(`${API_BASE}${path}`, { headers: { 'Accept': 'application/json' } });
    if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
    const json = await res.json();
    return json.data !== undefined ? json : { data: json };
  } catch (e) {
    console.error("API Error:", e);
    throw e;
  }
}

// Fungsi minimalis untuk menampilkan data
async function viewHome() {
  app.innerHTML = '<div style="padding:50px; text-align:center;">Memuat data dari server...</div>';
  try {
    const { data } = await api('/ongoing');
    const list = data.animeList || [];
    
    app.innerHTML = `
      <section class="section">
        <div class="section-head"><h2>Anime Ongoing</h2></div>
        <div class="grid">${list.map(a => `
          <div class="card">
            <div class="poster"><img src="${esc(a.poster)}" loading="lazy"></div>
            <div class="body"><h3>${esc(a.title)}</h3></div>
          </div>`).join('')}
        </div>
      </section>`;
  } catch (e) {
    app.innerHTML = '<div style="padding:50px; text-align:center; color:red;">Gagal memuat. Periksa koneksi atau Proxy.</div>';
  }
}

// Inisialisasi
window.addEventListener('DOMContentLoaded', () => {
  viewHome();
});
