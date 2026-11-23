import { useLayoutEffect, useState } from "react";
import { maxSisiPapan, maxVertical, minSisiPapan, navTop } from "../konstanta.js";

// Cadangan untuk margin, evaluasi, jarak, menu papan, panel, dan baris pemain.
// Rumus ini mengikuti pengukuran papan di game.jsx untuk kedua susunan.
const LEBAR_KOLOM = 8 + 28 + 6 + 8 + 17 + 8;
const TINGGI_KOLOM = 28 * 2 + 6 * 3 + 8 * 2 + 69;
const LEBAR_SEJAJAR = 16 + 36 + 10 + 8 + 17 + 8 + 480 + 16;
const TINGGI_SEJAJAR = 16 * 2 + 44 * 2 + 10 * 2;

/*
 * Panel diletakkan di samping hanya jika ruang kerja (setelah bilah dikurangi)
 * cukup lebar tanpa membuat papan lebih kecil daripada dalam susunan kolom.
 * Dengan begitu menutup bilah tidak justru mengecilkan papan.
 */
export function cukupRuangSejajar(lebar, tinggi) {
  // Pada layar sangat pendek, susunan kolom bisa di-scroll tanpa memaksa
  // papan menjadi lebih kecil dari ukuran minimum yang masih bisa dipakai.
  if (lebar < maxVertical || tinggi < minSisiPapan + TINGGI_SEJAJAR) return false;
  const papanKolom = Math.max(0, Math.min(maxSisiPapan, lebar - LEBAR_KOLOM, Math.max(minSisiPapan, tinggi - TINGGI_KOLOM)));
  const papanSejajar = Math.max(0, Math.min(maxSisiPapan, lebar - LEBAR_SEJAJAR, Math.max(minSisiPapan, tinggi - TINGGI_SEJAJAR)));
  return papanSejajar >= papanKolom;
}

/** Ukur <main>, bukan viewport; ukuran dan mode dipakai bersama oleh CSS dan papan. */
export function useUkuranArea(wadahRef, isiRef) {
  const [ukuran, setUkuran] = useState(null);

  useLayoutEffect(() => {
    // Ref induk dipasang sesudah layout effect anak pada mount pertama.
    const wadah = wadahRef.current ?? isiRef.current?.closest?.("[data-wadah-papan]") ?? isiRef.current?.closest?.("main");
    if (!wadah || typeof window === "undefined") return undefined;

    function ukur() {
      const lebar = wadah.clientWidth;
      const tinggi = wadah.clientHeight;
      const navDiAtas = window.innerWidth < navTop;
      const sejajar = !navDiAtas && cukupRuangSejajar(lebar, tinggi);
      setUkuran((lama) => lama && lama.lebar === lebar && lama.tinggi === tinggi &&
        lama.navDiAtas === navDiAtas && lama.sejajar === sejajar
        ? lama : { lebar, tinggi, navDiAtas, sejajar });
    }

    ukur();
    window.addEventListener("resize", ukur);
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(ukur) : null;
    if (observer) observer.observe(wadah);

    // Tanpa ResizeObserver, perubahan kelas bilah dan tinggi root tetap
    // harus diukur: tinggi root diperbarui React setelah event resize jendela.
    const root = !observer ? wadah.closest?.(".analisa-root") : null;
    const bilah = root?.querySelector("nav");
    const cadangan = root && typeof MutationObserver === "function" ? new MutationObserver(ukur) : null;
    if (cadangan) {
      if (bilah) cadangan.observe(bilah, { attributes: true, attributeFilter: ["class"] });
      cadangan.observe(root, { attributes: true, attributeFilter: ["style"] });
    }

    return () => {
      window.removeEventListener("resize", ukur);
      observer?.disconnect();
      cadangan?.disconnect();
    };
  }, [wadahRef, isiRef]);

  return ukuran;
}
