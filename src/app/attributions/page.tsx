import Link from "next/link";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const file = (path: string) => `${basePath}/${path}`;

const external = "font-semibold text-[#a9d978] underline underline-offset-2 hover:text-white";

export default function Attributions() {
  return (
    <main className="h-full w-full overflow-y-auto bg-[#121212] px-5 py-6 text-foreground sm:px-8 sm:py-10">
      <div className="mx-auto max-w-5xl">
        <Link href="/" className="text-sm font-bold text-[#a9d978] hover:text-white">← Kembali ke Maestro Chess</Link>
        <header className="mb-8 mt-6">
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-[#a9d978]">Maestro Chess</p>
          <h1 className="text-3xl font-extrabold sm:text-4xl">Atribusi & lisensi</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-foregroundGrey">
            Terima kasih kepada pembuat perangkat lunak dan aset yang digunakan dalam aplikasi analisa mandiri ini.
            Setiap komponen tetap mengikuti lisensinya masing-masing.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Section title="Antarmuka & analisis">
            <p>Diadaptasi dari <External href="https://github.com/Delta-Polder-Indonesia/ChessClub">ChessClub</External> (MIT, © 2025–2026 Delta-Polder-Indonesia), yang mengadaptasi <External href="https://github.com/wdeloo/Brilliant-Chess">Brilliant-Chess</External> (MIT, © 2025 Delo). Sebagian komponen juga diadaptasi dari <External href="https://github.com/SheyBoiCarti/ChessGameReviewer">ChessGameReviewer</External> (MIT, © 2026 Chess Game Reviewer contributors).</p>
            <p><Local href="licenses/chessclub-MIT.txt">Lisensi ChessClub</Local> · <Local href="licenses/brilliant-chess-MIT.txt">Brilliant-Chess</Local> · <Local href="licenses/chess-game-reviewer-MIT.txt">ChessGameReviewer</Local></p>
          </Section>

          <Section title="Stockfish 18 Lite">
            <p>Mesin Stockfish dan distribusi <External href="https://github.com/nmrugg/stockfish.js">stockfish.js</External> dilisensikan GPL-3.0. Build Lite satu utas berjalan lokal di peramban.</p>
            <p><Local href="engine/source/COPYING.txt">Lisensi GPL-3.0</Local> · <Local href="engine/source/AUTHORS.txt">Penulis</Local> · <Local href="engine/source/stockfish.js-082eeba46b0c5f8f8065e5386750aa0ecfa2062c.tar.gz">Kode sumber</Local> · <Local href="engine/source/nn-9067e33176e8.nnue">Jaringan NNUE</Local></p>
          </Section>

          <Section title="Bidak catur">
            <p>Desain bidak oleh <External href="https://en.wikipedia.org/wiki/User:Cburnett">Cburnett</External>, diadaptasi sebagai komponen SVG. Lisensi <External href="https://creativecommons.org/licenses/by-sa/3.0/">CC BY-SA 3.0</External>.</p>
          </Section>

          <Section title="Suara papan">
            <p>Suara dari set standar <External href="https://github.com/lichess-org/lila/tree/master/public/sound/standard">Lichess</External>, AGPL-3.0. Beberapa nama berkas menggunakan suara yang sama.</p>
            <p><Local href="licenses/lichess-AGPL-3.0.txt">Lisensi AGPL-3.0</Local></p>
          </Section>

          <Section title="Buku pembukaan">
            <p>Tabel pembukaan ChessClub diolah dari <External href="https://github.com/lichess-org/chess-openings">lichess-org/chess-openings</External>, CC0 1.0.</p>
            <p><Local href="licenses/chess-openings-CC0.txt">Lisensi CC0</Local></p>
          </Section>

          <Section title="Bendera & huruf">
            <p>Bendera dari <External href="https://github.com/lipis/flag-icons">flag-icons</External> (MIT, © 2013 Panayiotis Lipiridis). Huruf Geist Variable oleh <External href="https://github.com/vercel/geist-font">The Geist Project Authors</External> (SIL OFL 1.1).</p>
            <p><Local href="licenses/flag-icons-MIT.txt">Lisensi bendera</Local> · <Local href="licenses/geist-OFL-1.1.txt">Lisensi huruf</Local></p>
          </Section>
        </div>

        <p className="mb-4 mt-8 text-xs leading-5 text-foregroundGrey">
          Nama dan logo Chess.com serta Lichess merupakan merek pemiliknya masing-masing dan hanya digunakan untuk menunjukkan layanan yang didukung.
        </p>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-borderRoundness border border-border bg-[#202020] p-5 text-sm leading-6">
      <h2 className="text-lg font-bold text-foreground">{title}</h2>
      {children}
    </section>
  );
}

function External({ href, children }: { href: string; children: React.ReactNode }) {
  return <a href={href} target="_blank" rel="noreferrer" className={external}>{children}</a>;
}

function Local({ href, children }: { href: string; children: React.ReactNode }) {
  return <a href={file(href)} className={external}>{children}</a>;
}
