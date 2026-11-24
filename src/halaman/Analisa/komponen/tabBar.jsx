import { Plus, X } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { useI18n } from "../../../lib/i18n.jsx";
import { KUNCI_FITUR, usePekerjaan } from "../../../modul/pekerjaan/index.js";

function tampilkanTabAktif(daftar) {
  const tombol = daftar?.querySelector('[aria-selected="true"]');
  // Gulir seluruh tab, termasuk tombol tutup, bukan hanya teks pilihnya.
  tombol?.closest('[data-uji="tab-kerja-item"]')?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  return tombol;
}

/**
 * Bilah sederhana di atas area kerja; setiap tab mengarah ke satu fitur.
 *
 * `tampilanAktif` memakai layar yang sedang benar-benar tampil, bukan catatan
 * `tampilan` di tab. Catatan itu ditulis oleh efek setelah render, sehingga
 * saat pengguna kembali dari Engine ke Papan label tab sempat terbaca
 * "Engine" lebih dulu sebelum berubah menjadi "New Tab".
 */
export default function TabBar({ daftar, aktifId, sibuk, tampilanAktif, laporanAktifId, onPilih, onTutup, onTambah }) {
  const { t } = useI18n();
  const { daftar: pekerjaan } = usePekerjaan();
  const idDaftar = useId();
  const gulirRef = useRef(null);
  const fokusSetelahTutupRef = useRef(false);

  useEffect(() => {
    const aktif = tampilkanTabAktif(gulirRef.current);
    if (fokusSetelahTutupRef.current) aktif?.focus();
    fokusSetelahTutupRef.current = false;
  }, [aktifId]);

  useEffect(() => {
    const daftar = gulirRef.current;
    if (!daftar) return undefined;
    // Ukuran juga berubah saat perangkat diputar atau bilah samping diciutkan.
    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(() => tampilkanTabAktif(daftar));
      observer.observe(daftar);
      return () => observer.disconnect();
    }
    const ukur = () => tampilkanTabAktif(daftar);
    window.addEventListener("resize", ukur);
    return () => window.removeEventListener("resize", ukur);
  }, []);

  function fiturTab(tab) {
    // Saat memulihkan sesi `tampilanAktif` sengaja kosong: ikuti tujuan tab
    // yang tersimpan supaya bilah tidak berkedip sebelum pemulihan selesai.
    if (tab.id === aktifId && tampilanAktif) return tampilanAktif;
    return tab.tampilan;
  }

  function namaTab(tab) {
    const fitur = fiturTab(tab);
    if (fitur === "papan") return t("analisa.tabKerja.baru");
    if (fitur === "bermain") {
      const id = tab.id === aktifId && laporanAktifId ? laporanAktifId : tab.laporanId;
      const laporan = pekerjaan.find((item) => item.jenis === "laporan" && item.id === id);
      if (laporan?.judul) return laporan.judul;
    }
    return t(KUNCI_FITUR[fitur]);
  }

  function tekanPanah(e) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    const tombol = [...e.currentTarget.querySelectorAll('[role="tab"]')];
    const sekarang = tombol.indexOf(document.activeElement);
    if (sekarang < 0 || !tombol.length) return;
    e.preventDefault();
    const berikut = e.key === "Home" ? 0 : e.key === "End" ? tombol.length - 1
      : (sekarang + (e.key === "ArrowRight" ? 1 : -1) + tombol.length) % tombol.length;
    tombol[berikut]?.focus();
  }

  return (
    <div data-uji="tab-kerja-bar" className="flex h-9 w-full min-w-0 shrink-0 border-b border-border bg-backgroundBoxDarker">
      {/* Tablist hanya memiliki tab; tombol tutup tetap terpisah bagi pembaca layar. */}
      <div
        role="tablist"
        aria-label={t("analisa.tabKerja.daftar")}
        aria-owns={daftar.length ? daftar.map((_, indeks) => `${idDaftar}-${indeks}`).join(" ") : undefined}
        className="h-0 w-0 shrink-0"
      />
      <div
        ref={gulirRef}
        onKeyDown={tekanPanah}
        className="flex min-w-0 max-w-full overflow-x-auto overflow-y-hidden"
      >
        {daftar.map((tab, indeks) => {
          const aktif = tab.id === aktifId;
          const nama = namaTab(tab);
          return (
            <div
              key={tab.id}
              data-uji="tab-kerja-item"
              data-tab-id={tab.id}
              data-tab-fitur={fiturTab(tab)}
              className={`flex h-9 max-w-[220px] min-w-[118px] shrink-0 items-center border-r border-border ${aktif ? "border-t-2 border-t-backgroundBoxBoxHighlighted bg-backgroundBoxBox" : "border-t-2 border-t-transparent hover:bg-backgroundBoxBoxHover"}`}
            >
              <span id={`${idDaftar}-${indeks}`} role="presentation" className="flex min-w-0 flex-1">
                <button
                  id={`tab-kerja-${tab.id}`}
                  type="button"
                  role="tab"
                  aria-controls="konten-tab-kerja"
                  aria-selected={aktif}
                  tabIndex={aktif ? 0 : -1}
                  data-uji="tab-kerja-pilih"
                  disabled={sibuk}
                  onClick={() => { fokusSetelahTutupRef.current = false; onPilih(tab.id); }}
                  title={nama}
                  className={`min-w-0 flex-1 cursor-pointer truncate px-3 text-left text-[13px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-backgroundBoxBoxHighlighted ${aktif ? "text-foreground" : "text-foregroundGrey"}`}
                >
                  {nama}
                </button>
              </span>
              <button
                type="button"
                data-uji="tab-kerja-tutup"
                disabled={sibuk}
                aria-label={t("analisa.tabKerja.tutup", { nama })}
                title={t("analisa.tabKerja.tutup", { nama })}
                onClick={() => { fokusSetelahTutupRef.current = aktif; onTutup(tab.id); }}
                className="mr-1 flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded text-foregroundGrey hover:bg-backgroundBoxBoxHover hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-backgroundBoxBoxHighlighted"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
      <button
        type="button"
        data-uji="tab-kerja-tambah"
        disabled={sibuk}
        onClick={() => { fokusSetelahTutupRef.current = false; onTambah(); }}
        aria-label={t("analisa.tabKerja.tambah")}
        title={t("analisa.tabKerja.tambah")}
        className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center border-r border-border text-foregroundGrey hover:bg-backgroundBoxBoxHover hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-backgroundBoxBoxHighlighted"
      >
        <Plus size={18} aria-hidden="true" />
      </button>
    </div>
  );
}
