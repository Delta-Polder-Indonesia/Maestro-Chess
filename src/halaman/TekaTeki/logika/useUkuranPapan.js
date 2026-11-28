/**
 * Ukuran papan teka-teki: ikuti lebar/tinggi wadah (bukan viewport) supaya
 * papan tetap persegi dan tidak melimpah di layar sempit. ResizeObserver
 * dipakai bila tersedia; tanpa DOM (uji/SSR) nilai bawaan dipakai.
 */
import { useLayoutEffect, useState } from "react";

const MINIMUM = 240;
const MAKSIMUM = 560;

export default function useUkuranPapan(wadahRef) {
  const [ukuran, setUkuran] = useState(360);
  useLayoutEffect(() => {
    const el = wadahRef.current;
    if (!el || typeof el.getBoundingClientRect !== "function") return undefined;
    const ukur = () => {
      const kotak = el.getBoundingClientRect();
      const sisi = Math.floor(Math.min(kotak.width || MAKSIMUM, kotak.height || MAKSIMUM));
      setUkuran(Math.max(MINIMUM, Math.min(MAKSIMUM, sisi)));
    };
    ukur();
    if (typeof ResizeObserver === "undefined") return undefined;
    const pengamat = new ResizeObserver(ukur);
    pengamat.observe(el);
    return () => pengamat.disconnect();
  }, [wadahRef]);
  return ukuran;
}
