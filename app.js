const API_URL = 'https://anime-api-abcd.onrender.com'; // GANTI INI PAKE URL RENDER LU NANTI

async function getAnime(endpoint) {
  try {
    const res = await fetch(`${API_URL}/api/${endpoint}`);
    return await res.json();
  } catch (err) {
    return { error: true };
  }
}

function renderCards(data, containerId) {
  const container = document.getElementById(containerId);
  if (data.error) {
    container.innerHTML = 'Gagal load. Cek backend lu udah jalan belum';
    return;
  }
  container.innerHTML = '';
  data.forEach(anime => {
    container.innerHTML += `
      <div class="card">
        <img src="${anime.thumb}" loading="lazy">
        <h3>${anime.title}</h3>
        <p>${anime.episode || ''}</p>
      </div>
    `;
  });
}