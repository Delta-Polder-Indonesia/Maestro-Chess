import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUpRight,
  AudioLines,
  BookOpenText,
  ChessKnight,
  ChevronRight,
  Cpu,
  Flag,
  PanelsTopLeft,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const metadata: Metadata = {
  title: "Atribusi & lisensi — Maestro Chess",
  description: "Atribusi, lisensi, dan kode sumber perangkat lunak serta aset yang digunakan Maestro Chess.",
};

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const file = (path: string) => `${basePath}/${path}`;

const linkStyle = "font-semibold text-[#b8df91] underline decoration-[#789c5a] underline-offset-[3px] hover:text-white focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#c5ed9e]";

export default function Attributions() {
  return (
    <main className="h-full w-full overflow-x-hidden overflow-y-auto bg-[#121512] text-[#edf1eb]">
      <a href="#konten-atribusi" className="sr-only z-50 rounded bg-[#c5ed9e] px-4 py-2 font-semibold text-[#182015] focus:not-sr-only focus:absolute focus:left-4 focus:top-4">
        Lewati ke isi
      </a>

      <header className="border-b border-[#303a2e] bg-[#171b17]">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link href="/" aria-label="Maestro Chess — Beranda" className="inline-flex items-center gap-3 rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#c5ed9e]">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#a9d978] text-[#1d2c19]">
              <ChessKnight size={22} strokeWidth={1.8} aria-hidden="true" />
            </span>
            <span className="whitespace-nowrap text-base font-bold tracking-tight">Maestro <span className="text-[#a9d978]">Chess</span></span>
          </Link>
          <Link href="/" className="inline-flex min-h-10 items-center gap-2 rounded-sm text-sm font-semibold text-[#cbd4c7] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#c5ed9e]">
            <ArrowLeft size={16} aria-hidden="true" />
            <span className="hidden sm:inline">Kembali ke aplikasi</span>
            <span className="sm:hidden">Kembali</span>
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-[1200px] px-5 pb-12 sm:px-8 sm:pb-16">
        <nav aria-label="Jejak navigasi" className="pt-7 sm:pt-9">
          <ol className="flex flex-wrap items-center gap-2 text-sm text-[#aeb9aa]">
            <li><Link href="/" className="rounded-sm hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#c5ed9e]">Beranda</Link></li>
            <li aria-hidden="true"><ChevronRight size={15} /></li>
            <li aria-current="page" className="text-[#e1e8dd]">Atribusi & lisensi</li>
          </ol>
        </nav>

        <article id="konten-atribusi">
          <header className="flex items-center justify-between gap-12 pb-12 pt-10 sm:pb-16 sm:pt-14">
            <div className="max-w-[720px]">
              <p className="flex items-center gap-3 text-xs font-bold uppercase tracking-[0.16em] text-[#b8df91]">
                <span aria-hidden="true" className="h-px w-7 bg-[#a9d978]" />
                Tentang proyek
              </p>
              <h1 className="mt-4 text-4xl font-bold leading-[1.1] tracking-[-0.035em] text-[#f5f7f3] sm:text-5xl lg:text-[3.5rem]">
                Atribusi & lisensi
              </h1>
              <p className="mt-5 max-w-[680px] text-base leading-7 text-[#bfc9bb] sm:mt-6 sm:text-lg sm:leading-8">
                Terima kasih kepada pembuat perangkat lunak dan aset yang digunakan dalam aplikasi analisa mandiri ini.
                Setiap komponen tetap mengikuti lisensinya masing-masing.
              </p>
              <a href="#daftar-atribusi" className="mt-7 inline-flex min-h-10 items-center gap-2 rounded-sm text-sm font-semibold text-[#b8df91] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#c5ed9e]">
                Lihat daftar atribusi <ArrowDown size={16} aria-hidden="true" />
              </a>
            </div>

            <div aria-hidden="true" className="relative hidden h-40 w-56 shrink-0 overflow-hidden rounded-2xl border border-[#3b4937] bg-[#1b241a] md:flex md:items-center md:justify-center">
              <div className="absolute inset-0 opacity-75" style={{ backgroundImage: "conic-gradient(#293626 25%, #1d281c 0 50%, #293626 0 75%, #1d281c 0)", backgroundSize: "72px 72px" }} />
              <div className="relative flex h-24 w-24 items-center justify-center rounded-full border border-[#94bd74]/40 bg-[#172116]/90 text-[#c0e6a0] shadow-xl">
                <ChessKnight size={53} strokeWidth={1.3} />
              </div>
            </div>
          </header>

          <section id="daftar-atribusi" aria-labelledby="judul-daftar" className="scroll-mt-6 border-t border-[#354033] pt-8 sm:pt-10">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-3 sm:mb-8">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#b8df91]">Daftar atribusi</p>
                <h2 id="judul-daftar" className="mt-2 text-2xl font-bold tracking-tight text-[#f5f7f3] sm:text-3xl">Komponen & aset</h2>
                <p className="mt-2 text-sm leading-6 text-[#b5c0b1] sm:text-base">Pembuat, lisensi, dan sumber dari setiap bagian yang digunakan.</p>
              </div>
              <p className="rounded-full border border-[#3d4b39] px-3 py-1 text-xs font-semibold text-[#c4d1bf]">6 kategori</p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2 lg:grid-cols-6">
              <AttributionCard number="01" category="Perangkat lunak" title="Antarmuka & analisis" icon={PanelsTopLeft} className="lg:col-span-2" resources={
                <p><Local href="licenses/chessclub-MIT.txt">Lisensi ChessClub</Local> · <Local href="licenses/brilliant-chess-MIT.txt">Lisensi Brilliant-Chess</Local> · <Local href="licenses/chess-game-reviewer-MIT.txt">Lisensi ChessGameReviewer</Local></p>
              }>
                <p>Diadaptasi dari <External href="https://github.com/Delta-Polder-Indonesia/ChessClub">ChessClub</External> (MIT, © 2025–2026 Delta-Polder-Indonesia), yang mengadaptasi <External href="https://github.com/wdeloo/Brilliant-Chess">Brilliant-Chess</External> (MIT, © 2025 Delo). Sebagian komponen juga diadaptasi dari <External href="https://github.com/SheyBoiCarti/ChessGameReviewer">ChessGameReviewer</External> (MIT, © 2026 Chess Game Reviewer contributors).</p>
              </AttributionCard>

              <AttributionCard number="02" category="Mesin analisis" title="Engine Stockfish" icon={Cpu} className="lg:col-span-4" wide resources={
                <>
                  <p><Local href="engine/source/COPYING.txt">Lisensi GPL-3.0</Local> · <Local href="engine/source/AUTHORS.txt">Penulis</Local></p>
                  <p>Kode sumber: <Local href="engine/source/stockfish.js-efc5758a1cf72ec7644fa771a1f17fcbfdae410e-no-networks.tar.gz">16</Local> · <Local href="engine/source/stockfish.js-215df8c6a72847e306644d399733de18fb8e0d6c-source-only.tar.gz">16.1</Local> · <Local href="engine/source/stockfish.js-602fd7e1a571a2be71f242942db90483731f2a1f-source-only.tar.gz">17.1</Local> · <Local href="engine/source/stockfish.js-082eeba46b0c5f8f8065e5386750aa0ecfa2062c.tar.gz">18</Local> · <Local href="engine/source/stockfish.js-93c994592dcf3b4b21052ab925e9b534df9c0918.tar.gz">18 (JS 18.0.8)</Local> · <Local href="engine/source/stockfish.js-0d5dd7944f88c817c07a26bc4fb1905d5f9c46d6.tar.gz">19</Local>.</p>
                  <p>Jaringan NNUE: <Local href="engine/nn-5af11540bbfe.nnue">16</Local> · <Local href="engine/source/nn-9067e33176e8.nnue">Lite 16.1–18</Local> · <Local href="engine/source/nn-61e7af4bb97d.nnue">Lite 19</Local>. Salin jaringan yang sesuai ke direktori <code>src/</code> sumber jika membangun ulang engine.</p>
                </>
              }>
                <p>Mesin Stockfish dan distribusi <External href="https://github.com/nmrugg/stockfish.js">stockfish.js</External> dilisensikan GPL-3.0. Semua pilihan memakai satu utas dan berjalan lokal di peramban. Stockfish 18 Lite (JS 18.0.8) memakai WASM yang sama dengan Stockfish 18 Lite bawaan, dengan pemuat JavaScript berbeda.</p>
              </AttributionCard>

              <AttributionCard number="03" category="Visual" title="Bidak catur" icon={ChessKnight} className="lg:col-span-3" resources={
                <p><External href="https://creativecommons.org/licenses/by-sa/3.0/">CC BY-SA 3.0</External></p>
              }>
                <p>Desain bidak oleh <External href="https://en.wikipedia.org/wiki/User:Cburnett">Cburnett</External>, diadaptasi sebagai komponen SVG.</p>
              </AttributionCard>

              <AttributionCard number="04" category="Audio" title="Suara papan" icon={AudioLines} className="lg:col-span-3" resources={
                <p><Local href="licenses/lichess-AGPL-3.0.txt">Lisensi AGPL-3.0</Local></p>
              }>
                <p>Suara dari set standar <External href="https://github.com/lichess-org/lila/tree/master/public/sound/standard">Lichess</External>, AGPL-3.0. Beberapa nama berkas menggunakan suara yang sama.</p>
              </AttributionCard>

              <AttributionCard number="05" category="Data catur" title="Buku pembukaan" icon={BookOpenText} className="lg:col-span-3" resources={
                <p><Local href="licenses/chess-openings-CC0.txt">Lisensi CC0</Local></p>
              }>
                <p>Tabel pembukaan ChessClub diolah dari <External href="https://github.com/lichess-org/chess-openings">lichess-org/chess-openings</External>, CC0 1.0.</p>
              </AttributionCard>

              <AttributionCard number="06" category="Visual & tipografi" title="Bendera & huruf" icon={Flag} className="lg:col-span-3" resources={
                <p><Local href="licenses/flag-icons-MIT.txt">Lisensi bendera</Local> · <Local href="licenses/geist-OFL-1.1.txt">Lisensi huruf</Local></p>
              }>
                <p>Bendera dari <External href="https://github.com/lipis/flag-icons">flag-icons</External> (MIT, © 2013 Panayiotis Lipiridis). Huruf Geist Variable oleh <External href="https://github.com/vercel/geist-font">The Geist Project Authors</External> (SIL OFL 1.1).</p>
              </AttributionCard>
            </div>
          </section>

          <footer className="mt-10 border-t border-[#354033] pt-7 sm:mt-14 sm:pt-8">
            <h2 className="text-sm font-semibold text-[#e4eae1]">Catatan merek</h2>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-[#b5c0b1]">
              Nama dan logo Chess.com serta Lichess merupakan merek pemiliknya masing-masing dan hanya digunakan untuk menunjukkan layanan yang didukung.
            </p>
          </footer>
        </article>
      </div>
    </main>
  );
}

function AttributionCard({ number, category, title, icon: Icon, children, resources, className = "", wide = false }: {
  number: string;
  category: string;
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
  resources: React.ReactNode;
  className?: string;
  wide?: boolean;
}) {
  const titleId = `atribusi-${number}`;
  return (
    <article aria-labelledby={titleId} className={`flex min-w-0 flex-col rounded-xl border border-[#3a4538] bg-[#1c211c] p-6 sm:p-7 ${className}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 pt-1 text-xs font-bold uppercase tracking-[0.12em]">
          <span aria-hidden="true" className="text-[#b8df91]">{number}</span>
          <span aria-hidden="true" className="h-3 w-px bg-[#596755]" />
          <span className="text-[#b5c1b0]">{category}</span>
        </div>
        <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[#42553d] bg-[#293a26] text-[#c2e5a6]">
          <Icon size={23} strokeWidth={1.7} />
        </span>
      </div>
      <h3 id={titleId} className="mt-5 text-xl font-bold tracking-tight text-[#f3f6f1]">{title}</h3>
      <div className={`mt-3 flex flex-1 flex-col ${wide ? "lg:grid lg:grid-cols-2 lg:items-start lg:gap-6" : ""}`}>
        <div className="space-y-3 text-[15px] leading-6 text-[#ced7ca]">{children}</div>
        <div className={`mt-auto pt-6 ${wide ? "lg:mt-0 lg:pt-0" : ""}`}>
          <div className={`border-t border-[#3a4638] pt-5 ${wide ? "lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0" : ""}`}>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#b5c1b0]">Lisensi & sumber</p>
            <div className="mt-3 space-y-3 text-sm leading-6 text-[#ced7ca]">{resources}</div>
          </div>
        </div>
      </div>
    </article>
  );
}

function External({ href, children }: { href: string; children: React.ReactNode }) {
  return <a href={href} target="_blank" rel="noopener noreferrer" className={linkStyle}>{children}<ArrowUpRight size={13} aria-hidden="true" className="ml-0.5 inline-block align-baseline" /><span className="sr-only"> (terbuka di tab baru)</span></a>;
}

function Local({ href, children }: { href: string; children: React.ReactNode }) {
  // Version numbers alone would be ambiguous in a screen reader's link list.
  const label = typeof children !== "string" ? undefined
    : href.endsWith(".tar.gz") ? `Kode sumber Stockfish ${children}`
      : href.endsWith(".nnue") ? `Jaringan NNUE ${children}`
        : undefined;
  return <a href={file(href)} aria-label={label} className={linkStyle}>{children}</a>;
}
