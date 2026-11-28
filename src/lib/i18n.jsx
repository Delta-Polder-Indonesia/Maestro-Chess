"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { analisa as indonesia } from "./terjemahan/id/analisa.js";
import { tekaTeki as tekaTekiId } from "./terjemahan/id/tekaTeki.js";

const Context = createContext(null);
const KUNCI_BAHASA = "maestro-chess-bahasa";

/** The standalone app only needs the analysis dictionaries from ChessClub. */
export function I18nProvider({ children }) {
  const [bahasa, setBahasa] = useState(() => {
    try {
      return localStorage.getItem(KUNCI_BAHASA) === "en" ? "en" : "id";
    } catch {
      return "id";
    }
  });
  const [inggris, setInggris] = useState(null);
  const [inggrisTekaTeki, setInggrisTekaTeki] = useState(null);

  useEffect(() => {
    if (bahasa !== "en" || inggris) return undefined;
    let aktif = true;
    import("./terjemahan/en/analisa.js")
      .then((modul) => { if (aktif) setInggris(modul.analisa); })
      .catch(() => {});
    import("./terjemahan/en/tekaTeki.js")
      .then((modul) => { if (aktif) setInggrisTekaTeki(modul.tekaTeki); })
      .catch(() => {});
    return () => { aktif = false; };
  }, [bahasa, inggris]);

  useEffect(() => {
    document.documentElement.lang = bahasa;
    try { localStorage.setItem(KUNCI_BAHASA, bahasa); } catch { /* optional */ }
  }, [bahasa]);

  const t = useCallback((kunci, ganti = {}) => {
    const kamus = {
      analisa: bahasa === "en" && inggris ? inggris : indonesia,
      tekaTeki: bahasa === "en" && inggrisTekaTeki ? inggrisTekaTeki : tekaTekiId,
    };
    let teks = kunci.split(".").reduce((nilai, bagian) => nilai?.[bagian], kamus) ?? kunci;
    if (typeof teks !== "string") return teks;
    for (const [nama, nilai] of Object.entries(ganti)) teks = teks.replaceAll(`{${nama}}`, String(nilai));
    return teks;
  }, [bahasa, inggris, inggrisTekaTeki]);

  const nilai = useMemo(() => ({ bahasa, setBahasa, t }), [bahasa, t]);
  return <Context.Provider value={nilai}>{children}</Context.Provider>;
}

export function useI18n() {
  const konteks = useContext(Context);
  if (!konteks) throw new Error("I18nProvider is missing");
  return konteks;
}
