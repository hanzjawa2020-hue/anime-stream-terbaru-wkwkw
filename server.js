const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();
const PORT = 3001;

// ========== DATA DUMMY ==========
const dummyAnime = {
  "dummy-anime": { title: "Dummy Anime", total_episode: 3, genres: ["Action", "Comedy"], season: "Winter 2026" },
  "sample-anime": { title: "Sample Anime", total_episode: 2, genres: ["Romance"], season: "Spring 2026" }
}

const dummyList = [
  { id: "dummy-anime", slug: "dummy-anime", title: "Dummy Anime", episode: 1, image: "https://via.placeholder.com/200x300" },
  { id: "sample-anime", slug: "sample-anime", title: "Sample Anime", episode: 1, image: "https://via.placeholder.com/200x300" }
]

const parser = {
  recentRelease: async (page = 1) => ({ page: Number(page), data: dummyList }),
  search: async (query = "", page = 1) => {
    const result = dummyList.filter(a => a.title.toLowerCase().includes(String(query).toLowerCase()));
    return { page: Number(page), query, data: result }
  },
  popular: async (page = 1) => ({ page: Number(page), data: [...dummyList].reverse() }),
  genreList: async (page = 1) => ({ page: Number(page), data: ["Action", "Comedy", "Romance"] }),
  genre: async (genreType, page = 1) => {
    const result = dummyList.filter(a => dummyAnime[a.slug].genres.includes(genreType));
    return { page: Number(page), genre: genreType, data: result }
  },
  seasonList: async (page = 1) => ({ page: Number(page), data: ["Winter 2026", "Spring 2026"] }),
  season: async (seasonYear, page = 1) => {
    const result = dummyList.filter(a => dummyAnime[a.slug].season === seasonYear);
    return { page: Number(page), season: seasonYear, data: result }
  },
  anime: async (slug) => {
    const a = dummyAnime;
    if(!a) throw new Error("Anime not found");
    return {
      slug, title: a.title, genres: a.genres, season: a.season, total_episode: a.total_episode, image: "https://via.placeholder.com/300x400",
      episodes: Array.from({length: a.total_episode}, (_, i) => ({ id: slug, episode: i + 1 }))
    }
  },
  animeVideoSource: async (id, episode) => {
    const ep = Number(episode);
    const a = dummyAnime[id];
    if(!a) throw new Error("Anime not found");
    return {
      episode: ep,
      title: `${a.title} Episode ${ep}`,
      video: [
        { quality: "480p", url: `http://localhost:3001/videos/ep${ep}.mp4` },
        { quality: "720p", url: `http://localhost:3001/videos/ep${ep}.mp4` }
      ],
      next_episode: ep < a.total_episode? ep + 1 : null,
      prev_episode: ep > 1? ep - 1 : null
    }
  }
}

// ========== ROUTER ==========
app.use(cors());
app.use(express.json());
app.use('/videos', express.static(path.join(__dirname, 'videos'))); // serve video

app.get("/", (req, res) => res.send("Kuramanime Server is ready 🚀"));
app.get("/recent", async (req, res) => { try { res.json(await parser.recentRelease(req.query.page)) } catch(e) { res.status(500).json({error: e.toString()}) }});
app.get("/search", async (req, res) => { try { res.json(await parser.search(req.query, req.query.page)) } catch(e) { res.status(500).json({error: e.toString()}) }});
app.get("/popular", async (req, res) => { try { res.json(await parser.popular(req.query.page)) } catch(e) { res.status(500).json({error: e.toString()}) }});
app.get("/genre", async (req, res) => { try { res.json(await parser.genreList(req.query.page)) } catch(e) { res.status(500).json({error: e.toString()}) }});
app.get("/genre/:genre", async (req, res) => { try { res.json(await parser.genre(req.params.genre, req.query.page)) } catch(e) { res.status(500).json({error: e.toString()}) }});
app.get("/season", async (req, res) => { try { res.json(await parser.seasonList(req.query.page)) } catch(e) { res.status(500).json({error: e.toString()}) }});
app.get("/season/:season", async (req, res) => { try { res.json(await parser.season(req.params.season, req.query.page)) } catch(e) { res.status(500).json({error: e.toString()}) }});
app.get("/anime/:animeSlug", async (req, res) => { try { res.json(await parser.anime(req.params.animeSlug)) } catch(e) { res.status(500).json({error: e.toString()}) }});
app.get("/anime/:animeId/:episodeId", async (req, res) => { try { res.json(await parser.animeVideoSource(req.params.animeId, req.params.episodeId)) } catch(e) { res.status(500).json({error: e.toString()}) }});

// ========== FRONTEND ==========
app.get('/index.html', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Anime Dummy Player</title>
<style>
  body{font-family:sans-serif;background:#0f0f0f;color:#eee;margin:0;padding:20px}
.container{max-width:1000px;margin:auto}
.card{background:#1a1a1a;padding:15px;border-radius:10px;margin-bottom:15px}
  button,select,input{padding:8px 12px;margin:5px;background:#2a2a2a;color:#eee;border:1px solid #333;border-radius:6px;cursor:pointer}
  button:hover{background:#333}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px}
.anime-card{background:#222;border-radius:8px;overflow:hidden;cursor:pointer;text-align:center}
.anime-card img{width:100%;height:250px;object-fit:cover}
  video{width:100%;border-radius:8px;background:#000;margin-top:10px}
.ep-list button{margin:3px}
.active{background:#0a84ff!important}
.hidden{display:none}
</style>
</head>
<body>
<div class="container">
  <h1>🎬 Anime Dummy Player</h1>
  <div class="card">
    <button onclick="loadRecent()">Recent</button>
    <button onclick="loadPopular()">Popular</button>
    <input id="search" placeholder="Search anime...">
    <button onclick="doSearch()">Cari</button>
    <div id="list" class="grid"></div>
  </div>
  <div class="card hidden" id="detail">
    <h2 id="title"></h2>
    <p id="info"></p>
    <div class="ep-list" id="episodes"></div>
    <h3>Player</h3>
    <select id="quality" onchange="changeQuality()"></select>
    <video id="player" controls></video>
    <div>
      <button id="prevBtn" onclick="prevEp()">⏮ Prev</button>
      <button id="nextBtn" onclick="nextEp()">Next ⏭</button>
    </div>
  </div>
</div>
<script>
const API = "http://localhost:3001";
let currentSlug, currentEp, videoData;
async function fetchAPI(url){ const res = await fetch(url); return res.json(); }
async function loadRecent(){ const json = await fetchAPI(\`\${API}/recent\`); showList(json.data); }
async function loadPopular(){ const json = await fetchAPI(\`\${API}/popular\`); showList(json.data); }
async function doSearch(){ const q = document.getElementById('search').value; const json = await fetchAPI(\`\${API}/search?query=\${q}\`); showList(json.data); }
function showList(data){ document.getElementById('list').innerHTML = data.map(a => \`<div class="anime-card" onclick="loadAnime('\${a.slug}')">
      <img src="\${a.image}" alt="\${a.title}"><p>\${a.title}</p></div>\`).join(''); }
async function loadAnime(slug){ currentSlug = slug; const data = await fetchAPI(\`\${API}/anime/\${slug}\`);
  document.getElementById('detail').classList.remove('hidden');
  document.getElementById('title').innerText = data.title;
  document.getElementById('info').innerText = \`\${data.genres.join(', ')} | \${data.season} | \${data.total_episode} Ep\`;
  document.getElementById('episodes').innerHTML = data.episodes.map(e => \`<button id="ep-\${e.episode}" onclick="playEp(\${e.episode})">Ep \${e.episode}</button>\`).join('');
  playEp(1); document.getElementById('detail').scrollIntoView(); }
async function playEp(ep){ currentEp = ep; document.querySelectorAll('.ep-list button').forEach(b=>b.classList.remove('active'));
  document.getElementById(\`ep-\${ep}\`).classList.add('active');
  videoData = await fetchAPI(\`\${API}/anime/\${currentSlug}/\${ep}\`);
  const qualitySel = document.getElementById('quality');
  qualitySel.innerHTML = videoData.video.map(v => \`<option value="\${v.url}">\${v.quality}</option>\`).join('');
  document.getElementById('player').src = videoData.video[0].url;
  document.getElementById('prevBtn').disabled =!videoData.prev_episode;
  document.getElementById('nextBtn').disabled =!videoData.next_episode; }
function changeQuality(){ const url = document.getElementById('quality').value; const player = document.getElementById('player');
  const time = player.currentTime; player.src = url; player.currentTime = time; player.play(); }
function nextEp(){ if(videoData.next_episode) playEp(videoData.next_episode) }
function prevEp(){ if(videoData.prev_episode) playEp(videoData.prev_episode) }
loadRecent();
</script>
</body>
</html>`)
})

// Redirect root ke index.html
app.get('/', (req, res, next) => { if(req.path === '/') return res.redirect('/index.html'); next(); })

app.listen(PORT, () => console.log(`✅ Server jalan: http://localhost:${PORT}`));