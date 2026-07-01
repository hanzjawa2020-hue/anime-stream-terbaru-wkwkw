export async function recentRelease(page = 1) {
  return { results: [{title: "Test Kurama Jalan", slug: "test"}] }; 
}
export async function search(query: any, page = 1) { return { results: [] }
export async function popular(page = 1) { return { results: [] }
export async function genreList(page = 1) { return { results: [] }
export async function genre(genre: string, page = 1) { return { results: [] }
export async function seasonList(page = 1) { return { results: [] }
export async function season(season: string, page = 1) { return { results: [] }
export async function anime(slug: string) { return {} }
export async function animeVideoSource(id: string, ep: string) { return {} }
