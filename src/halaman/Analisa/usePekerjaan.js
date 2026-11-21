import { useEffect, useSyncExternalStore } from "react";
import { pekerjaan } from "./pekerjaan.js";

const SERVER = Object.freeze({
  siap: false, tersedia: true, menyimpan: false, daftar: [], terakhirId: null, terakhirDrafId: null,
  aktif: { id: null, digunakan: false, berjalan: false },
});

export function usePekerjaan() {
  const nilai = useSyncExternalStore(pekerjaan.langganan, pekerjaan.snapshot, () => SERVER);
  useEffect(() => { pekerjaan.init(); }, []);
  return nilai;
}
