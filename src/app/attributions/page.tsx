import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Atribusi & lisensi — Maestro Chess",
  description: "Atribusi, lisensi, dan kode sumber perangkat lunak serta aset yang digunakan Maestro Chess.",
};

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const file = (path: string) => `${basePath}/${path}`;
const linkStyle = "font-medium text-[#436b35] underline underline-offset-[3px] hover:text-[#253f20] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#436b35]";

const pageLinks = [
  ["#daftar-atribusi", "Semua komponen"],
  ["#antarmuka", "Antarmuka & analisis"],
  ["#stockfish", "Engine Stockfish"],
  ["#bendera", "Bendera & huruf"],
  ["#bidak", "Bidak catur"],
  ["#suara", "Suara papan"],
  ["#pembukaan", "Buku pembukaan"],
  ["#sumber-stockfish", "Sumber Stockfish & NNUE"],
];

export default function Attributions() {
  // The root layout locks the body; anchoring this scroll area prevents fragment
  // navigation from scrolling the hidden body as well as the page content.
  return (
    <main className="fixed inset-0 overflow-x-hidden overflow-y-auto bg-[#f3f4f3] text-[#202421]">
      <a href="#konten-atribusi" className="sr-only z-50 bg-white px-4 py-2 font-semibold text-[#202421] outline outline-2 outline-[#436b35] focus:not-sr-only focus:absolute focus:left-4 focus:top-4">
        Lewati ke isi
      </a>

      <header className="border-b border-[#e2e4e2] bg-[#f8f9f8]">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-5 py-5 sm:px-10">
          <Link href="/" aria-label="Maestro Chess — Beranda" className="whitespace-nowrap text-lg font-bold text-[#202421] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#436b35]">
            Maestro <span className="text-[#436b35]">Chess</span>
          </Link>
          <Link href="/" aria-label="Kembali ke Maestro Chess" className="inline-flex min-h-9 items-center gap-2 text-sm font-medium text-[#343b35] hover:text-[#436b35] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#436b35]">
            <ArrowLeft size={16} aria-hidden="true" />
            <span className="hidden sm:inline">Kembali ke aplikasi</span>
            <span className="sm:hidden">Kembali</span>
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-[1440px] lg:flex">
        <aside className="hidden w-[244px] shrink-0 px-10 py-10 lg:block">
          <nav aria-label="Bagian halaman" className="sticky top-8">
            <p className="text-base font-bold">Di halaman ini</p>
            <ul className="mt-5 space-y-4 text-sm leading-5">
              {pageLinks.map(([href, label]) => (
                <li key={href}><a href={href} className="text-[#454d46] hover:text-[#436b35] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#436b35]">{label}</a></li>
              ))}
            </ul>
          </nav>
        </aside>

        <article id="konten-atribusi" className="min-w-0 flex-1 bg-white px-5 pb-12 pt-8 sm:px-10 sm:pb-16 lg:rounded-tl-xl lg:px-11 lg:pt-10">
          <nav aria-label="Jejak navigasi">
            <ol className="flex flex-wrap items-center gap-3 text-sm leading-6">
              <li><Link href="/" className={linkStyle}>Beranda</Link></li>
              <li aria-hidden="true" className="text-[#727a73]">›</li>
              <li aria-current="page" className="font-medium text-[#343b35]">Atribusi & lisensi</li>
            </ol>
          </nav>

          <header className="mt-10 sm:mt-12">
            <h1 className="text-[2.5rem] font-bold leading-[1.1] tracking-tight text-[#202421] sm:text-5xl xl:text-[3.5rem]">
              Atribusi & lisensi
            </h1>
            <p className="mt-5 max-w-[850px] text-base leading-7 text-[#414942] sm:text-lg sm:leading-8">
              Terima kasih kepada pembuat perangkat lunak dan aset yang digunakan dalam aplikasi analisa mandiri ini.
              Setiap komponen tetap mengikuti lisensinya masing-masing.
            </p>
          </header>

          <section id="daftar-atribusi" aria-label="Daftar komponen dan aset" className="mt-10 scroll-mt-6 sm:mt-12">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              <AttributionCard id="antarmuka" number="01" title="Antarmuka & analisis" resources={
                <ul className="space-y-2">
                  <li><Local href="licenses/chessclub-MIT.txt">Lisensi ChessClub</Local></li>
                  <li><Local href="licenses/brilliant-chess-MIT.txt">Lisensi Brilliant-Chess</Local></li>
                  <li><Local href="licenses/chess-game-reviewer-MIT.txt">Lisensi ChessGameReviewer</Local></li>
                </ul>
              }>
                <p>Diadaptasi dari <External href="https://github.com/Delta-Polder-Indonesia/ChessClub">ChessClub</External> (MIT, © 2025–2026 Delta-Polder-Indonesia), yang mengadaptasi <External href="https://github.com/wdeloo/Brilliant-Chess">Brilliant-Chess</External> (MIT, © 2025 Delo). Sebagian komponen juga diadaptasi dari <External href="https://github.com/SheyBoiCarti/ChessGameReviewer">ChessGameReviewer</External> (MIT, © 2026 Chess Game Reviewer contributors).</p>
              </AttributionCard>

              <AttributionCard id="stockfish" number="02" title="Engine Stockfish" resources={
                <ul className="space-y-2">
                  <li><Local href="engine/source/COPYING.txt">Lisensi GPL-3.0</Local></li>
                  <li><Local href="engine/source/AUTHORS.txt">Penulis Stockfish</Local></li>
                  <li><a href="#sumber-stockfish" className={linkStyle}>Kode sumber dan jaringan NNUE</a></li>
                </ul>
              }>
                <p>Mesin Stockfish dan distribusi <External href="https://github.com/nmrugg/stockfish.js">stockfish.js</External> dilisensikan GPL-3.0. Semua pilihan memakai satu utas dan berjalan lokal di peramban. Stockfish 18 Lite (JS 18.0.8) memakai WASM yang sama dengan Stockfish 18 Lite bawaan, dengan pemuat JavaScript berbeda.</p>
              </AttributionCard>

              <AttributionCard id="bendera" number="03" title="Bendera & huruf" resources={
                <ul className="space-y-2">
                  <li><Local href="licenses/flag-icons-MIT.txt">Lisensi bendera</Local></li>
                  <li><Local href="licenses/geist-OFL-1.1.txt">Lisensi huruf</Local></li>
                </ul>
              }>
                <p>Bendera dari <External href="https://github.com/lipis/flag-icons">flag-icons</External> (MIT, © 2013 Panayiotis Lipiridis). Huruf Geist Variable oleh <External href="https://github.com/vercel/geist-font">The Geist Project Authors</External> (SIL OFL 1.1).</p>
              </AttributionCard>

              <AttributionCard id="bidak" number="04" title="Bidak catur" resources={
                <p><External href="https://creativecommons.org/licenses/by-sa/3.0/">Lisensi CC BY-SA 3.0</External></p>
              }>
                <p>Desain bidak oleh <External href="https://en.wikipedia.org/wiki/User:Cburnett">Cburnett</External>, diadaptasi sebagai komponen SVG.</p>
              </AttributionCard>

              <AttributionCard id="suara" number="05" title="Suara papan" resources={
                <p><Local href="licenses/lichess-AGPL-3.0.txt">Lisensi AGPL-3.0</Local></p>
              }>
                <p>Suara dari set standar <External href="https://github.com/lichess-org/lila/tree/master/public/sound/standard">Lichess</External>, AGPL-3.0. Beberapa nama berkas menggunakan suara yang sama.</p>
              </AttributionCard>

              <AttributionCard id="pembukaan" number="06" title="Buku pembukaan" resources={
                <p><Local href="licenses/chess-openings-CC0.txt">Lisensi CC0</Local></p>
              }>
                <p>Tabel pembukaan ChessClub diolah dari <External href="https://github.com/lichess-org/chess-openings">lichess-org/chess-openings</External>, CC0 1.0.</p>
              </AttributionCard>
            </div>
          </section>

          <section id="sumber-stockfish" aria-labelledby="judul-sumber-stockfish" className="mt-12 scroll-mt-6 border-t border-[#dedfde] pt-8 sm:mt-16">
            <h2 id="judul-sumber-stockfish" className="text-2xl font-bold tracking-tight">Kode sumber dan jaringan NNUE</h2>
            <div className="mt-6 grid gap-7 text-base leading-7 text-[#343b35] md:grid-cols-2 md:gap-10">
              <div>
                <h3 className="font-semibold text-[#202421]">Kode sumber Stockfish</h3>
                <p className="mt-2"><Local href="engine/source/stockfish.js-efc5758a1cf72ec7644fa771a1f17fcbfdae410e-no-networks.tar.gz">16</Local> · <Local href="engine/source/stockfish.js-215df8c6a72847e306644d399733de18fb8e0d6c-source-only.tar.gz">16.1</Local> · <Local href="engine/source/stockfish.js-602fd7e1a571a2be71f242942db90483731f2a1f-source-only.tar.gz">17.1</Local> · <Local href="engine/source/stockfish.js-082eeba46b0c5f8f8065e5386750aa0ecfa2062c.tar.gz">18</Local> · <Local href="engine/source/stockfish.js-93c994592dcf3b4b21052ab925e9b534df9c0918.tar.gz">18 (JS 18.0.8)</Local> · <Local href="engine/source/stockfish.js-0d5dd7944f88c817c07a26bc4fb1905d5f9c46d6.tar.gz">19</Local></p>
              </div>
              <div>
                <h3 className="font-semibold text-[#202421]">Jaringan NNUE</h3>
                <p className="mt-2"><Local href="engine/nn-5af11540bbfe.nnue">16</Local> · <Local href="engine/source/nn-9067e33176e8.nnue">Lite 16.1–18</Local> · <Local href="engine/source/nn-61e7af4bb97d.nnue">Lite 19</Local>.</p>
                <p className="mt-3">Salin jaringan yang sesuai ke direktori <code>src/</code> sumber jika membangun ulang engine.</p>
              </div>
            </div>
          </section>

          <footer className="mt-12 border-t border-[#dedfde] pt-8 sm:mt-16">
            <h2 className="text-lg font-bold">Catatan merek</h2>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-[#545d55]">
              Nama dan logo Chess.com serta Lichess merupakan merek pemiliknya masing-masing dan hanya digunakan untuk menunjukkan layanan yang didukung.
            </p>
          </footer>
        </article>
      </div>
    </main>
  );
}

function AttributionCard({ id, number, title, children, resources }: {
  id: string;
  number: string;
  title: string;
  children: React.ReactNode;
  resources: React.ReactNode;
}) {
  const titleId = `judul-${id}`;
  return (
    <article id={id} aria-labelledby={titleId} className="flex min-w-0 scroll-mt-6 flex-col rounded-lg border border-[#dedfde] bg-white p-6">
      <span aria-hidden="true" className="text-sm font-medium text-[#697169]">{number}</span>
      <h2 id={titleId} className="mt-4 text-[22px] font-bold leading-7 tracking-tight text-[#202421]">{title}</h2>
      <div className="mt-4 space-y-3 text-[15px] leading-6 text-[#343b35] sm:text-base sm:leading-7">{children}</div>
      <div className="mt-auto pt-6">
        <div className="border-t border-[#e2e4e2] pt-4 text-sm leading-6">{resources}</div>
      </div>
    </article>
  );
}

function External({ href, children }: { href: string; children: React.ReactNode }) {
  return <a href={href} target="_blank" rel="noopener noreferrer" className={linkStyle}>{children}<span aria-hidden="true" className="ml-0.5">↗</span><span className="sr-only"> (terbuka di tab baru)</span></a>;
}

function Local({ href, children }: { href: string; children: React.ReactNode }) {
  // Version numbers alone would be ambiguous in a screen reader's link list.
  const label = typeof children !== "string" ? undefined
    : href.endsWith(".tar.gz") ? `Kode sumber Stockfish ${children}`
      : href.endsWith(".nnue") ? `Jaringan NNUE ${children}`
        : undefined;
  return <a href={file(href)} aria-label={label} className={linkStyle}>{children}</a>;
}
