const dummyAnime = {
  "dummy-anime": { title: "Dummy Anime", total_episode: 3, genres: ["Action", "Comedy"], season: "Winter 2026" },
  "sample-anime": { title: "Sample Anime", total_episode: 2, genres: ["Romance"], season: "Spring 2026" }
}

const dummyList = [
  { id: "dummy-anime", slug: "dummy-anime", title: "Dummy Anime", episode: 1 },
  { id: "sample-anime", slug: "sample-anime", title: "Sample Anime", episode: 1 }
]

exports.recentRelease = async (page = 1) => ({ page: Number(page), data: dummyList })

exports.search = async (query = "", page = 1) => {
  const result = dummyList.filter(a => a.title.toLowerCase().includes(query.toLowerCase()));
  return { page: Number(page), query, data: result }
}

exports.popular = async (page = 1) => ({ page: Number(page), data: [...dummyList].reverse() })

exports.genreList = async (page = 1) => ({ page: Number(page), data: ["Action", "Comedy", "Romance"] })

exports.genre = async (genreType, page = 1) => {
  const result = dummyList.filter(a => dummyAnime[a.slug].genres.includes(genreType));
  return { page: Number(page), genre: genreType, data: result }
}

exports.seasonList = async (page = 1) => ({ page: Number(page), data: ["Winter 2026", "Spring 2026"] })

exports.season = async (seasonYear, page = 1) => {
  const result = dummyList.filter(a => dummyAnime[a.slug].season === seasonYear);
  return { page: Number(page), season: seasonYear, data: result }
}

exports.anime = async (slug) => {
  const a = dummyAnime[slug];
  if(!a) throw new Error("Anime not found");
  return {
    slug, title: a.title, genres: a.genres, season: a.season, total_episode: a.total_episode,
    episodes: Array.from({length: a.total_episode}, (_, i) => ({ id: slug, episode: i + 1 }))
  }
}

// Endpoint nonton - format sama kayak SS kamu
exports.animeVideoSource = async (id, episode) => {
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