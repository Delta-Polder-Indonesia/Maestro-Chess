/*
 * Port dari Brilliant-Chess (MIT, © 2025 Delo) — src/components/nav/nav.tsx.
 *
 * Bilah navigasi kiri: logo + wordmark di atas, lalu menu area kerja
 * (Papan / Akun / Basis Data / Engine / Pengaturan). Tautan Kode Sumber dan
 * Atribusi kini berada di dalam Pengaturan → Dokumentasi, bukan lagi di dasar
 * bilah ini.
 *
 * PERUBAHAN BESAR dari upstream (dan dari versi port sebelumnya):
 * menu-menu itu dulu membuka popup modal yang menutupi papan. Sekarang
 * setiap menu memilih LAYAR yang mengisi area kerja — pola yang sama dengan
 * halaman Pengurus (`src/halaman/Pengurus/Dashboard.jsx`): `Sidebar`
 * menyetel `tab`, `<main>` merender panel sesuai `tab`. Di sini `tab`-nya
 * bernama `tampilan` dan hidup di konteks navigasi, bilah ini hanya
 * menyetelnya. Tidak ada lagi modal: tidak ada latar digelapkan, tidak ada
 * tombol tutup, tidak ada pembajakan tombol Escape (Escape tetap milik
 * pintasan pemutar partai di papan).
 *
 * Konsekuensi penting: papan catur TIDAK pernah dilepas saat layar berganti
 * (lihat `komponen/areaKerja.jsx`), jadi analisis yang sedang berjalan dan
 * panah yang sudah digambar pengguna tetap utuh.
 *
 * Dua penyesuaian lain dari upstream (lihat komentar di kelas):
 *  - `navTop:h-screen`  → `navTop:h-full`  (bilah tingginya area kerja,
 *    bukan layar; area kerja sudah diukur Analisa.jsx di bawah header situs)
 *  - `w-screen`         → `w-full`         (mode ponsel: selebar wadah,
 *    bukan selebar jendela, supaya tidak meluber keluar kontainer halaman)
 *
 * Logo/wordmark dipertahankan sama seperti aslinya. Tautan kode sumber dan
 * atribusi dipindah ke tab Dokumentasi pada layar Pengaturan supaya semua
 * informasi proyek berkumpul di satu tempat.
 *
 * TATA LETAK BURGER (bilah menciut) disamakan dengan blok sidebar contoh
 * (`src/components/ui/sidebar.jsx` + contoh prompt.md), tanpa memindahkan
 * bilah ini ke komponen itu:
 *  - lebar menciut 3rem (`w-12`), sama dengan `--sidebar-width-icon` di
 *    komponen sidebar;
 *  - saat menciut, tombol menu memakai lebar 2rem dengan bantalan 7px
 *    dan tanpa gap label, sehingga ikon 18px serta garis fokus tidak terpotong;
 *  - burger duduk di baris kepala bersama wordmark; saat bilah menciut,
 *    wordmark ikut disembunyikan dan burger tinggal di tengah lajur;
 *  - setiap ikon memiliki nama aksesibel dan tooltip saat label tidak terlihat.
 */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import Profile from "../svg/profile.jsx";
import { Settings } from "lucide-react";
import { TAMPILAN_ANALISA } from "../../konteks/analyzeKonteks.js";
import { useTampilan } from "../../konteks/boardKonteks.js";
import { useTabKerja } from "@/modul/sesi/index.js";
import { useI18n } from "../../../../lib/i18n.jsx";
import { TooltipLabel } from "../../../../components/ui/tooltip.jsx";
import { navTop } from "../../konstanta.js";
import { bacaBoolean, tulisBoolean } from "../../../../modul/sesi/preferensi.js";

/** Dipakai ulang oleh tab Dokumentasi di layar Pengaturan. */
export { URL_REPO } from "../../../../lib/repo.js";

/** Ikon "Papan" — papan catur 8x8 (monokrom, ikut warna kelas fill). */
function IkonPapan({ className }) {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} aria-hidden="true">
      <path
        className={className}
        fillRule="evenodd"
        d="M4 3h16a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm1 3v2h2V6H5zm4 0v2h2V6H9zm4 0v2h2V6h-2zm4 0v2h2V6h-2zM5 10v2h2v-2H5zm4 0v2h2v-2H9zm4 0v2h2v-2h-2zm4 0v2h2v-2h-2zM5 14v2h2v-2H5zm4 0v2h2v-2H9zm4 0v2h2v-2h-2zm4 0v2h2v-2h-2z"
      />
    </svg>
  );
}

/**
 * Ikon "Engine" — cip mesin dengan inti kotak (monokrom, ikut warna kelas fill).
 * Path-nya hanya memakai rentang 3–21 pada kanvas 24, jadi kanvas dipangkas
 * ke 2–22 supaya gambar tampak sebesar ikon Papan/Akun/Database/Pengaturan
 * tanpa mengubah ukuran luar 18px (rail menciut tetap muat).
 */
function IkonEngine({ className }) {
  return (
    <svg viewBox="2 2 20 20" width={18} height={18} aria-hidden="true">
      <path
        className={className}
        d="M9,15V9h6v6H9Zm2-2h2V11H11v2ZM9,21V19H7q-0.82,0-1.41-0.59T5,17V15H3V13H5V11H3V9H5V7Q5,6.18 5.59,5.59T7,5H9V3h2V5h2V3h2V5h2q0.82,0 1.41,0.59Q19,6.18 19,7V9h2v2H19v2h2v2H19v2q0,0.82-0.59,1.41T17,19H15v2H13V19H11v2H9Zm8-4V7H7V17H17Zm-5-5Z"
      />
    </svg>
  );
}

/** Ikon "Basis Data" — folder arsip berisi papan catur (monokrom, ikut warna kelas fill). */
function IkonDatabase({ className }) {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} aria-hidden="true">
      <path
        className={className}
        d="m2 3.43c0-1.03.4-1.43 1.43-1.43h13.13c1.03 0 1.43.4 1.43 1.43v6.57h-2v-3h-3v-3h-3v3h-3v-3h-3v3h3v1c-.03 0-.07 0-.1 0h-4.9zm8 3.57h3v3h-2.97zm9.9 15h-16.37c-1.03 0-1.5-.4-1.7-1.4l-1.77-9.3c-.13-.8.27-1.3 1.1-1.3h3.87c1.03 0 1.6.37 2 1.3l-.07-.17c.23.57.7.87 1.3.87h7.97c1.03 0 1.5.4 1.63 1.43l.83 6.57c.13.93 1.3.97 1.3-.33v-12.67h2.9c.83 0 1.23.5 1.07 1.3l-2.37 12.3c-.2 1-.67 1.4-1.7 1.4zm0 0"
      />
    </svg>
  );
}

export default function Nav() {
  const { t } = useI18n();
  /*
   * Bilah hanya berlangganan layar, bukan state papan maupun progres engine.
   */
  const [tampilan, setTampilan] = useTampilan();
  const { bukaPapan, perluPulih } = useTabKerja();
  const [navTerbuka, setNavTerbuka] = useState(() => bacaBoolean("navTerbuka", true));
  const [navDiAtas, setNavDiAtas] = useState(() => typeof window !== "undefined" && window.innerWidth < navTop);
  const papanRef = useRef(null);
  const berandaRef = useRef(null);
  const toggleRef = useRef(null);

  useEffect(() => { tulisBoolean("navTerbuka", navTerbuka); }, [navTerbuka]);
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const ukur = () => setNavDiAtas(window.innerWidth < navTop);
    window.addEventListener("resize", ukur);
    return () => window.removeEventListener("resize", ukur);
  }, []);

  // Bila perubahan ukuran menyembunyikan tombol yang sedang fokus, pindahkan
  // fokus ke navigasi ponsel, bukan membiarkannya jatuh ke <body>.
  function pulihkanFokus(event) {
    if (window.innerWidth >= navTop || event.relatedTarget) return;
    const tujuan = papanRef.current && !papanRef.current.disabled ? papanRef.current : berandaRef.current;
    tujuan?.focus({ preventScroll: true });
  }

  function pulihkanFokusBeranda(event) {
    if (!event.relatedTarget && window.getComputedStyle(event.currentTarget).display === "none") {
      toggleRef.current?.focus({ preventScroll: true });
    }
  }

  /*
   * `kunci` adalah penanda menu yang stabil (dipakai data-uji), sedangkan
   * `tampilan` adalah layar yang dipilihnya.
   */
  const menu = [
    {
      label: t("analisa.nav.papan"),
      tampilan: TAMPILAN_ANALISA.PAPAN,
      icon: (props) => <IkonPapan className={props.className} />,
      kunci: "papan",
    },
    {
      label: t("analisa.nav.akun"),
      icon: (props) => <Profile width={18} height={18} class={props.className} />,
      tampilan: TAMPILAN_ANALISA.AKUN,
      kunci: "akun",
    },
    {
      label: t("analisa.nav.database"),
      icon: (props) => <IkonDatabase className={props.className} />,
      tampilan: TAMPILAN_ANALISA.BASIS_DATA,
      kunci: "database",
    },
    {
      label: t("analisa.nav.engine"),
      icon: (props) => <IkonEngine className={props.className} />,
      tampilan: TAMPILAN_ANALISA.ENGINE,
      kunci: "engine",
    },
  ];

  /* Pengaturan sengaja dipisah dari menu utama supaya duduk di dasar bilah. */
  const menuBawah = [
    {
      label: t("analisa.nav.pengaturan"),
      icon: () => <Settings className="h-[18px] w-[18px] shrink-0" />,
      tampilan: TAMPILAN_ANALISA.PENGATURAN,
      kunci: "pengaturan",
    },
  ];

  /*
   * Posisi ikon sengaja DIKUNCI: bantalan kiri 7px tidak berubah antara
   * bilah melebar dan menciut, sehingga ikon tidak bergeser saat burger
   * ditekan. Yang berubah hanya lebar label (di kelasLabelNav) dan gap-nya;
   * label memakai max-w-0 saat menciut, jadi tidak mendorong ikon.
   * Di rail 32px: 7px + ikon 18px + 7px = 32px pas.
   * Mode ponsel tetap memakai target sentuh setinggi 40px.
   */
  const kelasTombol = `flex flex-row gap-2.5 h-full min-h-10 navTop:min-h-0 navTop:h-9 navTop:min-w-0 navTop:justify-start justify-center items-center navTop:py-0 p-2 navTop:px-[7px] group hover:bg-backgroundBoxHover text-foregroundGrey hover:text-foregroundHighlighted transition-colors cursor-pointer navTop:w-full ${navTerbuka ? "" : "navTop:gap-0"}`;

  /** Perubahan lebar label seketika; hanya opacity yang ditransisikan. */
  const kelasLabelNav = `overflow-hidden whitespace-nowrap transition-opacity duration-150 motion-reduce:transition-none hidden navTop:block text-[15px] leading-5 font-bold ${
    navTerbuka ? "navTop:max-w-[116px] navTop:opacity-100" : "navTop:max-w-0 navTop:opacity-0"
  }`;

  /** Tombol menu dipakai ulang untuk grup atas dan grup bawah (Pengaturan). */
  function tombolMenu(item) {
    // Layar yang sedang tampil ditandai di bilah, persis seperti sidebar
    // dashboard Pengurus menandai tab aktifnya.
    const aktif = Boolean(item.tampilan) && (tampilan === item.tampilan ||
      (item.tampilan === TAMPILAN_ANALISA.PAPAN && tampilan === TAMPILAN_ANALISA.BERMAIN));
    return (
      <TooltipLabel key={item.kunci} stabil label={!navTerbuka || navDiAtas ? item.label : undefined} side="right">
        <button
          ref={item.kunci === "papan" ? papanRef : undefined}
          type="button"
          data-uji={`nav-${item.kunci}`}
          aria-label={item.label}
          aria-current={aktif ? "true" : undefined}
          disabled={perluPulih}
          onClick={() => { if (item.kunci === "papan") void bukaPapan(); else setTampilan(item.tampilan); }}
          className={`${kelasTombol} disabled:cursor-wait disabled:opacity-50${aktif ? " bg-backgroundBoxHover text-foregroundHighlighted" : ""}`}
        >
          {/*
            Ikon dibungkus slot tetap 18x18: SVG punya `overflow: hidden`
            dari UA stylesheet sehingga bisa menyusut di flexbox saat rail
            menciut. Slot ini juga mengunci posisi ikon agar tidak bergeser.
          */}
          <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center">
            {item.icon({ className: `transition-colors group-hover:fill-foregroundHighlighted ${aktif ? "fill-foregroundHighlighted" : "fill-foregroundGrey"}` })}
          </span>
          <span className={kelasLabelNav}>{item.label}</span>
        </button>
      </TooltipLabel>
    );
  }

  return (
    /* Lebar 188px membuat tepi kanan bilah (garis pemisah area kerja)
       duduk dekat wordmark tanpa memotong huruf terakhir "Chess". */
    <nav className={`flex flex-col navTop:h-full w-full relative ${navTerbuka ? "navTop:w-[188px]" : "navTop:w-12"} navTop:shrink-0`}>
      {/*
        `navTop:px-2` = bantalan 8px lajur: 3rem rail = 8 + 2rem + 8
        (sama dengan bantalan SidebarContent + SidebarMenuButton di
        `components/ui/sidebar.jsx`).
        `navTop:overflow-x-hidden`: `overflow-y-auto` menurut spesifikasi
        memaksa overflow-x jadi auto juga. Sembunyikan limpahan agar label
        yang panjang tidak memunculkan scrollbar horizontal pada rail kecil.
      */}
      <div className="navTop:pt-1 navTop:pb-6 navTop:px-2 navTop:h-full w-full overflow-y-auto navTop:overflow-x-hidden bg-backgroundBox flex navTop:flex-col flex-row justify-between select-none navTop:items-start items-stretch">
        <div className="flex navTop:flex-col flex-row navTop:w-full navTop:min-w-0">
          {/*
            Baris kepala: burger + wordmark. Burger hanya ada di bilah tegak
            (di mode ponsel bilahnya sudah mendatar, tidak ada yang bisa
            dibuka-tutup); wordmark mengekor di sebelahnya dan menyusut
            habis saat bilah menciut, jadi tidak ada teks terpotong.
          */}
          <div className="flex flex-row items-center gap-1 navTop:w-full navTop:py-1">
            <TooltipLabel label={navTerbuka ? t("analisa.nav.tutupBilah") : t("analisa.nav.bukaBilah")} side="right">
              <button
                ref={toggleRef}
                type="button"
                data-uji="nav-tutup"
                onClick={() => setNavTerbuka((t) => !t)}
                onBlur={pulihkanFokus}
                aria-label={navTerbuka ? t("analisa.nav.tutupBilah") : t("analisa.nav.bukaBilah")}
                aria-expanded={navTerbuka}
                className="hidden navTop:flex navTop:shrink-0 items-center justify-center w-8 h-8 navTop:px-2 group hover:bg-backgroundBoxHover text-foregroundGrey hover:text-foregroundHighlighted transition-colors cursor-pointer"
              >
                <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </TooltipLabel>
            <Link
              ref={berandaRef}
              onBlur={pulihkanFokusBeranda}
              draggable={false}
              href="/"
              /*
               * Wordmark-nya `hidden` di mode ponsel — tanpa aria-label
               * tautan ini kosong bagi pembaca layar (temuan audit
               * Lighthouse "links do not have a discernible name").
               */
              aria-label={t("analisa.nav.beranda")}
              className={`min-w-0 min-h-10 navTop:min-h-0 flex-row items-center navTop:py-1 p-1.5 transition-colors hover:bg-backgroundBoxHover ${
                navTerbuka ? "flex" : "navTop:hidden"
              }`}
            >
              <span
                className={`hidden navTop:block leading-none font-bold text-[17px] tracking-tight text-foreground overflow-hidden whitespace-nowrap transition-opacity duration-150 motion-reduce:transition-none ${
                  navTerbuka ? "max-w-[124px] opacity-100" : "max-w-0 opacity-0"
                }`}
              >
                Maestro<span className="text-backgroundBoxBoxHighlighted"> Chess</span>
              </span>
            </Link>
          </div>
          <hr className="border-border mx-2 navTop:mx-0 my-1 navTop:block hidden" />
          <div className="flex navTop:flex-col flex-row navTop:gap-1 navTop:w-full navTop:min-w-0">
            {menu.map(tombolMenu)}
          </div>
        </div>
        <div className="flex navTop:flex-col flex-row navTop:gap-1 navTop:w-full navTop:min-w-0 navTop:mt-auto">
          {menuBawah.map(tombolMenu)}
        </div>
      </div>
    </nav>
  );
}
