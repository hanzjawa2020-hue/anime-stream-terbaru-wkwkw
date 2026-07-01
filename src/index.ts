import express, { Request, Response } from "express";
import cors from "cors";

// ===== 1. IMPORT 22 PARSER KAMU DI SINI =====
import * as KuramaParser from "./parser/kurama";
import * as OtakuParser from "./parser/otaku";
import * as Anime3Parser from "./parser/anime3";
// import * as Anime4Parser from "./parser/anime4"; // COPY SAMPE 22

const app = express();
app.use(cors());
app.use(express.json());

// ===== 2. DAFTAR 22 API SOURCES =====
const API_SOURCES = [
  { name: 'Kurama', parser: KuramaParser },
  { name: 'Otaku', parser: OtakuParser },
  { name: 'Anime3', parser: Anime3Parser },
  // { name: 'Anime4', parser: Anime4Parser }, // COPY SAMPE 22
];

// ===== 3. FUNGSI FALLBACK INTI ANTI MATI =====
async function tryAllSources(fn: string,...args: any[]) {
  let lastError = 'All sources down';
  for (const source of API_SOURCES) {
    try {
      if (typeof source.parser[fn] === 'function') {
        const data = await source.parser[fn](...args);
        if (data && (Array.isArray(data)? data.length > 0 : true)) {
          return { source: source.name, data }; // DAPET YANG HIDUP
        }
      }
    } catch (e: any) {
      console.log(`${source.name} gagal di ${fn}: ${e.message}`);
    }
  }
  throw new Error(lastError);
}

// ===== 4. SEMUA ROUTE PAKE FALLBACK =====
app.get("/", (req: Request, res: Response) => res.send("Anime 22API Server Ready 🚀"));

app.get("/recent", async (req: Request, res: Response) => {
  try { const r = await tryAllSources('recentRelease', req.query.page || 1); res.json({source: r.source,...r.data}) }
  catch(err:any){ res.status(500).json({ error: "Semua API mati", message: err.toString() }); }
});

app.get("/search", async (req: Request, res: Response) => {
  try { const r = await tryAllSources('search', req.query, req.query.page || 1); res.json({source: r.source,...r.data}) }
  catch(err:any){ res.status(500).json({ error: "Semua API mati", message: err.toString() }); }
});

app.get("/popular", async (req: Request, res: Response) => {
  try { const r = await tryAllSources('popular', req.query.page || 1); res.json({source: r.source,...r.data}) }
  catch(err:any){ res.status(500).json({ error: "Semua API mati", message: err.toString() }); }
});

app.get("/genre", async (req: Request, res: Response) => {
  try { const r = await tryAllSources('genreList', req.query.page || 1); res.json({source: r.source,...r.data}) }
  catch(err:any){ res.status(500).json({ error: "Semua API mati", message: err.toString() }); }
});

app.get("/genre/:genre", async (req: Request, res: Response) => {
  try { const r = await tryAllSources('genre', req.params.genre, req.query.page || 1); res.json({source: r.source,...r.data}) }
  catch(err:any){ res.status(500).json({ error: "Semua API mati", message: err.toString() }); }
});

app.get("/season", async (req: Request, res: Response) => {
  try { const r = await tryAllSources('seasonList', req.query.page || 1); res.json({source: r.source,...r.data}) }
  catch(err:any){ res.status(500).json({ error: "Semua API mati", message: err.toString() }); }
});

app.get("/season/:season", async (req: Request, res: Response) => {
  try { const r = await tryAllSources('season', req.params.season, req.query.page || 1); res.json({source: r.source,...r.data}) }
  catch(err:any){ res.status(500).json({ error: "Semua API mati", message: err.toString() }); }
});

app.get("/anime/:slug", async (req: Request, res: Response) => {
  try { const r = await tryAllSources('anime', req.params.slug); res.json({source: r.source,...r.data}) }
  catch(err:any){ res.status(500).json({ error: "Semua API mati", message: err.toString() }); }
});

app.get("/anime/:id/:ep", async (req: Request, res: Response) => {
  try { const r = await tryAllSources('animeVideoSource', req.params.id, req.params.ep); res.json({source: r.source,...r.data}) }
  catch(err:any){ res.status(500).json({ error: "Semua API mati", message: err.toString() }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server jalan di ${PORT}`));
export default app;
