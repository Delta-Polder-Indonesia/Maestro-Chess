/** Pesan ketika partai yang diterima belum seluruhnya tersimpan permanen. */
export function pesanPenyimpananPartai(t, jumlah, hasil) {
  const n = Math.max(0, Number(jumlah) || 0);
  const tersimpan = Math.max(0, Number(hasil?.tersimpan) || 0);
  const sementara = Math.max(0, Number(hasil?.sementara) || 0);
  const angka = { n, tersimpan, sementara };
  if (hasil?.media === "memori") return t("analisa.basisData.simpanSementara", angka);
  if (!hasil || hasil.media === "gagal" || (n > 0 && tersimpan === 0)) return t("analisa.basisData.simpanGagal", angka);
  if (tersimpan < n) return t("analisa.basisData.simpanSebagian", angka);
  return "";
}
