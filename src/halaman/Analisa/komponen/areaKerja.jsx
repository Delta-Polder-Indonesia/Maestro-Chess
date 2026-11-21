/*
 * Area kerja halaman Analisis Partai.
 *
 * Tugasnya dua: menyediakan <main> yang diukur papan (papan port
 * mengukur kontainer induknya), dan menampilkan LAYAR yang sedang dipilih
 * dari bilah navigasi kiri.
 *
 * Polanya sama dengan halaman Pengurus (`src/halaman/Pengurus/Dashboard.jsx`):
 * bilah samping menyetel satu state (`tab` di sana, `tampilan` di sini) dan
 * area kerja merender panel yang sesuai. Bedanya — dan ini yang penting —
 * papan catur TIDAK pernah dilepas saat layar berganti:
 *
 *   - `tampilan` selain "bermain" hanya MENUTUPI <main> dengan lapisan
 *     `absolute inset-0` yang berlatar pekat;
 *   - <main> disembunyikan dengan `invisible` (visibility:hidden), BUKAN
 *     `hidden` (display:none). visibility:hidden tetap punya kotak ukur,
 *     jadi `updateBoardSize()` di game.jsx masih membaca lebar/tinggi yang
 *     benar dan papan tidak perlu dihitung ulang saat layar kembali;
 *   - karena komponen Game tidak pernah dibongkar, `useEffect([data])` di
 *     dalamnya tidak mengulang `handlePGN()`. Kalau sampai dilepas-pasang,
 *     setiap kali pengguna bolak-balik dari Basis Data ia akan menganalisis
 *     ULANG seluruh partai dari nol;
 *   - `visibility:hidden` juga membuat isi papan tidak bisa difokus, jadi
 *     tombol Tab tidak menyelinap ke balik lapisan, dan pintasan papan
 *     dimatikan lewat `tampilanRef` di game.jsx.
 *
 * z-[900] sengaja dipilih di bawah `PageErrors` (z-[999]) supaya pesan
 * galat analisis tetap tampil di atas layar mana pun.
 *
 * KONTEKS (Fase 2): berkas ini dulu membaca AnalyzeContext sehingga SETIAP
 * detak `progress` analisis me-render ulang seluruh area kerja — termasuk
 * <Game> di dalamnya. Sekarang:
 *
 *   - <AreaKerja> hanya berlangganan navigasi papan dan tab — state yang
 *     berubah saat pengguna berpindah layar, bukan saat mesin menghitung;
 *   - <PenitipPgn> (anak tanpa tampilan) memegang `data`/`pageState` dari
 *     ImportContext untuk kiriman PGN sekali pakai dari halaman Teka-Teki;
 *   - <LapisanLayar> memegang `data` yang sama untuk operan `onAnalisa` /
 *     `onImpor` milik layar Basis Data dan Impor.
 *
 * Dengan begitu `progress` hanya me-render ulang dua komponen kecil tadi,
 * tidak lagi papan catur beserta menu dan bilah tombolnya.
 */
import { lazy, Suspense, useCallback, useContext, useEffect, useRef, useState } from "react";
import { TAMPILAN_ANALISA } from "../konteks/analyzeKonteks.js";
import { useBoard } from "../konteks/boardKonteks.js";
import { useImport } from "../konteks/importKonteks.js";
import { useTabKerja } from "../konteks/tabKerja.jsx";
import { ErrorsContext } from "../konteks/errorsKonteks.js";
import { pekerjaan, snapshotLaporanAman } from "../pekerjaan.js";
import { catatFitur, KUNCI_FITUR } from "../riwayatFitur.js";
import { usePekerjaan } from "../usePekerjaan.js";
import { useI18n } from "../../../lib/i18n.jsx";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "../../../components/ui/alert-dialog.jsx";
import { pushPageError, pushPageWarning } from "./errors/pushPageError.js";
import Game from "./game/game.jsx";
import TabBar from "./tabBar.jsx";
import BoardMenu from "./boardMenu/boardMenu.jsx";
import Menu from "./menu/menu.jsx";
import GameButtons from "./menu/analysis/gameButtons.jsx";
import { validasiPgn } from "./nav/validasiImpor.js";
import { ambilPgnTitipan } from "../../../lib/titipanAnalisa.js";

/*
 * LayarAkun (via DashboardAkun) mengimpor recharts ±97 KiB — bundle grafik
 * itu tidak dibutuhkan untuk membuka papan, jadi layar ini dimuat malas
 * (chunk terpisah, diunduh baru saat pengguna membuka layar Akun). Ini
 * mengeluarkan vendor-chart dari jalur kritis halaman (temuan "reduce
 * unused JavaScript" Lighthouse ±80 KiB).
 */
const LayarPapan = lazy(() => import("./nav/layarPapan.jsx"));
const LayarAkun = lazy(() => import("./nav/layarAkun.jsx"));
const LayarDatabase = lazy(() => import("./nav/layarDatabase.jsx"));
const LayarImpor = lazy(() => import("./nav/layarImpor.jsx"));
const LayarDeteksiEngine = lazy(() => import("./nav/layarDeteksiEngine.jsx"));
const LayarWawasan = lazy(() => import("./nav/layarWawasan.jsx"));
const LayarPengaturan = lazy(() => import("./nav/layarPengaturan.jsx"));

/**
 * Memuat partai yang dipilih dari layar Basis Data / Impor: PGN-nya
 * dilempar ke `data` (itu yang memicu Game menganalisis) lalu layar kembali
 * ke papan supaya hasilnya terlihat.
 *
 * Hook ini sengaja TIDAK dipakai <AreaKerja>: ia berlangganan ImportContext,
 * dan AreaKerja tidak boleh ikut ter-render tiap detak `progress`.
 */
function useMuatPartai() {
  const setData = useImport().data[1];
  const setTampilan = useBoard().tampilan[1];
  return useCallback(
    (dataPartai) => {
      setData(dataPartai);
      setTampilan(TAMPILAN_ANALISA.BERMAIN);
    },
    [setData, setTampilan],
  );
}

/**
 * Terima kiriman PGN sekali pakai dari halaman Teka-Teki ("Bedah di Papan
 * Analisa"). Tanpa tampilan — dipasang sekali di <AreaKerja>.
 */
function PenitipPgn() {
  const muatPartai = useMuatPartai();
  const setPageState = useImport().pageState[1];

  useEffect(() => {
    const pgnTitipan = ambilPgnTitipan();
    if (!pgnTitipan.trim()) return;
    try {
      validasiPgn(pgnTitipan);
      muatPartai({ format: "pgn", string: pgnTitipan });
    } catch {
      /*
       * PGN tidak sah: papan tetap normal. Provider mungkin memulai dalam
       * `loading` karena titipan tadi (lihat analyze.jsx) — lepaskan supaya
       * kerangka papan tidak menggantung selamanya.
       */
      setPageState("default");
    }
  }, [muatPartai, setPageState]);

  return null;
}

/** Catat layar dan penunjuk tab yang benar-benar dibuka. */
function PencatatFitur({ tampilan }) {
  const [data] = useImport().data;
  const { daftar, aktifId, perluPulih } = useTabKerja();
  const tab = daftar.find((item) => item.id === aktifId);
  const targetId = tampilan === TAMPILAN_ANALISA.BERMAIN ? data?.pekerjaanId
    : tampilan === TAMPILAN_ANALISA.IMPOR ? tab?.drafId : null;
  useEffect(() => {
    if (!perluPulih && tab?.tampilan === tampilan) catatFitur(tampilan, targetId);
  }, [tampilan, targetId, tab?.tampilan, perluPulih]);
  return null;
}

/** Peringatan tidak hilang saat pengguna berpindah layar. */
function PeringatanPenyimpanan() {
  const { t } = useI18n();
  const { siap, tersedia } = usePekerjaan();
  if (!siap || tersedia) return null;
  return (
    <div data-uji="penyimpanan-gagal" role="alert" className="shrink-0 border-b border-[#a56c25] bg-[#50391b] px-3 py-2 text-xs leading-5 text-[#ffe3ae] sm:px-5">
      <strong>{t("analisa.pekerjaan.gagalJudul")}</strong> {t("analisa.pekerjaan.gagalIsi")}
    </div>
  );
}

/**
 * Bilah tab dan lapisan layar non-papan. Panel fitur yang sudah dikunjungi
 * tetap terpasang per tab, sementara satu instance papan tetap terpasang di
 * bawahnya. Draf dan laporan dipulihkan dari penyimpanan pekerjaan.
 */
function LapisanLayar({
  tampilan,
  lapisanRef,
  kePapan,
  keAkun,
  keImpor,
  children,
}) {
  const muatPartai = useMuatPartai();
  const [data, setData] = useImport().data;
  const setTampilan = useBoard().tampilan[1];
  const setErrors = useContext(ErrorsContext).errors[1];
  const { t } = useI18n();
  const {
    daftar: daftarTab, aktifId, perluPulih, selesaiPulih,
    catat, tambah, aktifkan, hapusLain, siapkanImpor,
  } = useTabKerja();
  const [dialog, setDialog] = useState(null);
  const permintaanRef = useRef(0);
  const tampilanRef = useRef(tampilan);
  const tabAktifRef = useRef(aktifId);
  const daftarTabRef = useRef(daftarTab);
  const dataRef = useRef(data);
  const tabTerpasangRef = useRef(new Set());
  // Panel fitur yang pernah dikunjungi tetap terpasang saat tab lain dibuka,
  // agar filter dan inputnya tidak hilang. Papan tetap hanya satu instance.
  tabTerpasangRef.current.add(aktifId);
  tampilanRef.current = tampilan;
  tabAktifRef.current = aktifId;
  daftarTabRef.current = daftarTab;
  dataRef.current = data;
  // Judul dan tujuan mengikuti layar aktual; laporan/draf yang pernah dipakai
  // tetap dikaitkan dengan tab agar bisa dibuka lagi setelah berpindah tab.
  useEffect(() => {
    if (perluPulih) return;
    const perubahan = { tampilan };
    if (tampilan === TAMPILAN_ANALISA.BERMAIN) perubahan.laporanId = data?.pekerjaanId ?? null;
    catat(aktifId, perubahan);
  }, [tampilan, data?.pekerjaanId, aktifId, perluPulih, catat]);

  // en-croissant menyimpan tab dalam sesi peramban. Pulihkan penunjuknya,
  // sedangkan isi laporan/draf tetap dibaca dari penyimpanan pekerjaan.
  useEffect(() => {
    if (!perluPulih) return undefined;
    let hidup = true;
    const target = daftarTabRef.current.find((tab) => tab.id === aktifId);
    const asal = tampilanRef.current;
    const masihDipilih = () => hidup && tabAktifRef.current === aktifId && tampilanRef.current === asal;
    async function pulihkan() {
      try {
        await pekerjaan.init();
        if (!masihDipilih()) return;
        if (target?.tampilan === TAMPILAN_ANALISA.BERMAIN && target.laporanId) {
          const keadaan = pekerjaan.snapshot();
          const metadata = keadaan.daftar.find((item) => item.jenis === "laporan" && item.id === target.laporanId);
          const record = await pekerjaan.ambil(target.laporanId);
          if (!masihDipilih()) return;
          const sumberSah = record?.jenis === "laporan" && ["pgn", "fen"].includes(record.sumber?.format) && typeof record.sumber?.string === "string";
          const snapshot = sumberSah ? snapshotLaporanAman(record.snapshot) : null;
          if (snapshot) {
            setData({ ...record.sumber, pekerjaanId: record.id, pemulihan: { ...record, snapshot } });
            kePapan();
          } else if (sumberSah && record.sumber.string.trim()) {
            // Biarkan tab laporan tetap menunjuk record aslinya. Pilih tab itu
            // untuk menampilkan konfirmasi analisis ulang seperti di riwayat.
            tambah();
            setTampilan(TAMPILAN_ANALISA.PAPAN);
            pushPageWarning(setErrors,
              t(record.snapshot ? "analisa.pekerjaan.rusakJudul" : "analisa.pekerjaan.terputusJudul"),
              t(record.snapshot ? "analisa.pekerjaan.rusakUlang" : "analisa.pekerjaan.ulangIsi"));
          } else if (!metadata && !record && pekerjaan.snapshot().tersedia) {
            // Papan kosong yang belum dipakai belum mempunyai record.
            setData({ format: "fen", string: "", pekerjaanId: target.laporanId });
            kePapan();
          } else {
            // Jangan mengganti tab lama dengan papan kosong bila isi tidak
            // terbaca; pengguna dapat mencobanya lagi setelah storage pulih.
            tambah();
            setTampilan(TAMPILAN_ANALISA.PAPAN);
            pushPageError(setErrors, t("analisa.pekerjaan.rusakJudul"), t("analisa.pekerjaan.rusakIsi"));
          }
        } else if (target?.tampilan === TAMPILAN_ANALISA.IMPOR) {
          const id = await siapkanImpor(aktifId, target.drafId, masihDipilih);
          if (id && masihDipilih()) setTampilan(TAMPILAN_ANALISA.IMPOR);
        } else {
          setTampilan(target?.tampilan ?? TAMPILAN_ANALISA.PAPAN);
        }
      } catch {
        if (masihDipilih()) {
          tambah();
          setTampilan(TAMPILAN_ANALISA.PAPAN);
          pushPageError(setErrors, t("analisa.pekerjaan.rusakJudul"), t("analisa.pekerjaan.rusakIsi"));
        }
      } finally {
        if (hidup) selesaiPulih();
      }
    }
    pulihkan();
    return () => { hidup = false; };
  }, [perluPulih, aktifId, setData, setTampilan, kePapan, siapkanImpor, selesaiPulih, tambah, setErrors, t]);

  useEffect(() => {
    permintaanRef.current += 1;
    setDialog(null);
  }, [tampilan, aktifId]);

  async function jalankan(aksi, nomor) {
    const masihDipilih = () => nomor === permintaanRef.current && tampilanRef.current === aksi.asalTampilan && tabAktifRef.current === aksi.asalTabId;
    const pilihTujuan = () => {
      if (!aksi.tabTujuan) return;
      if (aksi.hapusId) tabTerpasangRef.current.delete(aksi.hapusId);
      aktifkan(aksi.tabTujuan, aksi.hapusId);
    };
    if (!masihDipilih()) return;
    if (aksi.jenis === "aktif") {
      await pekerjaan.init();
      if (!masihDipilih()) return;
      const keadaan = pekerjaan.snapshot();
      if (keadaan.aktif.digunakan) {
        const item = keadaan.daftar.find((entry) => entry.id === keadaan.aktif.id);
        if (!item || ["selesai", "baru"].includes(item.status) || keadaan.aktif.berjalan) {
          pilihTujuan();
          kePapan();
          return;
        }
        await jalankan({ ...aksi, jenis: "buka", item }, nomor);
        return;
      }
      const item = keadaan.daftar.find((entry) => entry.jenis === "laporan" && entry.id === keadaan.terakhirId) ??
        keadaan.daftar.find((entry) => entry.jenis === "laporan");
      if (item) await jalankan({ ...aksi, jenis: "buka", item }, nomor);
      else {
        pekerjaan.tetapkanAktif({ id: data.pekerjaanId, digunakan: true, berjalan: false });
        pilihTujuan();
        kePapan();
      }
      return;
    }
    if (aksi.jenis === "kosong") {
      setData({ format: "fen", string: "", pekerjaanId: aksi.id });
      pilihTujuan();
      kePapan();
      return;
    }
    if (aksi.jenis === "muat") {
      if (aksi.lanjut) aksi.lanjut();
      else muatPartai(aksi.data);
      return;
    }
    if (aksi.item?.jenis === "draf") {
      const id = await siapkanImpor(aksi.tabTujuan ?? aksi.asalTabId, aksi.item.id, masihDipilih);
      if (!id || !masihDipilih()) return;
      pilihTujuan();
      setTampilan(TAMPILAN_ANALISA.IMPOR);
      return;
    }
    const keadaan = pekerjaan.snapshot();
    if (!aksi.ulang && aksi.item?.id === keadaan.aktif.id && keadaan.aktif.digunakan &&
      (keadaan.aktif.berjalan || ["selesai", "baru"].includes(aksi.item.status))) {
      pilihTujuan();
      kePapan();
      return;
    }
    const record = await pekerjaan.ambil(aksi.item?.id);
    if (!masihDipilih()) return;
    if (!record || record.jenis !== "laporan" || !["pgn", "fen"].includes(record.sumber?.format) || typeof record.sumber?.string !== "string") {
      pushPageError(setErrors, t("analisa.pekerjaan.rusakJudul"), t("analisa.pekerjaan.rusakIsi"));
      return;
    }
    const snapshot = snapshotLaporanAman(record.snapshot);
    if (!aksi.ulang && !snapshot) {
      setDialog({ jenis: record.snapshot ? "rusak" : "ulang", aksi: { ...aksi, ulang: true } });
      return;
    }
    if (aksi.ulang && !record.sumber.string.trim()) {
      pushPageError(setErrors, t("analisa.pekerjaan.rusakJudul"), t("analisa.pekerjaan.rusakIsi"));
      return;
    }
    setData({
      ...record.sumber,
      pekerjaanId: record.id,
      ...(aksi.ulang ? { rekamAwal: record } : { pemulihan: { ...record, snapshot } }),
    });
    pilihTujuan();
    kePapan();
  }

  function minta(aksi) {
    const nomor = ++permintaanRef.current;
    const tindakan = { ...aksi, asalTampilan: tampilanRef.current, asalTabId: tabAktifRef.current };
    const aktif = pekerjaan.snapshot().aktif;
    const berganti = aksi.jenis === "muat" ||
      (aksi.jenis === "buka" && aksi.item?.jenis === "laporan" && (aksi.ulang || aksi.item.id !== aktif.id)) ||
      (aksi.jenis === "kosong" && aksi.id !== aktif.id);
    if (aktif.berjalan && berganti) {
      setDialog({ jenis: "hentikan", aksi: tindakan });
      return;
    }
    jalankan(tindakan, nomor);
  }

  function bukaRiwayat(item) {
    if (item.jenis !== "fitur") {
      minta({ jenis: "buka", item });
      return;
    }
    if (!Object.hasOwn(KUNCI_FITUR, item.fitur)) return;
    if (item.fitur === TAMPILAN_ANALISA.BERMAIN) {
      const laporan = pekerjaan.snapshot().daftar.find((entry) => entry.jenis === "laporan" && entry.id === item.targetId);
      minta(laporan ? { jenis: "buka", item: laporan } : { jenis: "aktif" });
    } else if (item.fitur === TAMPILAN_ANALISA.IMPOR) {
      minta({ jenis: "buka", item: { jenis: "draf", id: item.targetId } });
    } else {
      setTampilan(item.fitur);
    }
  }

  async function pilihTab(id, hapusId = null) {
    const nomor = ++permintaanRef.current;
    const asalTab = tabAktifRef.current;
    const asalTampilan = tampilanRef.current;
    await pekerjaan.init();
    if (nomor !== permintaanRef.current || tabAktifRef.current !== asalTab || tampilanRef.current !== asalTampilan) return;
    const target = daftarTabRef.current.find((tab) => tab.id === id);
    if (!target || target.id === asalTab) return;
    if (target.tampilan === TAMPILAN_ANALISA.BERMAIN && target.laporanId && target.laporanId !== dataRef.current?.pekerjaanId) {
      const keadaan = pekerjaan.snapshot();
      let item = keadaan.daftar.find((entry) => entry.jenis === "laporan" && entry.id === target.laporanId);
      if (!item) {
        // Metadata yang hilang bukan bukti bahwa isi juga kosong. Baca dulu
        // agar kegagalan storage atau record yatim tidak tertimpa papan baru.
        item = await pekerjaan.ambil(target.laporanId);
        if (nomor !== permintaanRef.current || tabAktifRef.current !== asalTab || tampilanRef.current !== asalTampilan) return;
        if (!item && !pekerjaan.snapshot().tersedia) {
          pushPageError(setErrors, t("analisa.pekerjaan.rusakJudul"), t("analisa.pekerjaan.rusakIsi"));
          return;
        }
      }
      if (item && item.jenis !== "laporan") {
        pushPageError(setErrors, t("analisa.pekerjaan.rusakJudul"), t("analisa.pekerjaan.rusakIsi"));
        return;
      }
      minta(item
        ? { jenis: "buka", item, tabTujuan: id, hapusId }
        : { jenis: "kosong", id: target.laporanId, tabTujuan: id, hapusId });
    } else if (target.tampilan === TAMPILAN_ANALISA.IMPOR) {
      minta({ jenis: "buka", item: { jenis: "draf", id: target.drafId }, tabTujuan: id, hapusId });
    } else {
      if (hapusId) tabTerpasangRef.current.delete(hapusId);
      aktifkan(id, hapusId);
      setTampilan(target.tampilan);
    }
  }

  function tambahTab(hapusId = null) {
    permintaanRef.current += 1;
    setDialog(null);
    if (hapusId) tabTerpasangRef.current.delete(hapusId);
    tambah(hapusId);
    setTampilan(TAMPILAN_ANALISA.PAPAN);
  }

  function tutupTab(id) {
    if (id !== tabAktifRef.current) {
      // Pembacaan target yang baru ditutup tidak boleh selesai belakangan
      // lalu mengganti papan pada tab yang masih aktif.
      permintaanRef.current += 1;
      tabTerpasangRef.current.delete(id);
      hapusLain(id);
      return;
    }
    const indeks = daftarTabRef.current.findIndex((tab) => tab.id === id);
    if (daftarTabRef.current.length <= 1) {
      tambahTab(id);
      return;
    }
    const tujuan = daftarTabRef.current[indeks + 1] ?? daftarTabRef.current[indeks - 1];
    if (tujuan) pilihTab(tujuan.id, id);
  }
  const wadahDialog = typeof document === "undefined" ? undefined : document.querySelector(".analisa-root") ?? undefined;
  return (
    <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col">
      <TabBar daftar={daftarTab} aktifId={aktifId} sibuk={perluPulih} onPilih={pilihTab} onTutup={tutupTab} onTambah={() => tambahTab()} />
      <div id="konten-tab-kerja" role="tabpanel" aria-labelledby={`tab-kerja-${aktifId}`} aria-busy={perluPulih || undefined} className="relative flex min-h-0 w-full flex-1 flex-col">
        {children}
        {perluPulih ? (
          <div role="status" className="absolute inset-0 z-[900] grid place-items-center bg-backgroundBoxDarker text-sm text-foregroundGrey">
            {t("analisa.tabKerja.memulihkan")}
          </div>
        ) : null}
        {daftarTab.map((tab) => {
          const aktif = tab.id === aktifId;
          const layar = aktif ? tampilan : tab.tampilan;
          // Beranda tidak menyimpan formulir; draf impor dibaca ulang agar
          // dua tab yang menunjuk draf yang sama tidak saling menimpa.
          if (perluPulih || !tabTerpasangRef.current.has(tab.id) || layar === TAMPILAN_ANALISA.BERMAIN ||
            (!aktif && [TAMPILAN_ANALISA.PAPAN, TAMPILAN_ANALISA.IMPOR].includes(layar))) return null;
          const masihAktif = () => tabAktifRef.current === tab.id && tampilanRef.current === layar;
          return (
            <div
              key={tab.id}
              ref={aktif ? lapisanRef : null}
              tabIndex={aktif ? -1 : undefined}
              hidden={!aktif}
              data-uji={`layar-${layar}`}
              data-layar={layar}
              className="absolute inset-0 z-[900] min-h-0 overflow-y-auto overflow-x-hidden bg-backgroundBoxDarker"
            >
              <Suspense fallback={<div className="h-full min-h-0 w-full bg-backgroundBox" />}>
                {layar === TAMPILAN_ANALISA.PAPAN ? (
                  <LayarPapan
                    onReport={() => minta({ jenis: "aktif" })}
                    onImpor={keImpor}
                    onBukaPekerjaan={bukaRiwayat}
                  />
                ) : null}
                {layar === TAMPILAN_ANALISA.AKUN ? <LayarAkun aktif={aktif} onTutup={() => { if (masihAktif()) kePapan(); }} /> : null}
                {layar === TAMPILAN_ANALISA.PENGATURAN ? <LayarPengaturan aktif={aktif} /> : null}
                {layar === TAMPILAN_ANALISA.DETEKSI_ENGINE ? (
                  <LayarDeteksiEngine aktif={aktif} onBukaAkun={() => { if (masihAktif()) keAkun(); }} />
                ) : null}
                {layar === TAMPILAN_ANALISA.WAWASAN ? <LayarWawasan aktif={aktif} /> : null}
                {layar === TAMPILAN_ANALISA.BASIS_DATA ? (
                  <LayarDatabase
                    aktif={aktif}
                    onTutup={() => { if (masihAktif()) kePapan(); }}
                    onBukaAkun={() => { if (masihAktif()) keAkun(); }}
                    onAnalisa={(partai) => {
                      if (masihAktif()) minta({ jenis: "muat", data: partai });
                      return false;
                    }}
                  />
                ) : null}
                {layar === TAMPILAN_ANALISA.IMPOR ? (
                  <LayarImpor
                    onTutup={kePapan}
                    onImpor={muatPartai}
                    onSebelumImpor={(lanjut) => { if (masihAktif()) minta({ jenis: "muat", lanjut }); }}
                    drafId={tab.drafId}
                    onDrafId={(id) => catat(tab.id, { drafId: id })}
                  />
                ) : null}
              </Suspense>
            </div>
          );
        })}
        <AlertDialog open={Boolean(dialog)} onOpenChange={(terbuka) => { if (!terbuka) setDialog(null); }}>
          <AlertDialogContent container={wadahDialog} className="border-[#5d5d5d] bg-[#1e1d1c] text-[#dedede] shadow-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-white">
                {t(dialog?.jenis === "hentikan" ? "analisa.pekerjaan.hentikanJudul" : dialog?.jenis === "rusak" ? "analisa.pekerjaan.rusakJudul" : "analisa.pekerjaan.terputusJudul")}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-[#aaa]">
                {t(dialog?.jenis === "hentikan" ? "analisa.pekerjaan.hentikanIsi" : dialog?.jenis === "rusak" ? "analisa.pekerjaan.rusakUlang" : "analisa.pekerjaan.ulangIsi")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="border-[#5d5d5d] bg-[#2a2a2a] text-[#dedede] hover:bg-[#3a3a3a] hover:text-white">{t("analisa.akun.batal")}</AlertDialogCancel>
              <AlertDialogAction
                data-uji="pekerjaan-konfirmasi"
                onClick={() => {
                  const aksi = dialog?.aksi;
                  setDialog(null);
                  if (aksi) jalankan(aksi, ++permintaanRef.current);
                }}
                className="bg-[#81b64c] font-bold text-black hover:bg-[#8bc550]"
              >
                {t(dialog?.jenis === "hentikan" ? "analisa.pekerjaan.hentikanLanjut" : "analisa.pekerjaan.ulang")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

export default function AreaKerja() {
  const [tampilan, setTampilan] = useBoard().tampilan;
  const { bukaImpor, aktifId, perluPulih } = useTabKerja();

  const wadahRef = useRef(null);
  const lapisanRef = useRef(null);
  const awalRef = useRef(true);
  const tabSebelumnyaRef = useRef(aktifId);

  const kePapan = useCallback(
    () => setTampilan(TAMPILAN_ANALISA.BERMAIN),
    [setTampilan],
  );

  const keAkun = useCallback(
    () => setTampilan(TAMPILAN_ANALISA.AKUN),
    [setTampilan],
  );

  const keImpor = useCallback(
    () => { void bukaImpor(); },
    [bukaImpor],
  );

  const papanAktif = tampilan === TAMPILAN_ANALISA.BERMAIN;

  /*
   * Fokus mengikuti layar: saat lapisan non-papan muncul, fokus dibawa ke
   * lapisan supaya pembaca layar mengumumkannya dan tombol Tab mulai dari
   * dalamnya (bukan tersesat di papan `invisible` yang tak bisa difokus).
   * Render pertama dilewati — pengguna belum berpindah ke mana-mana.
   */
  useEffect(() => {
    const bergantiTab = tabSebelumnyaRef.current !== aktifId;
    tabSebelumnyaRef.current = aktifId;
    if (awalRef.current) {
      awalRef.current = false;
      return;
    }
    // Saat memilih tab, biarkan fokus di bilah agar tombol panah tetap bisa
    // dipakai. Navigasi fitur di dalam satu tab tetap memfokuskan layarnya.
    if (!papanAktif && !bergantiTab) lapisanRef.current?.focus({ preventScroll: true });
  }, [tampilan, papanAktif, aktifId]);

  // Escape menutup lapisan kembali ke papan (pintasan papan sendiri sudah
  // dimatikan lewat `tampilanRef` di game.jsx, jadi tak ada konflik).
  useEffect(() => {
    if (papanAktif || perluPulih) return undefined;
    const tekan = (e) => {
      if (e.key === "Escape" && !e.defaultPrevented && !document.querySelector('[role="alertdialog"][data-state="open"]')) kePapan();
    };
    document.addEventListener("keydown", tekan);
    return () => document.removeEventListener("keydown", tekan);
  }, [papanAktif, perluPulih, kePapan]);

  return (
    <div className="relative flex h-full min-h-0 min-w-0 w-full flex-1 flex-col">
      <PeringatanPenyimpanan />
      <LapisanLayar
        tampilan={tampilan}
        lapisanRef={lapisanRef}
        kePapan={kePapan}
        keAkun={keAkun}
        keImpor={keImpor}
      >
        <main
          ref={wadahRef}
          aria-hidden={papanAktif && !perluPulih ? undefined : true}
          className={`relative h-full min-w-0 w-full overflow-y-auto overflow-x-hidden ${papanAktif && !perluPulih ? "" : "invisible"}`}
        >
          <div className="flex h-full w-full flex-col items-center justify-start gap-4 overflow-y-auto p-2 vertical:flex-row vertical:justify-start vertical:gap-2 vertical:overflow-visible vertical:p-4">
            <div className="flex h-full w-min flex-col navTop:flex-row vertical:gap-[10px] gap-[6px]">
              <Game wadah={wadahRef} />
              <BoardMenu />
              <div className="bg-backgroundBox flex-row justify-center rounded-borderRoundness w-full navTop:hidden flex h-12">
                <div className="max-w-[500px] w-full flex flex-row justify-center scale-75">
                  <GameButtons />
                </div>
              </div>
            </div>
            <Menu />
          </div>
        </main>

        {/*
         * Sengaja dipasang SETELAH <main>: efek anak berjalan sesuai urutan
         * mount, dan <PenitipPgn> dulu dieksekusi sesudah efek milik <Game>
         * (ia berada di komponen induk, yang efeknya menyusul anak). Menaruhnya
         * sebelum <main> membalik urutan itu dan membuat posisi awal sempat
         * tampil sebelum PGN titipan dipasang.
         */}
        <PenitipPgn />
        <PencatatFitur tampilan={tampilan} />
      </LapisanLayar>
    </div>
  );
}
