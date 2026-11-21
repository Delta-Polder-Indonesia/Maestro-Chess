"use client";

/* Standalone analysis workspace adapted from ChessClub (MIT) and Brilliant-Chess (MIT). */
import { useLayoutEffect, useState } from "react";
import { I18nProvider } from "../../lib/i18n.jsx";
import ConfigContextProvider from "./konteks/config.jsx";
import ErrorsContextProvider from "./konteks/errors.jsx";
import AnalyzeContextProvider from "./konteks/analyze.jsx";
import { MesinProvider } from "./konteks/mesin.jsx";
import PageErrors from "./komponen/errors/pageErrors.jsx";
import AreaKerja from "./komponen/areaKerja.jsx";
import Nav from "./komponen/nav/nav.jsx";
import "./analisa.css";

export default function Analisa() {
  const [tinggi, setTinggi] = useState(() => Math.round(window.innerHeight));

  useLayoutEffect(() => {
    let aktif = true;
    function ukur() {
      if (aktif) setTinggi(Math.round(window.innerHeight));
    }
    ukur();
    window.addEventListener("resize", ukur);
    window.addEventListener("orientationchange", ukur);
    document.fonts?.ready.then(ukur).catch(() => {});
    return () => {
      aktif = false;
      window.removeEventListener("resize", ukur);
      window.removeEventListener("orientationchange", ukur);
    };
  }, []);

  return (
    <I18nProvider>
      <ConfigContextProvider>
        <ErrorsContextProvider>
          <MesinProvider>
            <div
              style={{ height: tinggi }}
              className="analisa-root relative flex w-full select-none flex-col overflow-hidden navTop:flex-row"
            >
              <AnalyzeContextProvider>
                <PageErrors />
                <Nav />
                <AreaKerja />
              </AnalyzeContextProvider>
            </div>
          </MesinProvider>
        </ErrorsContextProvider>
      </ConfigContextProvider>
    </I18nProvider>
  );
}
