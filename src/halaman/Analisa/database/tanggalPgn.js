/** Parse a complete PGN calendar date, without inventing unknown components. */
export function tanggalDariHeaderPgn(headers = {}) {
  for (const nilai of [headers.UTCDate, headers.Date]) {
    const cocok = /^(\d{4})\.(\d{2})\.(\d{2})$/.exec(String(nilai || ""));
    if (!cocok) continue;
    const tahun = Number(cocok[1]);
    const bulan = Number(cocok[2]);
    const hari = Number(cocok[3]);
    if (tahun < 1 || bulan < 1 || bulan > 12 || hari < 1 || hari > 31) continue;
    // setUTCFullYear avoids Date.UTC treating years 0–99 as 1900–1999.
    const tanggal = new Date(0);
    tanggal.setUTCFullYear(tahun, bulan - 1, hari);
    tanggal.setUTCHours(12, 0, 0, 0);
    if (tanggal.getUTCFullYear() !== tahun || tanggal.getUTCMonth() !== bulan - 1 || tanggal.getUTCDate() !== hari) continue;
    return { timestamp: tanggal.getTime(), tanggalPgn: `${cocok[1]}-${cocok[2]}-${cocok[3]}` };
  }
  return { timestamp: 0, tanggalPgn: "" };
}

/** Repair legacy imported records whose timestamp was the import time. */
export function perbaikiTanggalImpor(partai) {
  if (partai?.platform !== "impor" || typeof partai.pgn !== "string" || !partai.pgn.trim() ||
      Object.hasOwn(partai, "tanggalPgn")) return partai;
  const headers = {};
  const pola = /^\s*\[(UTCDate|Date)\s+"([^"]*)"\s*\]/gm;
  for (const cocok of partai.pgn.matchAll(pola)) {
    if (headers[cocok[1]] === undefined) headers[cocok[1]] = cocok[2];
  }
  return { ...partai, ...tanggalDariHeaderPgn(headers) };
}
