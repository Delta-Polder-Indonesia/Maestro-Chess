/*
 * Kartu akun (kolom kiri layar akun) — kartu ber-border dengan header
 * (avatar + nama + aksi hapus), baris statistik Bullet/Blitz/Rapid,
 * lalu bar "Games terunduh / total" + progress + "Pembaruan terakhir".
 * Kartu dapat di-klik untuk memilih akun yang statistiknya ditampilkan
 * di kanan.
 *
 * UPDATE (2026-11): logo platform (Chess.com/Lichess) di kanan header
 * dan tombol refresh "Perbaharui statistik" dihapus. Logo tidak memberi
 * informasi yang tidak sudah terwakili avatar/warna latar; refresh
 * redundan karena pembaruan statistik sudah ditangani otomatis di
 * layar Wawasan/Database (muatUlangRef di nav/layarDatabase.jsx yang
 * dipicu otomatis saat basis data berubah). Tersisa tombol hapus
 * untuk mengeluarkan akun dari daftar.
 */
import { useEffect, useState } from "react";
import { useI18n } from "../../../lib/i18n.jsx";
import { TooltipLabel } from "../../../components/ui/tooltip.jsx";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "../../../components/ui/alert-dialog.jsx";
import { useKartuPemain } from "@/modul/profil/index.js";
import { ambilDaftarPartai, bacaRevisiBasis } from "../basisData.js";
import Profile from "../komponen/svg/profile.jsx";
import Trash from "../komponen/svg/trash.jsx";

const BIRU = "#4a9dd9";

/* Cache sesi hasil pembacaan basis data per koleksi (kunci `${platform}:${user}`),
 * supaya kartu tidak memulai dari 0 saat di-mount ulang (ganti tab menu) —
 * pembacaan basis tetap memakai revisi untuk membuang entri basi.
 * `cacheTotal` menyimpan `total` dari kartu profil agar penyebut bar
 * "Games terunduh / total" tidak melompat ke 0 saat kartu dirender ulang. */
const cacheInfo = new Map();
const cacheTotal = new Map();

function cacheValid(peta, koleksiId) {
  const e = peta.get(koleksiId);
  return e && e.revisi === bacaRevisiBasis() ? e : null;
}

function formatRating(x) {
  return x == null ? "—" : String(x);
}

export default function KartuAkun({ platform, username, aktif = false, tabAktif = true, revisi = 0, disabled = false, onPilih, onHapus }) {
  const { t, bahasa: locale } = useI18n();
  const user = String(username || "").trim();
  const koleksiId = `${platform}:${user.toLowerCase()}`;
  const kartu = useKartuPemain(user, !!user, platform);
  const [konfirmasiHapus, setKonfirmasiHapus] = useState(false);
  // Dialog di-portal ke luar panel; jangan biarkan tab tersembunyi menahan
  // fokus atau tetap meminta konfirmasi saat pengguna kembali.
  useEffect(() => { if (!tabAktif) setKonfirmasiHapus(false); }, [tabAktif]);
  const [info, setInfo] = useState(() => {
    const e = cacheValid(cacheInfo, koleksiId);
    return e ? { games: e.games, lastUpdate: e.lastUpdate, galat: false } : { games: 0, lastUpdate: null, galat: false };
  });
  const [totalTersimpan, setTotalTersimpan] = useState(() => cacheValid(cacheTotal, koleksiId)?.total ?? 0);

  useEffect(() => {
    let hidup = true;
    (async () => {
      try {
        const db = await ambilDaftarPartai({ koleksiId, limit: 0, sertakanPgn: false });
        if (db?.galat) throw new Error("basis data tidak dapat dibaca");
        const daftar = db?.partai || [];
        const ts = daftar.reduce((m, p) => Math.max(m, Number(p.timestamp) || 0), 0);
        if (hidup) {
          const games = db?.total ?? daftar.length;
          cacheInfo.set(koleksiId, { games, lastUpdate: ts, galat: false, revisi: bacaRevisiBasis() });
          setInfo({ games, lastUpdate: ts, galat: false });
        }
      } catch {
        if (hidup) setInfo((lama) => ({ ...lama, galat: true }));
      }
    })();
    return () => {
      hidup = false;
    };
  }, [koleksiId, revisi]);

  // Simpan `total` (dari kartu profil) ke cache modul supaya penyebut bar
  // tidak kembali ke 0 sesaat saat kartu di-mount ulang.
  useEffect(() => {
    if (kartu?.total == null) return;
    cacheTotal.set(koleksiId, { total: kartu.total, revisi: bacaRevisiBasis() });
    setTotalTersimpan((x) => (x === kartu.total ? x : kartu.total));
  }, [kartu?.total, koleksiId]);

  const total = kartu?.total ?? totalTersimpan;
  const terunduh = info.games;
  const efektif = Math.max(total, terunduh);
  const persen = efektif ? (terunduh / efektif) * 100 : 0;

  const tanggal = (ts) => {
    if (!ts) return "—";
    try {
      return new Intl.DateTimeFormat(locale, { day: "numeric", month: "numeric", year: "numeric" }).format(new Date(ts));
    } catch {
      return new Date(ts).toLocaleDateString();
    }
  };

  return (
    <>
      <div
        className={`relative w-full overflow-hidden rounded-[0.4rem] border bg-backgroundBox text-left transition-colors ${
          aktif ? "border-[var(--analisa-backgroundBoxBoxHighlighted)] ring-1 ring-[var(--analisa-backgroundBoxBoxHighlighted)]" : "border-border hover:border-borderHighlighted"
        }`}
      >
        {/* Selection covers the card, but delete is a separate sibling control. */}
        <button
          type="button"
          data-uji="kartu-akun"
          aria-label={`${user} — ${t(`analisa.format.${platform}`)}`}
          aria-pressed={aktif}
          disabled={disabled}
          onClick={onPilih}
          className="absolute inset-0 w-full cursor-pointer rounded-[0.4rem] focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-backgroundBoxBoxHighlighted disabled:cursor-not-allowed"
        />
        <div className="pointer-events-none relative">
        {/* Header: avatar + nama + aksi hapus (logo platform & tombol refresh
            dihapus — logo tidak memberi informasi tambahan, refresh redundan
            karena pembaruan statistik ditangani otomatis di Wawasan/Database). */}
        <div className="flex items-center gap-2 sm:gap-3 border-b border-border px-2.5 sm:px-3 py-2 sm:py-2.5">
          <span className={`grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-md ${platform === "chessCom" ? "bg-backgroundProfileWhite" : "bg-backgroundProfileBlack"}`}>
            {kartu?.avatar ? (
              <img className="h-full w-full object-cover" width={28} height={28} src={kartu.avatar} alt="" loading="lazy" referrerPolicy="no-referrer" />
            ) : (
              <Profile width={16} height={16} class={platform === "chessCom" ? "fill-foregroundProfileWhite" : "fill-foregroundProfileBlack"} />
            )}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-bold text-foreground">{user}</span>
          <TooltipLabel label={t("analisa.akun.hapus")}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setKonfirmasiHapus(true);
              }}
              disabled={disabled}
              aria-label={`${t("analisa.akun.hapus")}: ${user}`}
              className="pointer-events-auto grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-borderRoundness text-foregroundGrey transition-colors hover:bg-backgroundBoxBoxHover hover:text-lossRed focus-visible:outline focus-visible:outline-2 focus-visible:outline-lossRed"
            >
              <Trash className="h-[15px] w-[15px]" />
            </button>
          </TooltipLabel>
        </div>

        {/* Baris statistik Bullet/Blitz/Rapid */}
        <div className="px-3 py-2.5">
          {["bullet", "blitz", "rapid"].map((k) => (
            <div key={k} className="flex items-center justify-between py-0.5">
              <span className="text-[0.7rem] font-bold uppercase tracking-wide text-foregroundGrey">{k}</span>
              <span className="text-sm font-bold tabular-nums text-foreground">{formatRating(kartu?.ratings?.[k])}</span>
            </div>
          ))}
        </div>

        {/* Games terunduh / total + progress + last update */}
        <div className="px-3 pb-3">
          {info.galat ? (
            <p role="status" className="text-[0.7rem] text-warning">{t("analisa.statistik.galatBasis")}</p>
          ) : (
            <>
              <div className="flex items-center justify-between pb-1">
                <span className="text-[0.7rem] text-foregroundGrey">{t("analisa.statistik.games")}</span>
                <span className="text-[0.7rem] font-bold tabular-nums text-foreground">
                  {terunduh} / {efektif}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-backgroundBoxBox">
                <div className="h-full rounded-full" style={{ width: `${persen}%`, backgroundColor: BIRU }} />
              </div>
              <div className="pt-1.5 text-[0.7rem] text-foregroundGrey">
                {t("analisa.statistik.terakhir")} {tanggal(info.lastUpdate)}
              </div>
            </>
          )}
        </div>
        </div>
      </div>
      <AlertDialog open={tabAktif && konfirmasiHapus} onOpenChange={setKonfirmasiHapus}>
        <AlertDialogContent className="border-[#5d5d5d] bg-[#1e1d1c] text-[#dedede] shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">{t("analisa.akun.hapus")}</AlertDialogTitle>
            <AlertDialogDescription className="break-words text-[#aaa]">
              {t("analisa.akun.konfirmasiHapus", { nama: user })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[#5d5d5d] bg-[#2a2a2a] text-[#dedede] hover:bg-[#3a3a3a] hover:text-white">{t("analisa.akun.batal")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => onHapus?.()} className="bg-[#81b64c] font-bold text-black hover:bg-[#8bc550]">
              {t("analisa.akun.hapus")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
