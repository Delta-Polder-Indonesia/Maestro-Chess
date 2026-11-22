import type { Metadata } from "next";
import "@fontsource-variable/geist";
import "./globals.css";

export const metadata: Metadata = {
  title: "Maestro Chess — Analisa Catur",
  description: "Analisis PGN dan FEN dengan Stockfish lokal, laporan langkah, grafik evaluasi, dan basis data partai di peramban.",
  keywords: ["catur", "analisa catur", "chess analysis", "Stockfish", "PGN", "FEN", "Maestro Chess"],
  authors: [{ name: "Delta-Polder-Indonesia", url: "https://github.com/Delta-Polder-Indonesia" }],
  applicationName: "Maestro Chess",
  icons: { icon: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/favicon.ico` },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body className="flex h-screen w-full flex-col overflow-hidden font-sans">{children}</body>
    </html>
  );
}
