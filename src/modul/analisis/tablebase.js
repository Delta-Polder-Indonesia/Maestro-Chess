/**
 * Tablebase online Lichess untuk endgame (adopsi En Croissant TablebaseInfo).
 * Modul murni tanpa React: fetch + normalisasi + urutan langkah + cache per-FEN.
 *
 * Semantik kategori Lichess: `category` posisi adalah hasil bagi PIHAK YANG
 * BERGILIR; `category` tiap langkah adalah hasil bagi lawan SETELAH langkah itu
 * dimainkan. Karena itu langkah berkategori "loss" (lawan kalah) adalah langkah
 * terbaik bagi pihak yang bergilir — diurutkan paling depan, "win" paling akhir
 * (persis pengurutan En Croissant).
 *
 * CSP: host https://tablebase.lichess.org harus ada di connect-src (vercel.json).
 */

export const URL_TABLEBASE = "https://tablebase.lichess.org/standard";

export const KATEGORI_TABLEBASE = [
  "win", "loss", "draw", "cursed-win", "blessed-loss", "maybe-win", "maybe-loss", "unknown",
];

// Kategori yang tetap seri karena aturan 50 langkah (bukan menang/kalah murni).
export const KATEGORI_50_LANGKAH = ["blessed-loss", "cursed-win", "maybe-win", "maybe-loss"];

/** Jumlah bidak pada papan dari FEN (field pertama). */
export function jumlahBidak(fen) {
  const papan = String(fen ?? "").split(" ")[0] ?? "";
  let n = 0;
  for (const c of papan) if (/[pnbrqkPNBRQK]/.test(c)) n += 1;
  return n;
}

/**
 * Hasil posisi bagi pihak yang bergilir → "putih" | "hitam" | "seri" |
 * "tidakDiketahui". `turn` = "white" | "black". cursed-win/blessed-loss secara
 * teknis menang/kalah tetapi seri di bawah aturan 50 langkah → "seri".
 */
export function hasilPihak(category, turn) {
  const putih = turn === "white";
  if (category === "win") return putih ? "putih" : "hitam";
  if (category === "loss") return putih ? "hitam" : "putih";
  if (category === "draw" || category === "blessed-loss" || category === "cursed-win") return "seri";
  return "tidakDiketahui";
}

/** Urutan langkah terbaik dulu: loss (lawan kalah) → lainnya → win (lawan menang). */
export function urutkanLangkah(moves) {
  return [...moves].sort((a, b) => {
    if (a.category === "win" && b.category !== "win") return 1;
    if (a.category !== "win" && b.category === "win") return -1;
    if (a.category === "loss" && b.category !== "loss") return -1;
    if (a.category !== "loss" && b.category === "loss") return 1;
    return 0;
  });
}

const cache = new Map();

/** Kosongkan cache (dipakai tes dan saat partai baru dimuat). */
export function bersihkanCacheTablebase() {
  cache.clear();
}

function normalisasi(data) {
  const kategori = (k) => (KATEGORI_TABLEBASE.includes(k) ? k : "unknown");
  const moves = Array.isArray(data?.moves) ? data.moves : [];
  return {
    category: kategori(data?.category),
    dtz: Number.isFinite(data?.dtz) ? data.dtz : null,
    dtm: Number.isFinite(data?.dtm) ? data.dtm : null,
    moves: urutkanLangkah(moves).map((m) => ({
      uci: String(m?.uci ?? ""),
      san: String(m?.san ?? ""),
      category: kategori(m?.category),
      dtz: Number.isFinite(m?.dtz) ? m.dtz : null,
      dtm: Number.isFinite(m?.dtm) ? m.dtm : null,
      zeroing: Boolean(m?.zeroing),
      checkmate: Boolean(m?.checkmate),
    })).filter((m) => m.uci),
  };
}

/**
 * Ambil info tablebase untuk FEN. Hasil di-cache per-FEN (promise dibagikan
 * sehingga pemanggilan bersamaan tidak.fetch ganda); kegagalan dibuang dari
 * cache agar bisa dicoba lagi. `fetchImpl` disuntik untuk tes.
 */
export function ambilTablebase(fen, { signal, fetchImpl = fetch } = {}) {
  const kunci = String(fen);
  if (cache.has(kunci)) return cache.get(kunci);
  const janji = (async () => {
    const res = await fetchImpl(`${URL_TABLEBASE}?fen=${encodeURIComponent(kunci)}`, {
      signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`Tablebase HTTP ${res.status}`);
    return normalisasi(await res.json());
  })();
  cache.set(kunci, janji);
  janji.catch(() => cache.delete(kunci));
  return janji;
}
