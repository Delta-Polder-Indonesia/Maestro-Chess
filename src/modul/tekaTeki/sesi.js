/**
 * Statistik satu sesi teka-teki: akurasi, rantai benar (streak), dan rata-rata
 * waktu penyelesaian. Diadopsi sebagai perilaku dari panel puzzle En Croissant
 * (GPL-3.0): streak dihitung dari ekor riwayat dan berhenti pada kegagalan
 * pertama, entri yang belum dikerjakan dilewati, rata-rata waktu hanya dari
 * soal yang dijawab benar.
 *
 * Logika murni tanpa DOM; waktu dalam milidetik.
 */

export const STATUS_SOAL = Object.freeze({ BELUM: "belum", BENAR: "benar", SALAH: "salah" });

/** Entri riwayat baru untuk sebuah soal. */
export function buatEntri(soal) {
  return {
    id: soal?.id ?? "",
    rating: soal?.rating ?? null,
    jenis: soal?.jenis ?? "skakmat",
    status: STATUS_SOAL.BELUM,
    waktu: 0,
    tema: [],
  };
}

/**
 * @param {Array<{status: string, waktu?: number}>} riwayat
 * @returns {{benar:number, salah:number, selesai:number, akurasi:number|null, streak:number, rataWaktu:number|null}}
 */
export function hitungStatistik(riwayat) {
  const daftar = riwayat ?? [];
  let benar = 0;
  let salah = 0;
  let totalWaktu = 0;
  let berwaktu = 0;
  for (const entri of daftar) {
    if (entri?.status === STATUS_SOAL.BENAR) {
      benar++;
      const waktu = Number(entri.waktu);
      if (Number.isFinite(waktu) && waktu > 0) { totalWaktu += waktu; berwaktu++; }
    } else if (entri?.status === STATUS_SOAL.SALAH) {
      salah++;
    }
  }
  const selesai = benar + salah;
  let streak = 0;
  for (let i = daftar.length - 1; i >= 0; i--) {
    const status = daftar[i]?.status;
    if (status === STATUS_SOAL.BENAR) streak++;
    else if (status === STATUS_SOAL.SALAH) break;
  }
  return {
    benar,
    salah,
    selesai,
    akurasi: selesai > 0 ? Math.round((benar / selesai) * 100) : null,
    streak,
    rataWaktu: berwaktu > 0 ? totalWaktu / berwaktu : null,
  };
}

/** Format waktu mm:ss (dipakai kartu waktu dan riwayat). */
export function formatWaktu(ms) {
  const detik = Math.max(0, Math.floor(Number(ms ?? 0) / 1000));
  const menit = Math.floor(detik / 60);
  return `${String(menit).padStart(2, "0")}:${String(detik % 60).padStart(2, "0")}`;
}
