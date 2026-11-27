/**
 * Bentuk baku satu soal teka-teki, terlepas dari sumbernya.
 *
 * Tiga sumber data dipakai (lihat public/data/README.md):
 *  - "skakmat": teka-teki.json (Lichess puzzle DB, CC0) — { problems: [...] }
 *  - "video"  : teka-teki-video.json (metadata Chess.com + tautan video)
 *  - "harian" : teka-teki-harian/<tahun>.json — { soal: [{tanggal, fen, langkah}] }
 *
 * Semua sumber menyimpan langkah sebagai pasangan koordinat dipisah ";"
 * (mis. "c4-c8;b7-c8"), promosi ditandai huruf bidak di belakang petak tujuan
 * ("f2-f1q"). Modul ini mengubahnya menjadi langkah chess.js sekali di awal
 * supaya lapisan UI tidak perlu tahu format berkas mana pun.
 *
 * Logika murni: tidak menyentuh DOM, storage, atau jaringan.
 */

/** Pola satu pasangan koordinat, dengan promosi opsional. */
const POLA_LANGKAH = /^([a-h][1-8])-([a-h][1-8])([qrbn])?$/;

/**
 * Ubah teks langkah menjadi daftar langkah chess.js.
 * Mendukung dua bentuk: "c4-c8;b7-c8" (berkas teka-teki) dan UCI ber-spasi
 * "e2e4 e7e5" (bentuk buku/PGN). Pasangan yang rusak dilewati seluruhnya agar
 * satu entri korup tidak menggeser urutan langkah solusi.
 *
 * @param {string} teks
 * @returns {Array<{from: string, to: string, promotion?: string}>}
 */
export function parseLangkah(teks) {
  const mentah = String(teks ?? "").trim();
  if (!mentah) return [];
  const bagian = mentah.includes(";") ? mentah.split(";") : mentah.split(/\s+/);
  const hasil = [];
  for (const item of bagian) {
    const bersih = item.trim().toLowerCase();
    if (!bersih) continue;
    const cocok = POLA_LANGKAH.exec(bersih);
    if (cocok) {
      const langkah = { from: cocok[1], to: cocok[2] };
      if (cocok[3]) langkah.promotion = cocok[3];
      hasil.push(langkah);
      continue;
    }
    // Cadangan: UCI rapat ("e2e4", "e7e8q") — dipakai bila sumber berubah.
    const uci = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/.exec(bersih);
    if (!uci) continue;
    const langkah = { from: uci[1], to: uci[2] };
    if (uci[3]) langkah.promotion = uci[3];
    hasil.push(langkah);
  }
  return hasil;
}

/** Notasi UCI satu langkah — kunci pembanding dengan langkah pemain. */
export function uciLangkah(langkah) {
  if (!langkah) return "";
  return `${langkah.from}${langkah.to}${langkah.promotion ?? ""}`;
}

/** Giliran pada FEN ("w"/"b"); "" bila FEN tidak berbentuk. */
export function giliranDariFen(fen) {
  const bidang = String(fen ?? "").trim().split(/\s+/);
  return bidang[1] === "w" || bidang[1] === "b" ? bidang[1] : "";
}

/**
 * Pihak yang harus dimainkan pengguna = giliran pada FEN soal.
 *
 * Ketiga sumber data memakai konvensi "pemain jalan lebih dulu": FEN adalah
 * posisi tempat PEMAIN bergerak dan `langkah[0]` adalah langkah pertama pemain
 * (lihat public/data/README.md). Ini BUKAN konvensi Lichess API yang menaruh
 * langkah lawan di depan. Buktinya pada data yang dikirim:
 *  - field `first` selalu sama dengan giliran FEN (5.486/5.486 soal skakmat);
 *  - "Mate in One" punya tepat SATU langkah, dan langkah itu skakmat oleh
 *    pihak FEN (1.377/1.377) — mustahil bila langkah[0] milik lawan;
 *  - seluruh jalur solusi berakhir skakmat oleh pihak FEN.
 * Papan diorientasikan ke pihak ini.
 */
export function pihakPemain(fen) {
  return giliranDariFen(fen);
}

/** Daftar tema dari teks tag ber-spasi ("backRankMate endgame mateIn3"). */
export function parseTema(teks) {
  return [...new Set(String(teks ?? "").split(/\s+/).filter(Boolean))];
}

/**
 * Bentuk baku soal. `jenis` menentukan asal data; field yang tidak dimiliki
 * sumber tetap ada bernilai null/[] agar UI tidak perlu banyak cabang.
 *
 * @param {object} mentah
 * @param {"skakmat"|"video"|"harian"} jenis
 * @returns {object|null} null bila soal tidak punya FEN atau langkah sah
 */
export function normalisasiSoal(mentah, jenis = "skakmat") {
  if (!mentah || typeof mentah !== "object") return null;
  const fen = String(mentah.fen ?? "").trim();
  const langkah = parseLangkah(mentah.moves ?? mentah.langkah ?? "");
  if (!fen || !langkah.length) return null;
  const rating = Number(mentah.rating);
  const tanggal = mentah.tanggal ? String(mentah.tanggal) : null;
  const id = jenis === "harian"
    ? `harian-${tanggal ?? ""}`
    : `${jenis}-${mentah.problemid ?? mentah.sumberId ?? ""}`;
  return {
    id,
    jenis,
    fen,
    langkah,
    // Langkah[0] adalah langkah PEMAIN; balasan lawan di indeks ganjil.
    // Pemain mulai dari indeks 0 pada FEN soal apa adanya.
    giliranFen: giliranDariFen(fen),
    pihak: pihakPemain(fen),
    rating: Number.isFinite(rating) ? rating : null,
    tema: parseTema(mentah.tema),
    tipe: mentah.type ? String(mentah.type) : null,
    judul: mentah.judulSoal ? String(mentah.judulSoal) : null,
    video: mentah.video ? String(mentah.video) : null,
    pelatih: mentah.pelatih ? String(mentah.pelatih) : null,
    tanggal,
    pembukaan: mentah.pembukaan ? String(mentah.pembukaan) : null,
  };
}

/** Normalisasi satu berkas sumber menjadi daftar soal baku (entri rusak dibuang). */
export function normalisasiBerkas(data, jenis = "skakmat") {
  const daftar = Array.isArray(data) ? data : (data?.problems ?? data?.soal ?? []);
  const hasil = [];
  for (const mentah of daftar) {
    const soal = normalisasiSoal(mentah, jenis);
    if (soal) hasil.push(soal);
  }
  return hasil;
}
