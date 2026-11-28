/**
 * Papan catur interaktif teka-teki — diadopsi dari ChessClub
 * (`src/halaman/TekaTeki/PapanTekaTeki.jsx`), ditulis ulang untuk repo ini dan
 * disambungkan ke aset Maestro (PieceSVG, boardThemes, urlBidak, animasiBidak).
 *
 * Perilaku drag/klik ala chess.com (sumber acuan persis, bukan tebakan):
 *  - Klik bidak → klik petak tujuan (titik langkah sah); klik ulang = batal pilih.
 *  - Seret bidak: "bidak hantu" mengikuti kursor lewat transform DOM langsung
 *    (tanpa re-render → tanpa lag), `setPointerCapture` pada akar papan, slop
 *    5px untuk membedakan klik dari seret, `select-none` + preventDefault non-sentuh.
 *  - Klik kanan saat menyeret = batalkan (bidak kembali ke asal).
 *  - Klik kanan petak = tanda petak; seret klik kanan = panah (Shift/Ctrl/Alt →
 *    merah/hijau/biru); klik kiri = hapus semua tanda.
 *  - Luncuran bidak saat FEN berganti (Web Animations API, GESER_ISEPIC).
 *
 * Induk memiliki `terpilih`/`sasaran`; papan hanya melaporkan peristiwa.
 */
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import PieceSVG from "../../Analisa/komponen/svg/piece.jsx";
import { urlBidak } from "../../Analisa/komponen/pengaturan/setBidak.js";
import { boardThemes } from "../../../modul/sesi/preferensi.js";
import { GESER_ISEPIC, geseranDenganAsalEksplisit, petaBidak } from "../animasiBidak.js";
import { useI18n } from "../../../lib/i18n.jsx";

const FILE = ["a", "b", "c", "d", "e", "f", "g", "h"];

/* Kontras koordinat: warna lawan dipakai bila lolos AA, else hitam/putih penuh. */
const luminansiRelatif = (hex) => {
  const kanal = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = kanal.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const rasioKontras = (a, b) => {
  const la = luminansiRelatif(a);
  const lb = luminansiRelatif(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};
const warnaTeksKoordinat = (warnaLatar, warnaLawan) => {
  const kandidat = [warnaLawan, "#000000", "#ffffff"];
  const lolos = kandidat.find((w) => rasioKontras(w, warnaLatar) >= 4.5);
  if (lolos) return lolos;
  return rasioKontras("#000000", warnaLatar) >= rasioKontras("#ffffff", warnaLatar) ? "#000000" : "#ffffff";
};

const WARNA_PANAH = {
  bawaan: "rgba(255, 170, 0, 0.8)",
  merah: "rgba(216, 60, 60, 0.8)",
  hijau: "rgba(0, 150, 80, 0.8)",
  biru: "rgba(60, 90, 216, 0.8)",
};
const WARNA_PETAK = {
  bawaan: "rgba(255, 255, 0, 0.5)",
  merah: "rgba(216, 60, 60, 0.5)",
  hijau: "rgba(0, 150, 80, 0.5)",
  biru: "rgba(60, 90, 216, 0.5)",
};
function warnaDariPeristiwa(e) {
  if (e.shiftKey) return "merah";
  if (e.ctrlKey || e.metaKey) return "hijau";
  if (e.altKey) return "biru";
  return "bawaan";
}

/** 64 petak dalam urutan tampilan: orientasi "w" = putih di bawah. */
function daftarPetak(orientasi) {
  const petak = [];
  const baris = orientasi === "w" ? ["8", "7", "6", "5", "4", "3", "2", "1"] : ["1", "2", "3", "4", "5", "6", "7", "8"];
  for (const b of baris) {
    const lajur = orientasi === "w" ? FILE : [...FILE].reverse();
    for (const l of lajur) petak.push(l + b);
  }
  return petak;
}
function pusatPetak(petak, orientasi) {
  const kolom = FILE.indexOf(petak[0]);
  const baris = Number(petak[1]);
  const kolomLayar = orientasi === "w" ? kolom : 7 - kolom;
  return { x: (kolomLayar + 0.5) * 12.5, y: (orientasi === "w" ? 8 - baris + 0.5 : baris - 0.5) * 12.5 };
}
function langkahKotak(from, to) {
  return { dx: FILE.indexOf(to[0]) - FILE.indexOf(from[0]), dy: Number(to[1]) - Number(from[1]) };
}

/* Geometri panah — direkayasa-balik dari SVG chess.com (lihat ChessClub). */
const SETENGAH_BATANG = 1.375;
const SETENGAH_KEPALA = 3.25;
const JARAK_AWAL = 4.5;
function titikPanahLurus(s, t) {
  const dx = t.x - s.x;
  const dy = t.y - s.y;
  const L = Math.hypot(dx, dy) || 1;
  const u = { x: dx / L, y: dy / L };
  const n = { x: -u.y, y: u.x };
  const p = (depan, samping) => ({ x: s.x + u.x * depan + n.x * samping, y: s.y + u.y * depan + n.y * samping });
  return [
    p(JARAK_AWAL, -SETENGAH_BATANG), p(L - JARAK_AWAL, -SETENGAH_BATANG), p(L - JARAK_AWAL, -SETENGAH_KEPALA),
    p(L, 0), p(L - JARAK_AWAL, SETENGAH_KEPALA), p(L - JARAK_AWAL, SETENGAH_BATANG), p(JARAK_AWAL, SETENGAH_BATANG),
  ];
}
function titikPanahKuda(s, t) {
  const dx = t.x - s.x;
  const dy = t.y - s.y;
  let u1, u2, L1, L2;
  if (Math.abs(dy) >= Math.abs(dx)) {
    u1 = { x: 0, y: Math.sign(dy) || 1 }; u2 = { x: Math.sign(dx) || 1, y: 0 }; L1 = Math.abs(dy); L2 = Math.abs(dx);
  } else {
    u1 = { x: Math.sign(dx) || 1, y: 0 }; u2 = { x: 0, y: Math.sign(dy) || 1 }; L1 = Math.abs(dx); L2 = Math.abs(dy);
  }
  const p = (x, y) => ({ x: s.x + u2.x * x + u1.x * y, y: s.y + u2.y * x + u1.y * y });
  return [
    p(-SETENGAH_BATANG, JARAK_AWAL), p(-SETENGAH_BATANG, L1 + SETENGAH_BATANG), p(L2 - JARAK_AWAL, L1 + SETENGAH_BATANG),
    p(L2 - JARAK_AWAL, L1 + SETENGAH_KEPALA), p(L2, L1), p(L2 - JARAK_AWAL, L1 - SETENGAH_KEPALA),
    p(L2 - JARAK_AWAL, L1 - SETENGAH_BATANG), p(SETENGAH_BATANG, L1 - SETENGAH_BATANG), p(SETENGAH_BATANG, JARAK_AWAL),
  ];
}
function titikPanah(from, to, orientasi) {
  const s = pusatPetak(from, orientasi);
  const t = pusatPetak(to, orientasi);
  const { dx, dy } = langkahKotak(from, to);
  const kuda = (Math.abs(dx) === 1 && Math.abs(dy) === 2) || (Math.abs(dx) === 2 && Math.abs(dy) === 1);
  return kuda ? titikPanahKuda(s, t) : titikPanahLurus(s, t);
}
function titikKePoints(titik) {
  return titik.map((p) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`).join(" ");
}

/** Adapter bidak: karakter FEN → PieceSVG Maestro (tipe + warna, ukuran responsif). */
function BidakPapan({ kode, set }) {
  const putih = kode === kode.toUpperCase();
  return <PieceSVG piece={kode.toLowerCase()} color={putih ? "w" : "b"} size="100%" set={set} className="h-full w-full" />;
}

const Petak = memo(function Petak({
  sq, baris, kolom, bidak, bisaSeret, dipilih, jadiSasaran, jadiTangkap, jadiPetunjuk,
  jadiSalah, jadiAkhir, sedangDiseret, warnaMark, warnaPapan, setBidak, tampilKoordinat, onTekan, onKlik,
}) {
  const { t } = useI18n();
  const terang = (baris + kolom) % 2 === 0;
  const tampilLajur = tampilKoordinat === "semua" || (tampilKoordinat === "tepi" && baris === 7);
  const tampilBaris = tampilKoordinat === "semua" || (tampilKoordinat === "tepi" && kolom === 0);
  return (
    <button
      type="button"
      data-petak={sq}
      aria-label={t(bidak ? "tekaTeki.ariaPetakBidak" : "tekaTeki.ariaPetakKosong", {
        sq,
        bidak: bidak ? t(`tekaTeki.namaBidak.${bidak.toLowerCase()}`) : "",
        warna: bidak ? t(bidak === bidak.toUpperCase() ? "tekaTeki.warnaPutih" : "tekaTeki.warnaHitam") : "",
      })}
      onPointerDown={(e) => onTekan(e, sq)}
      onClick={() => onKlik(sq)}
      style={{ backgroundColor: terang ? warnaPapan.terang : warnaPapan.gelap, touchAction: bisaSeret ? "none" : undefined }}
      className={`relative flex items-center justify-center border-0 p-0 outline-none focus-visible:z-20 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-500 ${bisaSeret ? "cursor-grab" : ""}`}
    >
      {jadiAkhir && <span className="pointer-events-none absolute inset-0" style={{ backgroundColor: "rgba(205, 210, 106, 0.5)" }} aria-hidden="true" />}
      {jadiPetunjuk && <span className="pointer-events-none absolute inset-0" style={{ backgroundColor: "rgba(0, 150, 80, 0.5)" }} aria-hidden="true" />}
      {jadiSalah && <span className="pointer-events-none absolute inset-0" style={{ backgroundColor: "rgba(216, 60, 60, 0.55)" }} aria-hidden="true" />}
      {dipilih && <span data-bantu-pilih="1" className="pointer-events-none absolute inset-0" style={{ backgroundColor: "rgba(255, 255, 0, 0.45)" }} aria-hidden="true" />}
      {warnaMark && <span data-tanda-petak={warnaMark} className="pointer-events-none absolute inset-0" style={{ backgroundColor: WARNA_PETAK[warnaMark] }} aria-hidden="true" />}
      {tampilLajur && (
        <span className="pointer-events-none absolute bottom-0.5 right-1 text-[9px] md:text-[10px] font-bold leading-none" style={{ color: terang ? warnaPapan.teksTerang : warnaPapan.teksGelap }}>{sq[0]}</span>
      )}
      {tampilBaris && (
        <span className="pointer-events-none absolute top-0.5 left-1 text-[9px] md:text-[10px] font-bold leading-none" style={{ color: terang ? warnaPapan.teksTerang : warnaPapan.teksGelap }}>{sq[1]}</span>
      )}
      {bidak && !sedangDiseret && (
        <span data-bidak={bidak} className="relative z-10 flex h-[88%] w-[88%] items-center justify-center drop-shadow pointer-events-none">
          <BidakPapan kode={bidak} set={setBidak} />
        </span>
      )}
      {jadiSasaran && !bidak && !jadiTangkap && (
        <span data-bantu-sasaran="1" className="pointer-events-none absolute z-10 h-[30%] w-[30%] rounded-full bg-black/15" aria-hidden="true" />
      )}
      {jadiSasaran && (bidak || jadiTangkap) && (
        <span data-bantu-sasaran="1" data-tangkap={jadiTangkap ? "1" : undefined} className="pointer-events-none absolute inset-[3%] z-10 rounded-full border-4 border-black/30" aria-hidden="true" />
      )}
    </button>
  );
});

export default function PapanInteraktif({
  fen,
  orientasi = "w",
  terpilih = null,
  sasaran = [],
  sasaranTangkap = [],
  petunjuk = null,
  kesalahan = null,
  langkahAkhir = null,
  tanda = { panah: [], petak: {} },
  terkunci = false,
  membeku = false,
  setBidak = "cburnett",
  tema = 0,
  tampilKoordinat = "tepi",
  tampilTitikLangkah = true,
  sorotLangkahAkhir = true,
  animasi = true,
  onKlik,
  onPilih,
  onJatuh,
  onMulaiSeret,
  onSelesaiSeret,
  onBatalSeret,
  onTandaPetak,
  onTandaPanah,
  onHapusTanda,
}) {
  const peta = petaBidak(fen);
  const petak = daftarPetak(orientasi);
  const giliran = fen.split(" ")[1] || "w";

  const akar = useRef(null);
  const geometri = useRef({ kiri: 0, atas: 0, kotak: 0 });
  const seretRef = useRef(null); // { dari, x0, y0, pindah, terpilihSebelumnya, pointerId }
  const [seret, setSeret] = useState(null); // { from } → bidak hantu terpasang
  const hantuRef = useRef(null);
  const posisiTertahanRef = useRef(null);
  const abaikanKlikRef = useRef(false);
  const baruBatalRef = useRef(false);
  const onBatalSeretRef = useRef(onBatalSeret);
  onBatalSeretRef.current = onBatalSeret;
  const batalkanSeretRef = useRef(() => {});
  const padaTekanRef = useRef(null);
  const onTekanPetak = useCallback((e, sq) => padaTekanRef.current(e, sq), []);
  const padaKlikPetakRef = useRef(null);
  const onKlikPetak = useCallback((sq) => padaKlikPetakRef.current(sq), []);

  const fenSebelumRef = useRef(fen);
  const orientasiSebelumRef = useRef(orientasi);
  const lewatiGeserRef = useRef(null);
  const animasiJalanRef = useRef(new Map());
  const kananRef = useRef(null);
  const [panahSementara, setPanahSementara] = useState(null);

  function cariPetak(x, y) {
    if (typeof document === "undefined" || typeof document.elementFromPoint !== "function") return null;
    const el = document.elementFromPoint(x, y);
    return el?.closest?.("[data-petak]")?.getAttribute("data-petak") || null;
  }

  function batalkanSeretInternal() {
    if (!seretRef.current) return;
    const id = seretRef.current.pointerId;
    seretRef.current = null;
    kananRef.current = null;
    setSeret(null);
    setPanahSementara(null);
    abaikanKlikRef.current = true;
    baruBatalRef.current = true;
    if (id != null) { try { akar.current?.releasePointerCapture(id); } catch { /* tidak aktif */ } }
    onBatalSeretRef.current?.();
  }
  batalkanSeretRef.current = batalkanSeretInternal;

  // Klik kanan di seluruh dokumen selama seret → batalkan; telan klik "hantu"
  // pasca-seret HANYA di dalam papan (tombol di luar papan tetap bereaksi).
  useEffect(() => {
    function saatKlikKanan(e) {
      if (!seretRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      batalkanSeretRef.current();
    }
    function onPointerDown(e) {
      if (e.button === 2) saatKlikKanan(e);
      else abaikanKlikRef.current = false;
    }
    function onMouseDown(e) { if (e.button === 2) saatKlikKanan(e); }
    function onContextMenu(e) { saatKlikKanan(e); }
    function onPointerMove(e) { if (e.buttons & 2) saatKlikKanan(e); }
    function onClick(e) {
      if (!abaikanKlikRef.current) return;
      abaikanKlikRef.current = false;
      if (!akar.current?.contains?.(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
    }
    function onPointerUp() { if (baruBatalRef.current) baruBatalRef.current = false; }
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("mousedown", onMouseDown, true);
    document.addEventListener("contextmenu", onContextMenu, true);
    document.addEventListener("pointermove", onPointerMove, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("pointerup", onPointerUp, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("mousedown", onMouseDown, true);
      document.removeEventListener("contextmenu", onContextMenu, true);
      document.removeEventListener("pointermove", onPointerMove, true);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("pointerup", onPointerUp, true);
    };
  }, []);

  function bacaGeometri() {
    const rect = akar.current?.getBoundingClientRect();
    if (rect && rect.width > 0) geometri.current = { kiri: rect.left, atas: rect.top, kotak: rect.width / 8 };
    return geometri.current;
  }
  function posisikanHantu(clientX, clientY) {
    posisiTertahanRef.current = { x: clientX, y: clientY };
    const el = hantuRef.current;
    if (!el) return;
    const { kiri, atas, kotak } = geometri.current;
    el.style.transform = `translate3d(${clientX - kiri - kotak / 2}px, ${clientY - atas - kotak / 2}px, 0)`;
  }
  useEffect(() => {
    if (seret && posisiTertahanRef.current) posisikanHantu(posisiTertahanRef.current.x, posisiTertahanRef.current.y);
  }, [seret]);

  /* ------------------------------------------------- animasi geser bidak */
  const sembunyikanBantuPilih = useCallback((sembunyi) => {
    const wadah = akar.current;
    if (!wadah) return;
    for (const el of wadah.querySelectorAll("[data-bantu-pilih], [data-bantu-sasaran]")) el.style.visibility = sembunyi ? "hidden" : "";
  }, []);
  const animasikanBidak = useCallback((el, dx, dy, ghostEl = null) => {
    if (typeof el?.animate !== "function") { ghostEl?.remove?.(); return false; }
    animasiJalanRef.current.get(el)?.cancel?.();
    el.style.zIndex = "20";
    el.style.willChange = "transform";
    const gerak = el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "translate(0px, 0px)" }], { duration: GESER_ISEPIC.durasi, easing: GESER_ISEPIC.kurva });
    animasiJalanRef.current.set(el, gerak);
    const bersih = () => {
      ghostEl?.remove?.();
      if (animasiJalanRef.current.get(el) !== gerak) return;
      animasiJalanRef.current.delete(el);
      el.style.zIndex = "";
      el.style.willChange = "";
      if (animasiJalanRef.current.size === 0) sembunyikanBantuPilih(false);
    };
    gerak.oncancel = bersih;
    if (gerak.finished?.then) gerak.finished.then(bersih).catch(bersih);
    else bersih();
    return true;
  }, [sembunyikanBantuPilih]);
  const buatGhostTertangkap = useCallback((petakTujuanEl, kode) => {
    const sumber = urlBidak(setBidak, kode);
    if (!sumber || typeof document === "undefined") return null;
    const span = document.createElement("span");
    span.setAttribute("data-tertangkap", kode);
    span.setAttribute("aria-hidden", "true");
    span.className = "absolute z-[5] flex h-[88%] w-[88%] items-center justify-center pointer-events-none";
    const img = document.createElement("img");
    img.src = sumber;
    img.className = "h-full w-full";
    img.draggable = false;
    img.alt = "";
    span.appendChild(img);
    petakTujuanEl.appendChild(span);
    return span;
  }, [setBidak]);
  const hentikanSemuaAnimasi = useCallback(() => {
    for (const gerak of [...animasiJalanRef.current.values()]) gerak.cancel?.();
    animasiJalanRef.current.clear();
    sembunyikanBantuPilih(false);
  }, [sembunyikanBantuPilih]);

  useLayoutEffect(() => {
    const fenLama = fenSebelumRef.current;
    const orientasiLama = orientasiSebelumRef.current;
    fenSebelumRef.current = fen;
    orientasiSebelumRef.current = orientasi;
    if (!animasi) return;
    if (orientasiLama !== orientasi) { hentikanSemuaAnimasi(); return; }
    const wadah = akar.current;
    if (!wadah) return;
    const geseran = geseranDenganAsalEksplisit(fenLama, fen, langkahAkhir);
    if (!geseran.length) { if (fenLama !== fen) hentikanSemuaAnimasi(); return; }
    const papanRect = wadah.getBoundingClientRect();
    if (!papanRect.width) return;
    const lewati = lewatiGeserRef.current;
    lewatiGeserRef.current = null;
    const petaLama = petaBidak(fenLama);
    let ada = false;
    for (const g of geseran) {
      if (lewati && lewati.ke === g.ke && Date.now() - lewati.waktu < 1500) continue;
      const petakAsalEl = wadah.querySelector(`[data-petak="${g.dari}"]`);
      const petakTujuanEl = wadah.querySelector(`[data-petak="${g.ke}"]`);
      const bidakEl = petakTujuanEl?.querySelector?.("[data-bidak]");
      if (!petakAsalEl || !petakTujuanEl || !bidakEl) continue;
      const rectAsal = petakAsalEl.getBoundingClientRect();
      const rectTujuan = petakTujuanEl.getBoundingClientRect();
      if (!rectAsal.width || !rectTujuan.width) continue;
      const dx = rectAsal.left - rectTujuan.left;
      const dy = rectAsal.top - rectTujuan.top;
      if (!dx && !dy) continue;
      const tertangkap = petaLama[g.ke];
      const ghostEl = tertangkap && tertangkap !== g.bidak ? buatGhostTertangkap(petakTujuanEl, tertangkap) : null;
      if (animasikanBidak(bidakEl, dx, dy, ghostEl)) ada = true;
      else ghostEl?.remove?.();
    }
    if (ada) sembunyikanBantuPilih(true);
  }, [fen, orientasi, animasi, langkahAkhir, animasikanBidak, hentikanSemuaAnimasi, sembunyikanBantuPilih, buatGhostTertangkap]);
  useEffect(() => () => hentikanSemuaAnimasi(), [hentikanSemuaAnimasi]);

  /* -------------------------------------------------------------- seret */
  function mulaiSeret(e, petakAwal) {
    if (e.pointerType !== "touch") e.preventDefault();
    bacaGeometri();
    seretRef.current = { dari: petakAwal, x0: e.clientX, y0: e.clientY, pindah: false, terpilihSebelumnya: terpilih === petakAwal, pointerId: e.pointerId };
    setSeret({ from: petakAwal });
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => posisikanHantu(e.clientX, e.clientY));
    else posisikanHantu(e.clientX, e.clientY);
    try { akar.current?.setPointerCapture(e.pointerId); } catch { /* tidak tersedia */ }
    if (onMulaiSeret) onMulaiSeret(petakAwal);
    else onPilih?.(petakAwal);
  }

  function padaTekan(e, petakAwal) {
    if (e.button === 2) {
      if (seretRef.current || baruBatalRef.current) { e.preventDefault(); batalkanSeretInternal(); return; }
      if (membeku) return;
      e.preventDefault();
      const warna = warnaDariPeristiwa(e);
      kananRef.current = { petak: petakAwal, warna };
      // Panah sementara memakai warna modifier yang sama dengan panah permanen,
      // supaya warna tidak berubah saat tombol dilepas.
      setPanahSementara({ from: petakAwal, to: petakAwal, warna });
      try { akar.current?.setPointerCapture(e.pointerId); } catch { /* abaikan */ }
      return;
    }
    if (e.button !== 0) return;
    onHapusTanda?.();
    if (terkunci) return;
    baruBatalRef.current = false;
    const bidak = peta[petakAwal];
    const warnaBidak = bidak ? (bidak === bidak.toUpperCase() ? "w" : "b") : null;
    if (bidak && warnaBidak === giliran) mulaiSeret(e, petakAwal);
  }

  function padaGerak(e) {
    if (seretRef.current) {
      if (e.buttons & 2) { batalkanSeretInternal(); return; }
      const jarak = Math.hypot(e.clientX - seretRef.current.x0, e.clientY - seretRef.current.y0);
      if (jarak > 5) seretRef.current.pindah = true;
      bacaGeometri();
      posisikanHantu(e.clientX, e.clientY);
    }
    if (kananRef.current) {
      const kini = cariPetak(e.clientX, e.clientY);
      setPanahSementara((p) => {
        if (!p) return p;
        const tujuan = kini && kini !== p.from ? kini : p.from;
        return { ...p, to: tujuan };
      });
    }
  }

  function padaLepas(e) {
    if (e.button === 0 && seretRef.current) {
      const { dari, pindah, terpilihSebelumnya } = seretRef.current;
      seretRef.current = null;
      setSeret(null);
      const petakTujuan = pindah ? cariPetak(e.clientX, e.clientY) : null;
      const tujuan = petakTujuan || dari;
      const klikUlang = !pindah && tujuan === dari && terpilihSebelumnya;
      if (pindah && tujuan !== dari) {
        abaikanKlikRef.current = true;
        lewatiGeserRef.current = { ke: tujuan, waktu: Date.now() };
      }
      if (onSelesaiSeret) onSelesaiSeret(dari, tujuan, klikUlang);
      else if (pindah && tujuan !== dari) onJatuh?.(dari, tujuan);
      return;
    }
    if (e.button === 2) {
      if (baruBatalRef.current) { kananRef.current = null; setPanahSementara(null); baruBatalRef.current = false; return; }
      if (!kananRef.current) return;
      const { petak: asal, warna } = kananRef.current;
      const tujuan = cariPetak(e.clientX, e.clientY);
      // Warna modifier yang disimpan saat tombol ditekan wajib diteruskan;
      // sebelumnya selalu "bawaan" sehingga Shift/Ctrl/Alt tidak berpengaruh.
      if (tujuan && tujuan !== asal) onTandaPanah?.(asal, tujuan, warna);
      else if (tujuan) onTandaPetak?.(asal, warna);
      kananRef.current = null;
      setPanahSementara(null);
    }
  }

  function padaBatal() {
    const adaSeret = !!seretRef.current;
    seretRef.current = null;
    kananRef.current = null;
    setSeret(null);
    setPanahSementara(null);
    if (adaSeret) {
      abaikanKlikRef.current = true;
      baruBatalRef.current = true;
      onBatalSeretRef.current?.();
    }
  }

  function padaKlikPetak(sq) {
    if (abaikanKlikRef.current) { abaikanKlikRef.current = false; return; }
    onKlik?.(sq);
  }
  padaTekanRef.current = padaTekan;
  padaKlikPetakRef.current = padaKlikPetak;

  const warnaPapan = useMemo(() => {
    const palet = boardThemes[tema] || boardThemes[0];
    return {
      terang: palet.white,
      gelap: palet.black,
      teksTerang: warnaTeksKoordinat(palet.white, palet.black),
      teksGelap: warnaTeksKoordinat(palet.black, palet.white),
    };
  }, [tema]);

  return (
    <div
      ref={akar}
      onPointerMove={padaGerak}
      onPointerUp={padaLepas}
      onPointerCancel={padaBatal}
      onLostPointerCapture={padaBatal}
      onPointerDown={(e) => { if (e.button === 2 && (seretRef.current || baruBatalRef.current)) { e.preventDefault(); batalkanSeretInternal(); } }}
      onContextMenu={(e) => { e.preventDefault(); if (seretRef.current) batalkanSeretInternal(); }}
      className={`relative w-full aspect-square select-none overflow-hidden rounded ring-1 ring-black/10 ${seret ? "cursor-grabbing" : ""}`}
    >
      <div className="grid grid-cols-8 grid-rows-8 w-full h-full">
        {petak.map((sq, i) => {
          const baris = Math.floor(i / 8);
          const kolom = i % 8;
          const bidak = peta[sq] || "";
          const warnaBidak = bidak ? (bidak === bidak.toUpperCase() ? "w" : "b") : null;
          return (
            <Petak
              key={sq}
              sq={sq}
              baris={baris}
              kolom={kolom}
              bidak={bidak}
              bisaSeret={!!bidak && warnaBidak === giliran && !terkunci}
              dipilih={terpilih === sq}
              jadiSasaran={tampilTitikLangkah && sasaran.includes(sq)}
              jadiTangkap={sasaranTangkap.includes(sq)}
              jadiPetunjuk={!!petunjuk && (petunjuk.from === sq || petunjuk.to === sq)}
              jadiSalah={!!kesalahan && (kesalahan.from === sq || kesalahan.to === sq)}
              jadiAkhir={sorotLangkahAkhir && !!langkahAkhir && (langkahAkhir.from === sq || langkahAkhir.to === sq)}
              sedangDiseret={!!seret && seret.from === sq}
              warnaMark={tanda.petak[sq] || null}
              warnaPapan={warnaPapan}
              setBidak={setBidak}
              tampilKoordinat={tampilKoordinat}
              onTekan={onTekanPetak}
              onKlik={onKlikPetak}
            />
          );
        })}
      </div>

      <svg className="arrows pointer-events-none absolute inset-0 z-30 h-full w-full" viewBox="0 0 100 100" aria-hidden="true">
        {tanda.panah.map((p, i) => (
          <polygon key={`${p.from}-${p.to}-${i}`} data-arrow={`${p.from}${p.to}`} className="arrow" points={titikKePoints(titikPanah(p.from, p.to, orientasi))} fill={WARNA_PANAH[p.warna]} style={{ opacity: 0.8 }} />
        ))}
        {panahSementara && panahSementara.to !== panahSementara.from && (
          <polygon className="arrow" points={titikKePoints(titikPanah(panahSementara.from, panahSementara.to, orientasi))} fill={WARNA_PANAH[panahSementara.warna]} style={{ opacity: 0.5 }} />
        )}
      </svg>

      {seret && peta[seret.from] && (
        <div ref={hantuRef} className="pointer-events-none absolute left-0 top-0 z-[70] will-change-transform" style={{ width: "12.5%", height: "12.5%" }} aria-hidden="true">
          <div className="h-full w-full scale-110 drop-shadow-2xl">
            <BidakPapan kode={peta[seret.from]} set={setBidak} />
          </div>
        </div>
      )}
    </div>
  );
}
