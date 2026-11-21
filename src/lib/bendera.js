import { berkasPublik } from "./asets.js";

/** Resolve a validated country code to a local, MIT-licensed flag icon. */
export function urlBendera(kode) {
  const nilai = String(kode || "").trim().toLowerCase();
  if (!/^[a-z]{2}(?:-[a-z]{3})?$/.test(nilai)) return null;
  return berkasPublik(`flags/${nilai}.svg`);
}
