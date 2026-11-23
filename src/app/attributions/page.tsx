import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Atribusi & lisensi — Maestro Chess",
  description: "Atribusi, lisensi, dan kode sumber perangkat lunak serta aset yang digunakan Maestro Chess.",
};

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const file = (path: string) => `${basePath}/${path}`;
const linkStyle = "font-medium text-backgroundBoxBoxHighlighted underline underline-offset-[3px] hover:text-backgroundBoxBoxHighlightedHover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-backgroundBoxBoxHighlighted";
const focusStyle = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-backgroundBoxBoxHighlighted";

const pageLinks = [
  ["#daftar-atribusi", "Komponen"],
  ["#sumber-stockfish", "Sumber & NNUE"],
  ["#catatan-merek", "Merek"],
];

export default function Attributions() {
  // The root layout locks the body; anchoring this scroll area prevents fragment
  // navigation from scrolling the hidden body as well as the page content.
  return (
    <main className="fixed inset-0 overflow-x-hidden overflow-y-auto bg-background text-foreground">
      <a href="#konten-atribusi" className={`sr-only z-50 rounded-[4px] bg-backgroundBoxDarker px-4 py-2 font-semibold text-foreground outline outline-2 outline-backgroundBoxBoxHighlighted focus:not-sr-only focus:absolute focus:left-4 focus:top-4 ${focusStyle}`}>
        Lewati ke isi
      </a>

      <div className="mx-auto max-w-[1440px] px-5 pb-20 pt-7 sm:px-10 lg:px-[8%]">
        <nav aria-label="Jejak navigasi">
          <ol className="flex flex-wrap items-center gap-3 text-sm leading-6">
            <li><Link href="/" className={`font-medium text-foregroundGrey underline underline-offset-4 hover:text-backgroundBoxBoxHighlighted ${focusStyle}`}>Beranda</Link></li>
            <li aria-hidden="true" className="text-foregroundGrey">›</li>
            <li aria-current="page" className="font-medium text-foreground">Atribusi & lisensi</li>
          </ol>
        </nav>

        <article id="konten-atribusi" tabIndex={-1} className="outline-none">
          <header className="mx-auto max-w-5xl pt-12 text-center sm:pt-16 lg:pt-20">
            <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
              Atribusi & lisensi
            </h1>
            <p className="mx-auto mt-4 max-w-3xl text-sm leading-7 text-foregroundGrey sm:text-base">
              Terima kasih kepada pembuat perangkat lunak dan aset yang digunakan dalam aplikasi analisa mandiri ini.
              Setiap komponen tetap mengikuti lisensinya masing-masing.
            </p>
            <nav aria-label="Bagian halaman" className="mt-6">
              <ul className="flex flex-wrap justify-center gap-x-6 gap-y-3 text-sm font-medium">
                {pageLinks.map(([href, label]) => (
                  <li key={href}><a href={href} className={`text-backgroundBoxBoxHighlighted underline underline-offset-4 hover:text-backgroundBoxBoxHighlightedHover ${focusStyle}`}>{label}</a></li>
                ))}
              </ul>
            </nav>
          </header>

          <section id="daftar-atribusi" aria-label="Daftar komponen dan aset" className="mt-12 scroll-mt-8 sm:mt-16 lg:mt-20">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">
              <AttributionCard id="antarmuka" number="01" title="Antarmuka & analisis" featured resources={
                <ul className="space-y-2">
                  <li><Local href="licenses/chessclub-MIT.txt">Lisensi ChessClub</Local></li>
                  <li><Local href="licenses/brilliant-chess-MIT.txt">Lisensi Brilliant-Chess</Local></li>
                  <li><Local href="licenses/chess-game-reviewer-MIT.txt">Lisensi ChessGameReviewer</Local></li>
                </ul>
              }>
                <p>Diadaptasi dari <External href="https://github.com/Delta-Polder-Indonesia/ChessClub">ChessClub</External> (MIT, © 2025–2026 Delta-Polder-Indonesia), yang mengadaptasi <External href="https://github.com/wdeloo/Brilliant-Chess">Brilliant-Chess</External> (MIT, © 2025 Delo). Sebagian komponen juga diadaptasi dari <External href="https://github.com/SheyBoiCarti/ChessGameReviewer">ChessGameReviewer</External> (MIT, © 2026 Chess Game Reviewer contributors).</p>
              </AttributionCard>

              <AttributionCard id="stockfish" number="02" title="Engine Stockfish" featured resources={
                <ul className="space-y-2">
                  <li><Local href="engine/source/COPYING.txt">Lisensi GPL-3.0</Local></li>
                  <li><Local href="engine/source/AUTHORS.txt">Penulis Stockfish</Local></li>
                  <li><a href="#sumber-stockfish" className={linkStyle}>Kode sumber dan jaringan NNUE</a></li>
                </ul>
              }>
                <p>Mesin Stockfish dan distribusi <External href="https://github.com/nmrugg/stockfish.js">stockfish.js</External> dilisensikan GPL-3.0. Semua pilihan memakai satu utas dan berjalan lokal di peramban. Stockfish 18 Lite (JS 18.0.8) memakai WASM yang sama dengan Stockfish 18 Lite bawaan, dengan pemuat JavaScript berbeda.</p>
              </AttributionCard>
            </div>

            <h2 className="mt-16 text-center text-2xl font-bold tracking-tight sm:mt-20 sm:text-3xl">Komponen & aset lainnya</h2>
            <div className="mt-8 grid gap-5 sm:mt-10">
              <AttributionCard id="bendera" number="03" title="Bendera & huruf" resources={
                <ul className="space-y-1">
                  <li><Local href="licenses/flag-icons-MIT.txt">Lisensi bendera</Local></li>
                  <li><Local href="licenses/geist-OFL-1.1.txt">Lisensi huruf Geist</Local></li>
                  <li><Local href="licenses/montserrat-OFL-1.1.txt">Lisensi huruf Montserrat</Local></li>
                </ul>
              }>
                <p>Bendera dari <External href="https://github.com/lipis/flag-icons">flag-icons</External> (MIT, © 2013 Panayiotis Lipiridis). Huruf Geist Variable oleh <External href="https://github.com/vercel/geist-font">The Geist Project Authors</External> (SIL OFL 1.1). Montserrat Variable dalam paket proyek oleh <External href="https://github.com/JulietaUla/Montserrat">The Montserrat Project Authors</External> (© 2011, SIL OFL 1.1).</p>
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

          <section id="sumber-stockfish" aria-labelledby="judul-sumber-stockfish" className="mt-16 scroll-mt-8 sm:mt-20">
            <h2 id="judul-sumber-stockfish" className="text-center text-2xl font-bold tracking-tight sm:text-3xl">Kode sumber dan jaringan NNUE</h2>
            <div className="mt-8 grid gap-8 rounded-[6px] border-2 border-border bg-backgroundBox p-5 text-sm leading-7 sm:p-6 sm:text-base md:grid-cols-2 md:gap-12">
              <div>
                <h3 className="text-base font-bold sm:text-lg">Kode sumber Stockfish</h3>
                <p className="mt-3"><Local href="engine/source/stockfish.js-efc5758a1cf72ec7644fa771a1f17fcbfdae410e-no-networks.tar.gz">16</Local> · <Local href="engine/source/stockfish.js-215df8c6a72847e306644d399733de18fb8e0d6c-source-only.tar.gz">16.1</Local> · <Local href="engine/source/stockfish.js-602fd7e1a571a2be71f242942db90483731f2a1f-source-only.tar.gz">17.1</Local> · <Local href="engine/source/stockfish.js-082eeba46b0c5f8f8065e5386750aa0ecfa2062c.tar.gz">18</Local> · <Local href="engine/source/stockfish.js-93c994592dcf3b4b21052ab925e9b534df9c0918.tar.gz">18 (JS 18.0.8)</Local> · <Local href="engine/source/stockfish.js-0d5dd7944f88c817c07a26bc4fb1905d5f9c46d6.tar.gz">19</Local></p>
              </div>
              <div>
                <h3 className="text-base font-bold sm:text-lg">Jaringan NNUE</h3>
                <p className="mt-3"><Local href="engine/nn-5af11540bbfe.nnue">16</Local> · <Local href="engine/source/nn-9067e33176e8.nnue">Lite 16.1–18</Local> · <Local href="engine/source/nn-61e7af4bb97d.nnue">Lite 19</Local>.</p>
                <p className="mt-3">Salin jaringan yang sesuai ke direktori <code>src/</code> sumber jika membangun ulang engine.</p>
              </div>
            </div>
          </section>

          <footer id="catatan-merek" className="mt-16 scroll-mt-8 border-t border-border pt-8 sm:mt-20">
            <h2 className="text-lg font-bold">Catatan merek</h2>
            <p className="mt-3 max-w-4xl text-sm leading-7 text-foregroundGrey">
              Nama dan logo Chess.com serta Lichess merupakan merek pemiliknya masing-masing dan hanya digunakan untuk menunjukkan layanan yang didukung.
            </p>
            <p className="mt-4 text-sm leading-7 text-foregroundGrey">
              Referensi tampilan: <External href="https://github.com/codebucks27/Next.js-Developer-Portfolio-Starter-Code">Next.js Developer Portfolio oleh CodeBucks</External>.
            </p>
          </footer>
        </article>

        <footer className="mt-16 border-t border-border pt-10 sm:mt-20">
          <section aria-labelledby="judul-footer-pembaruan" className="relative overflow-hidden rounded-[6px] border-2 border-border bg-backgroundBox p-6 sm:p-10">
            <div className="relative w-full max-w-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-backgroundBoxBoxHighlighted">Pembaruan proyek</p>
              <h2 id="judul-footer-pembaruan" className="mt-2 text-xl font-bold text-foreground sm:text-2xl">Tetap terhubung</h2>
              <p className="mt-2 text-sm text-foregroundGrey">
                Ikuti perkembangan aplikasi dan mesin Stockfish lewat kode sumber terbuka. Tanpa langganan email.
              </p>
              <div className="mt-5 flex flex-wrap gap-x-6 gap-y-3 text-sm font-medium">
                <a href="#daftar-atribusi" className={linkStyle}>Lihat atribusi</a>
                <External href="https://github.com/Delta-Polder-Indonesia/Maestro-Chess">Kode sumber proyek</External>
              </div>
            </div>
          </section>

          <div className="mt-10 grid gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] md:gap-16">
            <div>
              <p className="text-lg font-bold">Maestro Chess</p>
              <p className="mt-3 max-w-sm text-sm leading-7 text-foregroundGrey">
                Analisa PGN dan FEN dengan Stockfish lokal, sepenuhnya berjalan di peramban.
              </p>
              <p className="mt-5 text-sm text-foregroundGrey">
                Dikembangkan oleh <External href="https://github.com/Delta-Polder-Indonesia/ChessClub">Delta-Polder-Indonesia</External>.
              </p>
            </div>
            <nav aria-label="Tautan footer" className="grid gap-6 sm:grid-cols-3">
              <FooterGroup judul="Proyek">
                <li><a href="#konten-atribusi" className={linkStyle}>Ringkasan halaman</a></li>
                <li><a href="#daftar-atribusi" className={linkStyle}>Komponen & aset</a></li>
                <li><External href="https://github.com/Delta-Polder-Indonesia/Maestro-Chess">Kode sumber</External></li>
              </FooterGroup>
              <FooterGroup judul="Sumber">
                <li><a href="#sumber-stockfish" className={linkStyle}>Kode sumber Stockfish</a></li>
                <li><a href="#sumber-stockfish" className={linkStyle}>Jaringan NNUE</a></li>
                <li><External href="https://github.com/Delta-Polder-Indonesia/ChessClub">ChessClub</External></li>
              </FooterGroup>
              <FooterGroup judul="Dukungan">
                <li><a href="#catatan-merek" className={linkStyle}>Catatan merek</a></li>
                <li><Local href="licenses/chessclub-MIT.txt">Lisensi MIT</Local></li>
                <li><Local href="licenses/lichess-AGPL-3.0.txt">Lisensi AGPL-3.0</Local></li>
              </FooterGroup>
            </nav>
          </div>

          <div className="mt-10 flex flex-col gap-4 border-t border-border pt-6 text-sm leading-6 text-foregroundGrey sm:flex-row sm:items-center sm:justify-between">
            <p>© 2026 Delta-Polder-Indonesia. Setiap komponen tetap mengikuti lisensinya masing-masing.</p>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <Local href="licenses/geist-OFL-1.1.txt">Lisensi Geist</Local>
              <Local href="licenses/montserrat-OFL-1.1.txt">Lisensi Montserrat</Local>
              <a href="#konten-atribusi" className={linkStyle}>Kembali ke atas</a>
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}

function AttributionCard({ id, number, title, children, resources, featured = false }: {
  id: string;
  number: string;
  title: string;
  children: React.ReactNode;
  resources: React.ReactNode;
  featured?: boolean;
}) {
  const titleId = `judul-${id}`;
  const Heading = featured ? "h2" : "h3";
  return (
    <article id={id} aria-labelledby={titleId} className={featured
      ? "flex min-w-0 scroll-mt-8 flex-col rounded-[6px] border-2 border-border bg-backgroundBox p-5 sm:p-6"
      : "grid min-w-0 scroll-mt-8 gap-4 rounded-[6px] border-2 border-border bg-backgroundBox p-4 sm:p-5 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.6fr)] md:gap-8"}>
      <div>
        <span aria-hidden="true" className="text-sm font-semibold text-backgroundBoxBoxHighlighted">{number}</span>
        <Heading id={titleId} className={featured ? "mt-3 text-xl font-bold leading-tight sm:text-2xl" : "mt-2 text-lg font-bold leading-snug"}>{title}</Heading>
      </div>
      <div className={featured ? "mt-4 flex flex-1 flex-col" : "min-w-0"}>
        <div className="space-y-3 text-sm leading-7 sm:text-base">{children}</div>
        <div className={featured ? "mt-auto pt-6" : "mt-4"}>
          <div className={featured ? "border-t border-border pt-4 text-sm leading-6" : "text-sm leading-6"}>{resources}</div>
        </div>
      </div>
    </article>
  );
}

function FooterGroup({ judul, children }: { judul: string; children: React.ReactNode }) {
  return (
    <details open className="group rounded-[6px] border border-border bg-backgroundBox px-4 py-3 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
      <summary className={`flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-foreground marker:hidden ${focusStyle}`}>
        {judul}
        <span aria-hidden="true" className="text-foregroundGrey transition-transform group-open:rotate-180 sm:hidden">▾</span>
      </summary>
      <ul role="list" className="mt-4 space-y-2 text-sm leading-6">{children}</ul>
    </details>
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
