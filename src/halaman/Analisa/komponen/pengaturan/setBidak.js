/**
 * Registri set bidak — diadaptasi dari ChessClub (`src/components/chess/pemuatBidak.js`).
 *
 * Aset disalin ke `public/bidak/<set>/` dan disajikan statis oleh Next.js, jadi
 * tidak perlu `import.meta.glob` (makro Vite) seperti di ChessClub. Fungsi di
 * sini MURNI (tanpa React/DOM) agar bisa dipakai baik oleh pemilih pengaturan
 * maupun oleh perender bidak papan, dan auto-resolve di pemuat uji.
 *
 * Lisensi tiap set berbeda (lihat `public/bidak/CREDITS.md`); beberapa set
 * lichess berlisensi CC BY-NC-SA. Aset dipakai apa adanya dari repo pemilik.
 */

/** Set bawaan Maestro: tetap CBurnett agar tampilan awal tidak berubah. */
export const SET_BAWAAN = "cburnett";

/** id = nama folder aset; nama = label tampilan; png = set berbasis PNG. */
export const DAFTAR_SET_BIDAK = [
  { id: "cburnett", nama: "CBurnett" },
  { id: "bidak", nama: "Chessnut" },
  { id: "alpha", nama: "Alpha" },
  { id: "california", nama: "California" },
  { id: "cardinal", nama: "Cardinal" },
  { id: "dubrovny", nama: "Dubrovny" },
  { id: "gioco", nama: "Gioco" },
  { id: "governor", nama: "Governor" },
  { id: "icpieces", nama: "ICPieces" },
  { id: "maestro", nama: "Maestro" },
  { id: "merida", nama: "Merida" },
  { id: "staunty", nama: "Staunty" },
  { id: "tatiana", nama: "Tatiana" },
  { id: "chesscom", nama: "Chess.com" },
  { id: "3d_chesskid", nama: "3D ChessKid", png: true },
  { id: "3d_plastic", nama: "3D Plastic", png: true },
  { id: "3d_staunton", nama: "3D Staunton", png: true },
  { id: "3d_wood", nama: "3D Wood", png: true },
  { id: "8_bit", nama: "8-Bit", png: true },
  { id: "8qetl", nama: "8qetl", png: true },
  { id: "bases", nama: "Bases", png: true },
  { id: "book", nama: "Book", png: true },
  { id: "bubblegum", nama: "Bubblegum", png: true },
  { id: "ca09k", nama: "ca09k", png: true },
  { id: "cases", nama: "Cases", png: true },
  { id: "classic", nama: "Classic", png: true },
  { id: "club", nama: "Club", png: true },
  { id: "condal", nama: "Condal", png: true },
  { id: "dash", nama: "Dash", png: true },
  { id: "ejgfv", nama: "ejgfv", png: true },
  { id: "game_room", nama: "Game Room", png: true },
  { id: "glass", nama: "Glass", png: true },
  { id: "gothic", nama: "Gothic", png: true },
  { id: "graffiti", nama: "Graffiti", png: true },
  { id: "icy_sea", nama: "Icy Sea", png: true },
  { id: "light", nama: "Light", png: true },
  { id: "lolz", nama: "Lolz", png: true },
  { id: "luca", nama: "Luca", png: true },
  { id: "marble", nama: "Marble", png: true },
  { id: "maya", nama: "Maya", png: true },
  { id: "metal", nama: "Metal", png: true },
  { id: "modern", nama: "Modern", png: true },
  { id: "nature", nama: "Nature", png: true },
  { id: "neo_wood", nama: "Neo Wood", png: true },
  { id: "neon", nama: "Neon", png: true },
  { id: "newspaper", nama: "Newspaper", png: true },
  { id: "ocean", nama: "Ocean", png: true },
  { id: "sky", nama: "Sky", png: true },
  { id: "space", nama: "Space", png: true },
  { id: "tigers", nama: "Tigers", png: true },
  { id: "tournament", nama: "Tournament", png: true },
  { id: "vintage", nama: "Vintage", png: true },
  { id: "wood", nama: "Wood", png: true },
];

const KODE_ASET = { K: "wK", Q: "wQ", R: "wR", B: "wB", N: "wN", P: "wP", k: "bK", q: "bQ", r: "bR", b: "bB", n: "bN", p: "bP" };
const KODE_CHESSNUT = {
  K: "raja-putih", Q: "ratu-putih", R: "benteng-putih", B: "gajah-putih", N: "kuda-putih", P: "bidak-putih",
  k: "raja-hitam", q: "ratu-hitam", r: "benteng-hitam", b: "gajah-hitam", n: "kuda-hitam", p: "bidak-hitam",
};

/** Set sah; apa pun di luar daftar jatuh ke set bawaan. */
export function idSetBidak(set) {
  return DAFTAR_SET_BIDAK.some((item) => item.id === set) ? set : SET_BAWAAN;
}

function basisPublik() {
  return (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/\/+$/, "");
}

/**
 * URL publik untuk satu bidak. `piece` adalah karakter FEN (K/Q/R/B/N/P
 * kapital = putih, huruf kecil = hitam). Mengembalikan path relatif root
 * publik (sudah termasuk base path ekspor statis), siap dipakai di `src` img.
 */
export function urlBidak(set, piece) {
  const id = idSetBidak(set);
  let jalur;
  if (id === "bidak") {
    const kode = KODE_CHESSNUT[piece];
    jalur = kode ? `bidak/bidak/${kode}.svg` : null;
  } else {
    const kode = KODE_ASET[piece];
    if (!kode) return null;
    if (id === "chesscom") {
      jalur = `bidak/ChessCom/${kode.toLowerCase()}.png`;
    } else {
      const entri = DAFTAR_SET_BIDAK.find((s) => s.id === id);
      jalur = entri?.png ? `bidak/${id}/${kode.toLowerCase()}.png` : `bidak/${id}/${kode}.svg`;
    }
  }
  return jalur ? `${basisPublik()}/${jalur}` : null;
}

/** Urutan bidak untuk pratinjau baris pemilih (putih: raja→pion). */
export const BIDAK_PRATINJAU = ["K", "Q", "R", "B", "N", "P"];
