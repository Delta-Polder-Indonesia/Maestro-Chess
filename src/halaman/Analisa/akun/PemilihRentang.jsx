/*
 * Pemilih rentang tanggal panel "Tinjau partai Anda".
 *
 * Polanya mengikuti blok kalender rentang yang lazim dipakai: daftar preset
 * di kiri, kalender di kanan, dan ujung rentang ditandai "pin" — balok kecil
 * yang keluar dari sel awal/akhir — sehingga awal dan akhir rentang langsung
 * terbaca tanpa harus menebak warna latarnya.
 *
 * Komponen ini dikendalikan penuh dari luar: ia hanya melaporkan
 * `{ preset, dari, sampai }` lewat `onPilih`. Panel tetap pemilik state
 * karena nilai itu juga dipakai tombol "Muat partai" dan pencarian tersimpan.
 *
 * Tanggal tidak boleh melewati hari ini: arsip akun tidak pernah berisi
 * partai besok, dan `muatPartaiAkun` akan membuang permintaan kosong.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "../../../lib/i18n.jsx";
import {
  bagianTanggal,
  formatTanggal,
  geserBulan,
  hariIniUTC,
  labelHari,
  msDariKunci,
  namaBulan,
  namaHariPendek,
  PRESET_RENTANG,
  rentangPreset,
  susunGridBulan,
} from "./rentangTanggal.js";

const BARIS_GRID = 6;
const KOLOM_GRID = 7;
const SEHARI = 86400000;

/** Awal minggu mengikuti kebiasaan tiap bahasa: Senin (id), Minggu (en). */
function awalMingguUntuk(bahasa) {
  return bahasa === "en" ? 0 : 1;
}

function lokalUntuk(bahasa) {
  return bahasa === "en" ? "en-US" : "id-ID";
}

/** Posisi sebuah hari dalam rentang: "awal", "tengah", "akhir", "tunggal". */
function posisiDalamRentang(kunci, dari, sampai) {
  if (!dari) return null;
  if (!sampai || dari === sampai) return kunci === dari ? "tunggal" : null;
  if (kunci === dari) return "awal";
  if (kunci === sampai) return "akhir";
  return kunci > dari && kunci < sampai ? "tengah" : null;
}

/*
 * Kelas latar sel. Pin diwujudkan dengan `after:` pada SEL, bukan pada
 * tombolnya: tombol diposisikan (`relative z-10`) sehingga angkanya selalu
 * di atas balok pin, sementara sel awal diberi `z-20` agar baloknya tidak
 * tertutup latar sel tengah yang datang kemudian.
 */
const KELAS_POSISI = {
  tunggal: "z-20 rounded-md bg-backgroundBoxBoxHighlighted shadow-sm",
  awal: "z-20 rounded-l-md bg-backgroundBoxBoxHighlighted shadow-sm after:absolute after:inset-y-0 after:right-0 after:w-3 after:bg-backgroundBoxBoxHighlighted/25",
  akhir: "z-10 rounded-r-md bg-backgroundBoxBoxHighlighted shadow-sm after:absolute after:inset-y-0 after:left-0 after:w-3 after:bg-backgroundBoxBoxHighlighted/25",
  tengah: "z-0 bg-backgroundBoxBoxHighlighted/25",
};

const KELAS_ANGKA = {
  tunggal: "text-foregroundBlackDark",
  awal: "text-foregroundBlackDark",
  akhir: "text-foregroundBlackDark",
  tengah: "text-foreground",
};

export default function PemilihRentang({ preset, dari, sampai, onPilih }) {
  const { t, bahasa } = useI18n();
  const hariIni = hariIniUTC();
  const lokal = lokalUntuk(bahasa);
  const awalMinggu = awalMingguUntuk(bahasa);

  const jangkar = sampai || dari || hariIni;
  const [bulan, setBulan] = useState(() => {
    const { tahun, bulan: indeks } = bagianTanggal(jangkar);
    return { tahun, bulan: indeks };
  });
  const [fokus, setFokus] = useState(jangkar);
  const wadahRef = useRef(null);
  /*
   * Fokus tidak boleh dicuri saat panel baru dibuka: layar Akun sengaja
   * membawa fokus ke lapisannya sendiri (dan mengembalikannya saat ditutup).
   * Karena itu tombol hari hanya difokus bila pengguna memang sedang
   * memakai keyboard/klik di dalam kalender ini.
   */
  const paksaFokus = useRef(false);

  // Kalender mengikuti rentang yang sedang dipakai, termasuk saat panel
  // memuat ulang "pencarian tersimpan" atau menekan preset.
  useEffect(() => {
    const { tahun, bulan: indeks } = bagianTanggal(sampai || dari || hariIni);
    setBulan({ tahun, bulan: indeks });
    setFokus(sampai || dari || hariIni);
  }, [dari, sampai, hariIni]);

  // Roving tabindex: satu hari saja yang bisa difokus, lalu panah memindahkan
  // fokus ke tanggal lain tanpa harus memusing-mundurkan Tab.
  useEffect(() => {
    if (!fokus || !paksaFokus.current) return;
    paksaFokus.current = false;
    wadahRef.current?.querySelector(`button[data-tanggal="${fokus}"]`)?.focus();
  }, [fokus, bulan]);

  const sel = useMemo(
    () => susunGridBulan(bulan.tahun, bulan.bulan, awalMinggu),
    [bulan.tahun, bulan.bulan, awalMinggu],
  );
  const namaHari = useMemo(() => namaHariPendek(lokal, awalMinggu), [lokal, awalMinggu]);
  const pekan = useMemo(
    () =>
      Array.from({ length: BARIS_GRID }, (_, b) =>
        sel.slice(b * KOLOM_GRID, b * KOLOM_GRID + KOLOM_GRID),
      ),
    [sel],
  );

  function pilihPreset(nilai) {
    const rentang = rentangPreset(nilai, hariIni);
    if (!rentang) return;
    onPilih?.({ preset: nilai, ...rentang });
  }

  function pilihHari(kunci) {
    if (kunci > hariIni) return;
    // Belum ada awal, atau rentang sudah lengkap → mulai rentang baru.
    // Hari yang lebih awal dari `dari` juga memulai rentang baru, bukan
    // membuat rentang terbalik.
    if (!dari || sampai || kunci < dari) {
      onPilih?.({ preset: "kustom", dari: kunci, sampai: "" });
      return;
    }
    onPilih?.({ preset: "kustom", dari, sampai: kunci });
  }

  function pindahBulan(langkah) {
    setBulan((lama) => geserBulan(lama.tahun, lama.bulan, langkah));
  }

  function geserSatuBulan(kunci, arah) {
    if (arah === "mundur") {
      const { tahun, bulan: indeks } = bagianTanggal(kunci);
      const mundur = geserBulan(tahun, indeks, -1);
      const hari = bagianTanggal(kunci).hari;
      const jumHari = new Date(Date.UTC(mundur.tahun, mundur.bulan + 1, 0)).getUTCDate();
      return `${mundur.tahun}-${String(mundur.bulan + 1).padStart(2, "0")}-${String(Math.min(hari, jumHari)).padStart(2, "0")}`;
    }
    const { tahun, bulan: indeks } = bagianTanggal(kunci);
    const maju = geserBulan(tahun, indeks, 1);
    const hari = bagianTanggal(kunci).hari;
    const jumHari = new Date(Date.UTC(maju.tahun, maju.bulan + 1, 0)).getUTCDate();
    return `${maju.tahun}-${String(maju.bulan + 1).padStart(2, "0")}-${String(Math.min(hari, jumHari)).padStart(2, "0")}`;
  }

  function tekanTombol(acara, kunci) {
    const langkah = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    }[acara.key];

    if (langkah !== undefined) {
      acara.preventDefault();
      paksaFokus.current = true;
      const berikut = Math.min(msDariKunci(hariIni), msDariKunci(kunci) + langkah * SEHARI);
      const kunciBerikut = new Date(berikut).toISOString().slice(0, 10);
      setFokus(kunciBerikut);
      const { tahun, bulan: indeks } = bagianTanggal(kunciBerikut);
      setBulan((lama) => (lama.tahun === tahun && lama.bulan === indeks ? lama : { tahun, bulan: indeks }));
      return;
    }

    if (acara.key === "PageUp" || acara.key === "PageDown") {
      acara.preventDefault();
      paksaFokus.current = true;
      const kunciBerikut = geserSatuBulan(kunci, acara.key === "PageUp" ? "mundur" : "maju");
      setFokus(kunciBerikut);
      const { tahun, bulan: indeks } = bagianTanggal(kunciBerikut);
      setBulan({ tahun, bulan: indeks });
      return;
    }

    if (acara.key === "Home" || acara.key === "End") {
      acara.preventDefault();
      paksaFokus.current = true;
      const geser = (new Date(msDariKunci(kunci)).getUTCDay() - awalMinggu + 7) % 7;
      const geserKe = acara.key === "Home" ? -geser : 6 - geser;
      const berikut = Math.min(
        msDariKunci(hariIni),
        msDariKunci(kunci) + geserKe * SEHARI,
      );
      const kunciBerikut = new Date(berikut).toISOString().slice(0, 10);
      setFokus(kunciBerikut);
      return;
    }

    if (acara.key === "Enter" || acara.key === " ") {
      acara.preventDefault();
      pilihHari(kunci);
    }
  }

  const ringkasan =
    preset === "semua"
      ? t("analisa.akun.tarik.semuaArsip")
      : dari && sampai
        ? `${formatTanggal(lokal, dari)} – ${formatTanggal(lokal, sampai)}`
        : t("analisa.akun.tarik.pilihRentang");

  return (
    <div className="mt-0" data-uji="pemilih-rentang">
      {/*
       grid md:grid-cols-12: preset menempati 4 kolom dan kalender 8 kolom,
       seperti contoh. Di layar sempit keduanya bertumpuk dan preset bisa
       digeser horizontal supaya kalender tetap mendapat lebar penuh.
      */}
      <div className="grid grid-cols-1 overflow-hidden rounded-b-lg border border-t-0 border-[#52555a] bg-backgroundBoxBox md:grid-cols-12">
        <div className="flex flex-row gap-1 overflow-x-auto border-b border-border p-3 md:col-span-4 md:flex-col md:overflow-visible md:border-b-0 md:border-r">
          {PRESET_RENTANG.map((nilai) => (
            <button
              key={nilai}
              type="button"
              onClick={() => pilihPreset(nilai)}
              aria-pressed={preset === nilai}
              data-uji={`preset-${nilai}`}
              className={`cursor-pointer whitespace-nowrap rounded-md px-3 py-2 text-left text-xs font-semibold transition-colors sm:text-sm md:w-full ${
                preset === nilai
                  ? "bg-backgroundBoxBoxHighlighted text-foregroundBlackDark"
                  : "text-foregroundGrey hover:bg-backgroundBoxBoxHover hover:text-foregroundHighlighted"
              }`}
            >
              {t(`analisa.akun.tarik.${nilai === "semua" ? "semuaArsip" : nilai}`)}
            </button>
          ))}
        </div>

        <div className="min-w-0 p-4 md:col-span-8" ref={wadahRef}>
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => pindahBulan(-1)}
              aria-label={t("analisa.akun.tarik.bulanMundur")}
              data-uji="bulan-mundur"
              className="cursor-pointer rounded-md p-1.5 text-foregroundGrey transition-colors hover:bg-backgroundBoxBoxHover hover:text-foregroundHighlighted"
            >
              <span aria-hidden="true">‹</span>
            </button>
            <p className="text-center text-sm font-semibold text-foreground" data-uji="nama-bulan">
              {namaBulan(lokal, bulan.tahun, bulan.bulan)}
            </p>
            <button
              type="button"
              onClick={() => pindahBulan(1)}
              aria-label={t("analisa.akun.tarik.bulanMaju")}
              data-uji="bulan-maju"
              className="cursor-pointer rounded-md p-1.5 text-foregroundGrey transition-colors hover:bg-backgroundBoxBoxHover hover:text-foregroundHighlighted"
            >
              <span aria-hidden="true">›</span>
            </button>
          </div>

          <div role="grid" aria-label={t("analisa.akun.tarik.rentang")} className="mt-2">
            <div role="row" className="grid grid-cols-7">
              {namaHari.map((nama) => (
                <div
                  key={nama}
                  role="columnheader"
                  aria-label={nama}
                  className="pb-2 text-center text-[11px] font-semibold uppercase tracking-wide text-foregroundGrey"
                >
                  {nama}
                </div>
              ))}
            </div>

            {pekan.map((baris, indeksBaris) => (
              <div role="row" key={indeksBaris} className="mb-1 grid grid-cols-7">
                {baris.map((hari) => {
                  const posisi = posisiDalamRentang(hari.kunci, dari, sampai);
                  const lewat = hari.kunci > hariIni;
                  return (
                    <div
                      key={hari.kunci}
                      role="gridcell"
                      aria-selected={Boolean(posisi)}
                      data-uji="sel-hari"
                      data-tanggal={hari.kunci}
                      data-posisi={posisi ?? ""}
                      className={`relative ${posisi ? KELAS_POSISI[posisi] : ""}`}
                    >
                      {hari.luar ? (
                        <span className="block h-9" aria-hidden="true" />
                      ) : (
                        <button
                          type="button"
                          tabIndex={fokus === hari.kunci ? 0 : -1}
                          data-tanggal={hari.kunci}
                          data-uji="tombol-hari"
                          disabled={lewat}
                          aria-label={labelHari(lokal, hari.kunci)}
                          aria-current={hari.kunci === hariIni ? "date" : undefined}
                          onClick={() => {
                            paksaFokus.current = true;
                            setFokus(hari.kunci);
                            pilihHari(hari.kunci);
                          }}
                          onKeyDown={(acara) => tekanTombol(acara, hari.kunci)}
                          onFocus={() => setFokus(hari.kunci)}
                          className={`relative z-10 h-9 w-full cursor-pointer rounded-md text-xs font-semibold tabular-nums transition-colors disabled:cursor-not-allowed disabled:text-foregroundGrey disabled:opacity-100 sm:text-sm ${
                            posisi
                              ? KELAS_ANGKA[posisi]
                              : "text-foreground hover:bg-backgroundBoxBoxHover"
                          }`}
                        >
                          {hari.hari}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="mt-2 text-xs text-foregroundGrey" data-uji="ringkasan-rentang">
        {ringkasan}
      </p>
    </div>
  );
}
