"use client";

import dynamic from "next/dynamic";

// ChessClub's analysis workspace uses browser-only APIs, storage and workers.
// Keep it client-side while Next still exports the surrounding static shell.
const Analisa = dynamic(() => import("../halaman/Analisa/Analisa.jsx"), {
  ssr: false,
  loading: () => <main className="flex h-screen w-full items-center justify-center bg-background text-foreground">Memuat Maestro Chess…</main>,
});

export default function Home() {
  return <Analisa />;
}
