import { useContext, useEffect, useId, useRef, useState } from "react";
import { PanelAktifContext } from "../../konteks/panelAktif.js";

/** Move focus among the options of a custom listbox. */
export function tekanPanahOpsi(e) {
  if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
  const opsi = [...e.currentTarget.querySelectorAll('[role="option"]')];
  if (!opsi.length) return;
  const sekarang = opsi.indexOf(document.activeElement);
  const berikut = e.key === "Home" ? 0 : e.key === "End" ? opsi.length - 1
    : sekarang < 0 ? 0 : (sekarang + (e.key === "ArrowDown" ? 1 : -1) + opsi.length) % opsi.length;
  e.preventDefault();
  opsi[berikut]?.focus();
}

/** Menu sementara ditutup dan listener global dilepas ketika tab tersembunyi. */
export function useDropdown() {
  const aktif = useContext(PanelAktifContext);
  const [terbuka, setTerbuka] = useState(false);
  const wadahRef = useRef(null);
  const pemicuRef = useRef(null);
  const fokusSaatBuka = useRef(false);
  const idDaftar = useId();
  const fokusOpsi = () => {
    const wadah = wadahRef.current;
    (wadah?.querySelector('[role="option"][aria-selected="true"]') ?? wadah?.querySelector('[role="option"]'))?.focus();
  };
  const tekanPemicu = (e) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    if (terbuka) fokusOpsi();
    else { fokusSaatBuka.current = true; setTerbuka(true); }
  };
  const toggle = (e) => {
    // Keyboard activation produces a click with detail 0. Move focus into
    // the listbox; mouse users can continue using the pointer normally.
    if (!terbuka && e.detail === 0) fokusSaatBuka.current = true;
    setTerbuka((lama) => !lama);
  };
  const keluarFokus = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setTerbuka(false);
  };
  const tutupDanFokus = () => { setTerbuka(false); pemicuRef.current?.focus(); };

  useEffect(() => {
    if (terbuka && fokusSaatBuka.current) {
      fokusSaatBuka.current = false;
      fokusOpsi();
    }
  }, [terbuka]);

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
      // If focus was inside the disappearing list, return it to its trigger.
      if (wadahRef.current?.contains(document.activeElement)) {
        wadahRef.current.querySelector('[aria-haspopup="listbox"]')?.focus();
      }
    }
    document.addEventListener("mousedown", klikLuar);
    document.addEventListener("keydown", tekanEsc, true);
    return () => {
      document.removeEventListener("mousedown", klikLuar);
      document.removeEventListener("keydown", tekanEsc, true);
    };
  }, [aktif, terbuka]);

  return { terbuka, setTerbuka, wadahRef, pemicuRef, idDaftar, tekanPemicu, toggle, keluarFokus, tutupDanFokus };
}
