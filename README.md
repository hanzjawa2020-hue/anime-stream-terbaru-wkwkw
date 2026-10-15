# OtakuTide — Anime discovery UI

Website frontend statis berbasis HTML, CSS, dan JavaScript murni. Dirancang untuk GitHub Pages dan layar desktop maupun HP, dengan tema gelap/terang, pencarian, filter sumber, detail anime, daftar episode, watchlist lokal, player, serta skeleton loading.

## File

- `index.html` — struktur halaman dan dialog detail/player.
- `style.css` — UI responsif dan tema terang/gelap.
- `script.js` — integrasi API, normalisasi respons, katalog, pencarian, detail, episode, dan player.

## API

Base URL: `https://www.sankavollerei.web.id/anime`

Frontend memakai pola endpoint yang didokumentasikan oleh proyek API, seperti:

- `/anime/home`
- `/anime/{source}/home`
- `/anime/{source}/search/{query}`
- `/anime/{source}/detail/{slug}`
- `/anime/{source}/episode/{slug}`
- `/anime/{source}/genres`
- `/anime/{source}/genre/{slug}`

Kuramanime tidak digunakan. Sumber dewasa Nekopoi juga sengaja tidak dimasukkan. Daftar source ada di awal `script.js` pada konstanta `PROVIDERS`; nama/slug sumber dapat diperbarui di situ jika penyedia API mengganti rute.

## Jalankan di lokal

Buka `index.html` lewat browser. Untuk hasil lebih konsisten, jalankan local server statis (contoh ekstensi Live Server di VS Code) karena browser atau jaringan tertentu membatasi request lintas-origin.

## Deploy ke GitHub Pages

1. Buat repository GitHub baru.
2. Upload ketiga file (`index.html`, `style.css`, `script.js`) dan file `README.md` ke root repository.
3. Buka **Settings → Pages**.
4. Pada **Build and deployment**, pilih **Deploy from a branch**, branch `main`, folder `/ (root)`, lalu **Save**.
5. Tunggu deployment selesai dan buka URL Pages yang disediakan GitHub.

## Catatan koneksi dan player

- GitHub Pages hanya meng-host frontend. Ia tidak bisa memperbaiki API pihak ketiga yang sedang down atau menolak CORS.
- Katalog mengambil sumber secara terpisah; satu sumber gagal tidak akan menghentikan sumber lainnya. Area status API membantu melihat sumber yang merespons.
- Struktur respons source bisa berubah; parser frontend mencoba beberapa variasi field, tetapi perubahan besar pada API tetap perlu penyesuaian kode.
- URL stream/embed harus diizinkan penyedianya. Sebagian iframe dapat menolak ditampilkan di website lain, dan sebagian video memerlukan server/player yang didukung browser. HLS.js dipakai secara opsional dari CDN untuk playback `.m3u8` pada browser yang mendukungnya.
- Watchlist dan preferensi tema disimpan di `localStorage` browser, bukan database/server, jadi tidak otomatis tersinkron ke perangkat lain.
- Gunakan sumber dan tautan media sesuai hukum serta ketentuan layanan yang berlaku.
