import { useContext, useEffect, useRef, useState } from "react";
import { PanelAktifContext } from "../../konteks/panelAktif.js";

/** Menu sementara ditutup dan listener global dilepas ketika tab tersembunyi. */
export function useDropdown() {
  const aktif = useContext(PanelAktifContext);
  const [terbuka, setTerbuka] = useState(false);
  const wadahRef = useRef(null);

  useEffect(() => {
    if (!aktif) setTerbuka(false);
  }, [aktif]);

  useEffect(() => {
    if (!aktif || !terbuka) return undefined;
    function klikLuar(e) {
      if (!wadahRef.current?.contains(e.target)) setTerbuka(false);
    }
    function tekanEsc(e) {
      if (e.key !== "Escape" || wadahRef.current?.closest?.("[hidden]") ||
        document.querySelector('[role="alertdialog"][data-state="open"]')) return;
      // Tangkap sebelum pintasan Escape area kerja agar hanya menu yang
      // tertutup, bukan sekaligus berpindah ke papan.
      e.preventDefault();
      setTerbuka(false);
    }
    document.addEventListener("mousedown", klikLuar);
    document.addEventListener("keydown", tekanEsc, true);
    return () => {
      document.removeEventListener("mousedown", klikLuar);
      document.removeEventListener("keydown", tekanEsc, true);
    };
  }, [aktif, terbuka]);

  return { terbuka, setTerbuka, wadahRef };
}
