/**
 * Layar "Pengaturan" Report Analisa — pengganti popup gear di BoardMenu.
 *
 * Tata letak mengikuti layar Settings en-croissant: kolom pencarian di atas,
 * sub-sidebar vertikal di kiri, dan kartu pengaturan di kanan yang berisi
 * judul, deskripsi, serta baris "label + deskripsi + kontrol". Tab hanya
 * dibuat untuk grup yang benar-benar punya pengaturan; tidak ada tab dummy.
 *
 * Pengaturan mesin sudah dipindah ke layar Engine dan sengaja tidak muncul di
 * sini. Semua state memakai konteks/localStorage yang sama seperti sebelumnya.
 */
import { useState } from "react";
import { Puzzle } from "lucide-react";
import Link from "next/link";
import { useI18n } from "../../../../lib/i18n.jsx";
import { URL_REPO } from "../../../../lib/repo.js";
import PanelLayar from "./PanelLayar.jsx";
import Themes from "../pengaturan/themes.jsx";
import Ratings from "../pengaturan/ratings.jsx";
import Moves from "../pengaturan/moves.jsx";
import Tampilan from "../pengaturan/tampilan.jsx";
import BestMoves from "../pengaturan/bestMoves.jsx";
import TekaTekiPengaturan from "../pengaturan/tekaTeki.jsx";
import BarisPengaturan from "../pengaturan/barisPengaturan.jsx";
import { TAB_META, GRUP_META, BARIS_STATIS } from "../pengaturan/katalogPengaturan.js";
import { boardThemes } from "../../../../modul/sesi/preferensi.js";
import { daftarRating } from "../pengaturan/ratings.jsx";
import GitHub from "../svg/github.jsx";
import Lisensi from "../svg/license.jsx";

function Ikon({ children }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0" aria-hidden="true">
      {children}
    </svg>
  );
}
function IkonPapan() {
  return <Ikon><circle cx="12" cy="6" r="2.5" /><path d="M9.5 10h5l1.5 6H8l1.5-6z" /><path d="M6 19h12" /></Ikon>;
}
function IkonPuzzle() {
  return <Puzzle className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />;
}
function IkonLabel() {
  return <Ikon><path d="M20.6 13.4 12 22l-9-9V4a1 1 0 0 1 1-1h9l7.6 7.6a2 2 0 0 1 0 2.8z" /><circle cx="7.5" cy="7.5" r="1.3" /></Ikon>;
}
function IkonPanah() {
  return <Ikon><path d="M4 12h15" /><path d="m13 6 6 6-6 6" /></Ikon>;
}
function IkonBahasa() {
  return <Ikon><circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3a15 15 0 0 1 0 18" /><path d="M12 3a15 15 0 0 0 0 18" /></Ikon>;
}
function IkonDokumentasi() {
  return <Ikon><path d="M4 19.5V5a2 2 0 0 1 2-2h13v18H6a2 2 0 0 1-2-1.5Z" /><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H19" /><path d="M8 7h7M8 11h7" /></Ikon>;
}

function GrupPengaturan({ judul, deskripsi, children }) {
  return (
    <section className="rounded-[6px] border-2 border-border bg-backgroundBox">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-bold text-foreground">{judul}</h2>
        <p className="mt-0.5 text-xs leading-4 text-foregroundGrey">{deskripsi}</p>
      </div>
      <div className="px-4 pb-2 pt-1">{children}</div>
    </section>
  );
}

function IkonGitHubTautan({ className }) {
  return <GitHub class={className} />;
}
function IkonLisensiTautan({ className }) {
  return <Lisensi className={className} />;
}

function BarisTautan({ kunci, label, href, eksternal = false, IkonTautan, cocok, deskripsi }) {
  if (!cocok(kunci, label)) return null;
  const Komponen = eksternal ? "a" : Link;
  return (
    <BarisPengaturan
      judul={
        <Komponen
          href={href}
          {...(eksternal ? { target: "_blank", rel: "noreferrer noopener" } : {})}
          aria-label={label}
          className="flex flex-1 items-center gap-2 text-left font-medium text-foreground hover:text-backgroundBoxBoxHighlightedHover focus-visible:text-backgroundBoxBoxHighlightedHover focus-visible:outline-none"
        >
          <span className="flex shrink-0">
            <IkonTautan className="fill-foregroundGrey transition-colors group-hover:fill-backgroundBoxBoxHighlightedHover" />
          </span>
          <span className="text-[13.5px]">{label}</span>
          <span aria-hidden="true" className="text-foregroundGrey">↗</span>
        </Komponen>
      }
      deskripsi={deskripsi(kunci)}
    />
  );
}

function BarisBahasa({ bahasa, setBahasa, label, cocok, deskripsi }) {
  if (!cocok("bahasa", label)) return null;
  return (
    <BarisPengaturan
      judul={<span className="text-[13.5px] font-medium text-foreground">{label}</span>}
      deskripsi={deskripsi("bahasa")}
    >
      <select
        aria-label={label}
        value={bahasa}
        onChange={(event) => setBahasa(event.target.value)}
        className="rounded-borderRoundness border border-border bg-backgroundDropdown px-2 py-1 text-sm text-foreground"
      >
        <option value="id">Bahasa Indonesia</option>
        <option value="en">English</option>
      </select>
    </BarisPengaturan>
  );
}

export default function LayarPengaturan({ aktif = true }) {
  const { t, bahasa, setBahasa } = useI18n();
  const [pencarian, setPencarian] = useState("");
  const [tabAktif, setTabAktif] = useState("papan");

  const labelBahasa = t("analisa.pengaturan.bahasa");
  // Metadata tab/grup/baris diturunkan dari katalog tunggal ("1 pintu");
  // ikon dan render kontrol tetap di sini karena berupa komponen React.
  const IKON_TAB = { papan: IkonPapan, penilaian: IkonLabel, langkah: IkonPanah, "teka-teki": IkonPuzzle, bahasa: IkonBahasa, dokumentasi: IkonDokumentasi };
  const daftarTab = TAB_META.map((meta) => ({ id: meta.id, judul: t(meta.judulKunci), deskripsi: t(meta.deskripsiKunci), Ikon: IKON_TAB[meta.id] }));

  const renderGrup = {
    tema: (props) => <Themes {...props} />,
    perilaku: (props) => <Moves aktif={aktif} {...props} />,
    tampilan: (props) => <Tampilan {...props} />,
    penilaian: (props) => <Ratings {...props} />,
    langkah: (props) => <BestMoves {...props} />,
    tekaTeki: (props) => <TekaTekiPengaturan {...props} />,
    bahasa: (props) => <BarisBahasa bahasa={bahasa} setBahasa={setBahasa} label={labelBahasa} {...props} />,
    dokumentasi: (props) => (
      <>
        <BarisTautan kunci="kodeSumber" label={t("analisa.nav.kodeSumber")} href={URL_REPO} eksternal IkonTautan={IkonGitHubTautan} {...props} />
        <BarisTautan kunci="atribusi" label={t("analisa.nav.atribusi")} href="/attributions" IkonTautan={IkonLisensiTautan} {...props} />
      </>
    ),
  };
  const daftarGrup = GRUP_META.map((meta) => ({ id: meta.id, tab: meta.tab, judul: t(meta.judulKunci), deskripsi: t(meta.deskripsiKunci), render: renderGrup[meta.id] }));

  // Indeks pencarian = baris dinamis (tema & rating) + baris statis katalog.
  const daftarBaris = [
    ...boardThemes.map((tema) => ({ kunci: `tema.${tema.kunci}`, label: t(`analisa.tema.${tema.kunci}`), grup: "tema" })),
    ...BARIS_STATIS.map((baris) => ({ kunci: baris.kunci, label: t(baris.labelKunci), grup: baris.grup })),
    ...daftarRating.filter((rating) => rating !== "critical").map((rating) => ({
      kunci: `rating.${rating}`,
      label: rating.charAt(0).toUpperCase() + rating.slice(1),
      grup: "penilaian",
    })),
  ];

  const kueri = pencarian.trim().toLowerCase();
  const cocok = (kunci, label) => !kueri || `${kunci} ${label || ""}`.toLowerCase().includes(kueri);
  const hasil = kueri ? daftarBaris.filter((baris) => cocok(baris.kunci, baris.label)) : [];
  const grupDitampilkan = daftarGrup.filter((grup) =>
    kueri ? hasil.some((baris) => baris.grup === grup.id) : grup.tab === tabAktif
  );
  const deskripsi = (kunci) => t(`analisa.pengaturan.deskripsi.${kunci}`);

  return (
    /* Sama seperti layar Basis Data Permainan, tapi garisnya diturunkan
       sedikit: pb-1 / sm:pb-2 alih-alih pb-0.5 / sm:pb-1. */
    <PanelLayar kepalaRapat kepalaRapatPb="pb-1 sm:pb-2" judul={t("analisa.pengaturan.judul")}>
      {/* -mr meniadakan bantalan kanan PanelLayar supaya tepi scroll
          berada persis di garis panel, bukan tertinggal di dalamnya. */}
      <div className="-mr-3 flex min-h-0 flex-1 flex-col overflow-hidden sm:-mr-5">
        <div className="shrink-0 px-1 pb-2 pt-1 sm:px-0">
          <div className="relative w-full max-w-[410px]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foregroundGrey" aria-hidden="true">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="search"
              value={pencarian}
              onChange={(event) => setPencarian(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Escape") setPencarian(""); }}
              aria-label={t("analisa.pengaturan.cari")}
              placeholder={t("analisa.pengaturan.cari")}
              className="h-[34px] w-full rounded-[4px] border border-border bg-backgroundBoxBox pl-9 pr-3 text-[13px] text-foreground placeholder:text-foregroundGrey focus:border-backgroundBoxBoxHighlightedHover focus:outline-none"
            />
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden pt-1 sm:flex-row">
          <nav aria-label={t("analisa.pengaturan.kategori")} className="flex w-full shrink-0 flex-row overflow-x-auto border-b border-border sm:w-[145px] sm:flex-col sm:overflow-x-hidden sm:overflow-y-auto sm:border-b-0 sm:border-r sm:pl-1">
            {daftarTab.map((tab) => {
              const Dipilih = tab.id === tabAktif;
              const IkonTab = tab.Ikon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  title={tab.deskripsi}
                  aria-current={Dipilih ? "page" : undefined}
                  onClick={() => { setTabAktif(tab.id); setPencarian(""); }}
                  className={`relative flex shrink-0 items-center gap-2.5 px-3 py-2.5 text-left text-[14px] font-semibold leading-5 transition-colors ${
                    Dipilih
                      ? "font-medium text-backgroundBoxBoxHighlighted"
                      : "text-foregroundGrey hover:bg-backgroundBoxBox hover:text-foreground"
                  }`}
                >
                  <IkonTab />
                  <span className="truncate">{tab.judul}</span>
                  {Dipilih ? <span aria-hidden="true" className="absolute bottom-0 left-0 right-0 h-[2px] bg-backgroundBoxBoxHighlighted sm:left-auto sm:top-0 sm:h-auto sm:w-[2px]" /> : null}
                </button>
              );
            })}
          </nav>

          <div className="min-w-0 flex-1 overflow-y-auto [scrollbar-gutter:stable] pb-4 pl-1 pr-3 pt-3 sm:pl-4 sm:pr-5 sm:pt-0">
            {kueri && hasil.length === 0 ? (
              <p className="rounded-[6px] border-2 border-border bg-backgroundBox px-5 py-4 text-sm text-foregroundGrey">
                {t("analisa.pengaturan.hasilKosong", { q: pencarian.trim() })}
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {grupDitampilkan.map((grup) => (
                  <GrupPengaturan key={grup.id} judul={grup.judul} deskripsi={grup.deskripsi}>
                    {grup.render({ cocok, deskripsi })}
                  </GrupPengaturan>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </PanelLayar>
  );
}
