import { useEffect, useLayoutEffect, useRef } from "react";
import { useTampilan } from "../../../../modul/sesi/papan.js";
import { buatHandleKeyDown } from "./keyboardPapan.js";

/**
 * Hanya listener kecil ini berlangganan navigasi. Papan dan analisis tetap
 * mounted dan tidak perlu render untuk memperbarui penjaga pintasan.
 */
export default function PendengarKeyboard({ pageStateRef, dragRef, analyzingMoveRef, gameController }) {
  const [tampilan] = useTampilan();
  const tampilanRef = useRef(tampilan);
  useLayoutEffect(() => {
    tampilanRef.current = tampilan;
  }, [tampilan]);
  useEffect(() => {
    const handleKeyDown = buatHandleKeyDown({
      tampilanRef, pageStateRef, dragRef, analyzingMoveRef, gameController,
    });
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [pageStateRef, dragRef, analyzingMoveRef, gameController]);
  return null;
}
