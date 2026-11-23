/*
 * Kartu kanan layar Akun: rentang tanggal, filter ringan, lalu tarik partai
 * akun aktif dengan mekanisme yang sama seperti panel "Tarik Data" di layar
 * Database (muatPartaiChessCom / muatPartaiLichess + progres + simpan lokal).
 * Menekan kartu akun di kolom kiri hanya memilih akun; tarikan berjalan saat
 * tombol "Muat partai" di panel ini ditekan.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../components/ui/tabs.jsx";
import { useI18n } from "../../../lib/i18n.jsx";
import { bacaTeks, tulis } from "../penyimpanan.js";
import { muatPartaiChessCom, muatPartaiLichess } from "./muatPartaiAkun.js";
import { pesanPenyimpananPartai } from "../database/statusSimpan.js";
import PemilihRentang from "./PemilihRentang.jsx";
import { PRESET_RENTANG, rentangPreset } from "./rentangTanggal.js";

const KUNCI_TERSIMPAN = "tarik-terakhir";
const MAKS_BAWAAN = 500;
const BATAS_MAKS = 5000;
const KELAS_WAKTU = ["bullet", "blitz", "rapid", "classical", "daily"];
function tanggalSah(nilai) {
  const s = String(nilai || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
}

function pesanArsipGagal(t, hasil) {
  const gagal = hasil?.arsipGagal;
  if (!Array.isArray(gagal) || !gagal.length) return "";
  const bulan = gagal.slice(0, 6).map((a) => `${a.tahun}-${a.bulan}`).join(", ");
  return t("analisa.akun.tarik.arsipParsial", {
    gagal: gagal.length,
    total: hasil.totalArsip,
    bulan: bulan + (gagal.length > 6 ? ", …" : ""),
  });
}

function bacaTersimpan() {
  try {
    const mentah = bacaTeks(KUNCI_TERSIMPAN, "");
    if (!mentah) return null;
    const obj = JSON.parse(mentah);
    return obj && typeof obj === "object" ? obj : null;
  } catch {
    return null;
  }
}

export default function PanelTarikPartai({ akun, abortRef, onSelesai, disabled = false }) {
  const { t } = useI18n();
  const akunAktif = akun?.platform && akun?.username ? akun : null;
  const awalPreset = rentangPreset("30hari");

  const [preset, setPreset] = useState("30hari");
  const [dari, setDari] = useState(awalPreset.dari);
  const [sampai, setSampai] = useState(awalPreset.sampai);
  const [waktu, setWaktu] = useState([]);
  const [warna, setWarna] = useState("");
  const [status, setStatus] = useState("semua");
  const [maks, setMaks] = useState(String(MAKS_BAWAAN));
  const [sedang, setSedang] = useState(false);
  const [progres, setProgres] = useState(null);
  const [pesan, setPesan] = useState(null);
  const [perluKonfirmasi, setPerluKonfirmasi] = useState(false);
  const [tersimpan, setTersimpan] = useState(bacaTersimpan);

  const opsiRef = useRef(null);
  opsiRef.current = { preset, dari, sampai, maks, waktu, warna, status };

  // A request belongs to the selected account. Switching accounts (or
  // removing the active one) must cancel it and discard its old UI state.
  useEffect(() => {
    setSedang(false);
    setProgres(null);
    setPesan(null);
    setPerluKonfirmasi(false);
    return () => {
      const kendali = abortRef.current;
      abortRef.current = null;
      kendali?.abort();
    };
  }, [abortRef, akun?.platform, akun?.username]);

  const jalankan = useCallback(
    async ({ nilai, konfirmasi = false } = {}) => {
      if (!akunAktif || disabled) return;
      const opsi = nilai ?? opsiRef.current;
      const dariNilai = tanggalSah(opsi.dari);
      const sampaiNilai = tanggalSah(opsi.sampai);

      if (opsi.preset !== "semua") {
        if (!dariNilai || !sampaiNilai) {
          setPesan({ jenis: "info", teks: t("analisa.akun.tarik.tanggalWajib") });
          return;
        }
        if (dariNilai > sampaiNilai) {
          setPesan({ jenis: "info", teks: t("analisa.akun.tarik.tanggalTerbalik") });
          return;
        }
      }
      if (opsi.preset === "semua" && !konfirmasi) {
        setPerluKonfirmasi(true);
        setPesan({ jenis: "info", teks: t("analisa.akun.tarik.konfirmasiBesar") });
        return;
      }

      const maksAngka = Math.min(BATAS_MAKS, Math.max(1, Number(opsi.maks) || MAKS_BAWAAN));
      const kelasWaktu = Array.isArray(opsi.waktu) ? opsi.waktu : [];
      const warnaDipilih = opsi.warna ? [opsi.warna] : [];
      const statusDipilih = opsi.status === "rated" || opsi.status === "unrated" ? opsi.status : undefined;
      const muat = akunAktif.platform === "lichessOrg" ? muatPartaiLichess : muatPartaiChessCom;

      abortRef.current?.abort();
      const kendali = new AbortController();
      abortRef.current = kendali;
      setSedang(true);
      setPerluKonfirmasi(false);
      setProgres({ current: 0, total: 0, bulan: null });
      setPesan(null);

      try {
        const hasil = await muat(akunAktif.username, {
          dari: dariNilai || undefined,
          sampai: sampaiNilai || undefined,
          maks: maksAngka,
          waktu: kelasWaktu,
          warna: warnaDipilih,
          rated: statusDipilih,
          paksa: true,
          signal: kendali.signal,
          onProgress: (current, total, bulan) => {
            if (abortRef.current === kendali && !kendali.signal.aborted) {
              setProgres({ current, total, bulan });
            }
          },
        });
        if (kendali.signal.aborted) return;

        const jumlah = hasil.partai.length;
        const peringatan = pesanPenyimpananPartai(t, jumlah, hasil.penyimpanan);
        const arsipParsial = pesanArsipGagal(t, hasil);
        const namaSitus = t(`analisa.format.${akunAktif.platform}`);
        const ringkasan = peringatan || t("analisa.akun.tarik.sukses", {
          n: jumlah, situs: namaSitus, tersimpan: hasil.penyimpanan.tersimpan,
        });
        setPesan({
          jenis: peringatan || arsipParsial ? "gagal" : "sukses",
          teks: [arsipParsial, ringkasan].filter(Boolean).join(" "),
        });

        const simpan = {
          platform: akunAktif.platform,
          username: akunAktif.username,
          preset: opsi.preset,
          dari: dariNilai,
          sampai: sampaiNilai,
          maks: maksAngka,
          waktu: kelasWaktu,
          warna: opsi.warna || "",
          status: statusDipilih || "semua",
        };
        tulis(KUNCI_TERSIMPAN, JSON.stringify(simpan));
        setTersimpan(simpan);
        onSelesai?.(jumlah);
      } catch (e) {
        if (e?.name === "AbortError" || kendali.signal.aborted) return;
        setPesan({
          jenis: "gagal",
          teks: pesanArsipGagal(t, e) || (e?.cooldown
            ? t("analisa.akun.tarik.cooldown")
            : t("analisa.akun.tarik.gagal", { pesan: e?.message || "unknown" })),
        });
      } finally {
        if (abortRef.current === kendali) {
          abortRef.current = null;
          setSedang(false);
          setProgres(null);
        }
      }
    },
    [abortRef, akunAktif, disabled, onSelesai, t],
  );

  /* Satu pintu untuk setiap perubahan rentang, baik dari preset maupun dari
   * kalender, supaya `preset`, `dari`, dan `sampai` tidak pernah berbeda
   * langkah — ketiganya dibaca bersama oleh tombol muat. */
  function ubahRentang(nilai) {
    const nilaiPreset = PRESET_RENTANG.includes(nilai.preset) ? nilai.preset : "kustom";
    setPreset(nilaiPreset);
    setDari(tanggalSah(nilai.dari));
    setSampai(tanggalSah(nilai.sampai));
    setPerluKonfirmasi(false);
    setPesan(null);
  }

  function toggleWaktu(kelas) {
    setWaktu((lama) => (lama.includes(kelas) ? lama.filter((x) => x !== kelas) : [...lama, kelas]));
  }

  function pakaiTersimpan() {
    if (!tersimpan) return;
    const nilaiPreset = PRESET_RENTANG.includes(tersimpan.preset) ? tersimpan.preset : "kustom";
    const nilaiMaks = String(Math.min(BATAS_MAKS, Math.max(1, Number(tersimpan.maks) || MAKS_BAWAAN)));
    const nilaiWaktu = Array.isArray(tersimpan.waktu)
      ? tersimpan.waktu.filter((x) => KELAS_WAKTU.includes(x))
      : [];
    const nilaiWarna = tersimpan.warna === "putih" || tersimpan.warna === "hitam" ? tersimpan.warna : "";

    setPreset(nilaiPreset);
    setDari(tanggalSah(tersimpan.dari));
    setSampai(tanggalSah(tersimpan.sampai));
    setMaks(nilaiMaks);
    setWaktu(nilaiWaktu);
    setWarna(nilaiWarna);
    setStatus(tersimpan.status === "rated" || tersimpan.status === "unrated" ? tersimpan.status : "semua");
    setPesan(null);
    jalankan({
      nilai: {
        ...tersimpan,
        preset: nilaiPreset,
        dari: tanggalSah(tersimpan.dari),
        sampai: tanggalSah(tersimpan.sampai),
        maks: nilaiMaks,
        waktu: nilaiWaktu,
        warna: nilaiWarna,
        status: tersimpan.status === "rated" || tersimpan.status === "unrated" ? tersimpan.status : "semua",
      },
      konfirmasi: true,
    });
  }

  const tersimpanCocok =
    tersimpan &&
    akunAktif &&
    tersimpan.platform === akunAktif.platform &&
    String(tersimpan.username || "").toLowerCase() === String(akunAktif.username || "").toLowerCase();

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-4 overflow-y-auto p-3 sm:p-4">
      <Tabs defaultValue="rentang" className="w-full">
        <div className="slanted-header-wrapper">
          <div className="slanted-border-overlay">
            <TabsList className="slanted-tabs-container">
              <TabsTrigger
                value="rentang"
                className="slanted-tab flex-1 cursor-pointer !transition-none px-3 py-2 text-xs data-[state=active]:!bg-[#5F873A] data-[state=active]:!text-white data-[state=active]:!shadow-none data-[state=inactive]:!bg-transparent data-[state=inactive]:!text-foregroundGrey sm:flex-initial sm:px-4 sm:text-sm"
              >
                Tanggal
              </TabsTrigger>
              <div className="h-5 w-[1px] shrink-0 bg-[#45474b]" aria-hidden="true" />
              <TabsTrigger
                value="filter"
                className="slanted-tab flex-1 cursor-pointer !transition-none px-3 py-2 text-xs data-[state=active]:!bg-[#5F873A] data-[state=active]:!text-white data-[state=active]:!shadow-none data-[state=inactive]:!bg-transparent data-[state=inactive]:!text-foregroundGrey sm:flex-initial sm:px-4 sm:text-sm"
              >
                Filter
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="user-title-section">
            <div className="flex max-w-full items-center text-center">
              <h2
                className="mx-auto min-w-0 break-words text-[25px] font-bold leading-tight tracking-tight text-white [overflow-wrap:anywhere]"
                title={akunAktif ? akunAktif.username : t("analisa.akun.tarik.pilihAkun")}
              >
                {akunAktif ? akunAktif.username : t("analisa.akun.tarik.pilihAkun")}
              </h2>
            </div>
          </div>
        </div>

        <TabsContent value="rentang" forceMount className="mt-0 data-[state=inactive]:hidden">
          <PemilihRentang
            preset={preset}
            dari={dari}
            sampai={sampai}
            onPilih={ubahRentang}
          />
        </TabsContent>

        <TabsContent value="filter" forceMount className="mt-0 data-[state=inactive]:hidden">
          <div className="flex flex-col gap-3 rounded-b-lg border border-t-0 border-[#52555a] bg-backgroundBoxBox px-4 py-4">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wide text-foregroundGrey">
                {t("analisa.akun.tarik.maksPartai")}
              </span>
              <input
                type="number"
                min={1}
                max={BATAS_MAKS}
                step={50}
                value={maks}
                onChange={(e) => setMaks(e.currentTarget.value)}
                className="w-full rounded-borderRoundness border border-border bg-backgroundBox px-2.5 py-1.5 text-xs text-foreground outline-none transition-colors hover:border-borderHighlighted focus:border-borderHighlighted"
              />
            </label>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-foregroundGrey">
                {t("analisa.akun.tarik.waktu")}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {KELAS_WAKTU.map((kelas) => (
                  <button
                    key={kelas}
                    type="button"
                    onClick={() => toggleWaktu(kelas)}
                    aria-pressed={waktu.includes(kelas)}
                    className={`cursor-pointer rounded-borderRoundness border px-2 py-1 text-[11px] font-semibold transition-colors ${
                      waktu.includes(kelas)
                        ? "border-backgroundBoxBoxHighlighted bg-backgroundBoxBoxHighlighted text-foregroundBlackDark"
                        : "border-border bg-backgroundBox text-foregroundGrey hover:border-borderHighlighted hover:text-foregroundHighlighted"
                    }`}
                  >
                    {t(`analisa.akun.tarik.waktu_${kelas}`)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-foregroundGrey">
                {t("analisa.akun.tarik.warna")}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {[
                  { nilai: "", label: t("analisa.akun.tarik.semua") },
                  { nilai: "putih", label: t("analisa.akun.tarik.putih") },
                  { nilai: "hitam", label: t("analisa.akun.tarik.hitam") },
                ].map((pilihan) => (
                  <button
                    key={pilihan.nilai || "semua"}
                    type="button"
                    onClick={() => setWarna(pilihan.nilai)}
                    aria-pressed={warna === pilihan.nilai}
                    className={`cursor-pointer rounded-borderRoundness border px-2 py-1 text-[11px] font-semibold transition-colors ${
                      warna === pilihan.nilai
                        ? "border-backgroundBoxBoxHighlighted bg-backgroundBoxBoxHighlighted text-foregroundBlackDark"
                        : "border-border bg-backgroundBox text-foregroundGrey hover:border-borderHighlighted hover:text-foregroundHighlighted"
                    }`}
                  >
                    {pilihan.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-foregroundGrey">
                {t("analisa.akun.tarik.status")}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {[
                  { nilai: "semua", label: t("analisa.akun.tarik.semua") },
                  { nilai: "rated", label: t("analisa.akun.tarik.rated") },
                  { nilai: "unrated", label: t("analisa.akun.tarik.unrated") },
                ].map((pilihan) => (
                  <button
                    key={pilihan.nilai}
                    type="button"
                    onClick={() => setStatus(pilihan.nilai)}
                    aria-pressed={status === pilihan.nilai}
                    className={`cursor-pointer rounded-borderRoundness border px-2 py-1 text-[11px] font-semibold transition-colors ${
                      status === pilihan.nilai
                        ? "border-backgroundBoxBoxHighlighted bg-backgroundBoxBoxHighlighted text-foregroundBlackDark"
                        : "border-border bg-backgroundBox text-foregroundGrey hover:border-borderHighlighted hover:text-foregroundHighlighted"
                    }`}
                  >
                    {pilihan.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          disabled={!akunAktif || sedang}
          onClick={() => {
            if (perluKonfirmasi) {
              setPerluKonfirmasi(false);
              jalankan({ konfirmasi: true });
            } else {
              jalankan();
            }
          }}
          className="cursor-pointer rounded-borderRoundness bg-backgroundBoxBoxHighlighted px-3.5 py-2.5 text-sm font-bold text-foregroundBlackDark transition-colors hover:bg-backgroundBoxBoxHighlightedHover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {perluKonfirmasi ? t("analisa.akun.tarik.muatLagi") : t("analisa.akun.tarik.muat")}
        </button>
        {tersimpanCocok ? (
          <button
            type="button"
            disabled={sedang || disabled}
            onClick={pakaiTersimpan}
            className="cursor-pointer rounded-borderRoundness border border-border bg-backgroundBoxBox px-3.5 py-2 text-xs font-semibold text-foregroundGrey transition-colors hover:border-borderHighlighted hover:text-foregroundHighlighted disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t("analisa.akun.tarik.muatTersimpan", { nama: tersimpan.username })}
          </button>
        ) : null}
      </div>

      {sedang ? (
        <div className="rounded-borderRoundness border border-border bg-backgroundBoxBox px-3 py-2">
          <p className="text-xs font-bold text-foreground">{t("analisa.akun.tarik.sedang")}</p>
          {progres?.total > 0 ? (
            <p className="text-xs tabular-nums text-foregroundGrey">
              {progres.current}/{progres.total}
              {progres.bulan ? ` ${progres.bulan.tahun}-${progres.bulan.bulan}` : ""}
            </p>
          ) : progres?.current > 0 ? (
            <p className="text-xs tabular-nums text-foregroundGrey">
              {t("analisa.akun.tarik.progresPartai", { n: progres.current })}
            </p>
          ) : null}
        </div>
      ) : null}

      {pesan ? (
        <p
          role={pesan.jenis === "gagal" ? "alert" : "status"}
          className={`text-xs leading-4 ${
            pesan.jenis === "gagal"
              ? "text-lossRed"
              : pesan.jenis === "sukses"
                ? "text-foreground"
                : "text-foregroundGrey"
          }`}
        >
          {pesan.teks}
        </p>
      ) : null}
    </div>
  );
}
