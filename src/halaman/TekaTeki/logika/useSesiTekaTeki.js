/**
 * Hook sesi teka-teki — mengatur alur latihan seperti layar puzzle En Croissant
 * (GPL-3.0), ditulis ulang di atas modul bersama `src/modul/tekaTeki`:
 *
 *  1. sumber dimuat malas, satu soal dipilih menurut rentang rating/tema;
 *  2. pemain jalan lebih dulu pada FEN soal (langkah[0] milik pemain);
 *  3. langkah benar → balasan lawan otomatis; langkah terakhir → soal selesai;
 *  4. langkah salah tidak memajukan posisi dan menandai soal salah, tetapi
 *     latihan tetap bisa dilanjutkan sampai jalur solusi selesai (paritas
 *     En Croissant: papan hanya terkunci bila soal sudah benar/selesai);
 *  5. petunjuk bertingkat (petak → panah → hapus) dan lihat solusi menandai
 *     soal salah bila belum ditandai; waktu berhenti pada tanda pertama;
 *  6. mode progresif menaikkan rentang dari rating soal terakhir; lompat cepat
 *     membuka soal berikutnya begitu jalur selesai; waktu dicatat bila diminta.
 *
 * Semua aturan main tinggal di modul bersama; hook ini hanya orkestrasi state.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  muatSoal, pilihSoal, daftarTema, rentangProgresif, posisiAwalPemain, nilaiLangkah, terapkanLangkah,
  petunjukBerikutnya, langkahDiharapkan, buatEntri, hitungStatistik, STATUS_SOAL,
} from "../../../modul/tekaTeki/index.js";
import { GESER_ISEPIC } from "../animasiBidak.js";

const JEDA_SOLUSI = 450;

export default function useSesiTekaTeki({
  sumber = "skakmat", ratingMin = 1000, ratingMax = 1500, tema = "",
  progresif = false, lompatCepat = true, catatWaktu = true,
} = {}) {
  const [daftar, setDaftar] = useState([]);
  const [memuat, setMemuat] = useState(true);
  const [soal, setSoal] = useState(null);
  const [fen, setFen] = useState("");
  const [indeks, setIndeks] = useState(0);
  // Langkah yang benar-benar dimainkan (pemain + balasan lawan yang diterapkan).
  // Jalur solusi awal tidak selalu sama dengan jalur yang dimainkan: skakmat
  // alternatif mengakhiri soal lebih cepat, jadi jejak langkah perlu jalur nyata.
  const [langkahNyata, setLangkahNyata] = useState([]);
  const [riwayat, setRiwayat] = useState([]);
  const [aktif, setAktif] = useState(-1);
  const [pesan, setPesan] = useState("");
  const [petunjuk, setPetunjuk] = useState({ tingkat: "kosong", petak: null, panah: null });
  const [mulai, setMulai] = useState(null);
  const [waktu, setWaktu] = useState(0);
  // Waktu yang sudah dikumpulkan SEBELUM segmen berjalan sekarang. Pewaktu
  // dijumlahkan dari sini, bukan dari satu timestamp tunggal: saat pencatatan
  // dimatikan lalu dinyalakan lagi, jeda itu tidak boleh ikut terhitung.
  const terekam = useRef(0);
  const mulaiRef = useRef(null);
  mulaiRef.current = mulai;
  const [solusiBerjalan, setSolusiBerjalan] = useState(false);
  // Rangkaian balasan otomatis sedang meluncur: papan terkunci sebentar supaya
  // langkah baru tidak bertabrakan dengan animasi yang belum selesai.
  const [balasanBerjalan, setBalasanBerjalan] = useState(false);
  const batalBalasan = useRef(null);
  // Jalur solusi sudah dituntaskan (langkah terakhir atau lihat solusi).
  // Terpisah dari status benar/salah: soal yang salah tetap boleh dilanjutkan.
  const [jalurSelesai, setJalurSelesai] = useState(false);
  const batalSolusi = useRef(null);
  // Cermin riwayat untuk memilih soal tanpa menunggu render berikutnya.
  const riwayatRef = useRef([]);
  riwayatRef.current = riwayat;

  // Katalog tema diambil dari kolam yang SUDAH dimuat untuk sumber aktif, jadi
  // tidak ada unduhan tambahan dan tema sumber lain tidak pernah tercampur.
  // Sumber harian tidak punya tema → katalognya kosong.
  const temaTersedia = useMemo(() => daftarTema(daftar), [daftar]);
  // Tema yang tidak ditawarkan sumber aktif tidak dipakai menyaring; kalau
  // dipaksakan, seluruh soal terbuang dan layar berhenti di "kosong".
  const temaAktif = tema && temaTersedia.includes(tema) ? tema : "";

  // Batalkan rangkaian balasan yang sedang berjalan (timer + janji jedanya).
  const batalkanBalasan = useCallback(() => {
    batalBalasan.current?.abort?.();
    batalBalasan.current = null;
  }, []);

  // Jeda sepanjang luncuran papan, dibaca dari tetapan yang SAMA dengan yang
  // dipakai papan saat memanggil animate(). Abort menyelesaikan janji lebih
  // awal supaya pemanggil tidak menggantung saat soal berganti/unmount.
  const jedaLuncuran = useCallback((pengendali) => new Promise((resolve) => {
    const id = setTimeout(resolve, GESER_ISEPIC.durasi);
    pengendali.signal.addEventListener("abort", () => { clearTimeout(id); resolve(); }, { once: true });
  }), []);

  // Satu pintu pembersihan sesi aktif. Dipakai saat sumber berganti dan saat
  // tidak ada soal yang lolos saringan, supaya keadaan kosong selalu sama:
  // tanpa soal, tanpa progres, tanpa petunjuk, dan TANPA pewaktu yang hidup.
  // Riwayat/daftar/pesan sengaja tidak disentuh di sini — pemanggil yang
  // menentukan (ganti sumber memulai sesi baru; saringan kosong mempertahankan
  // riwayat beserta statistiknya).
  const kosongkanSesi = useCallback(() => {
    batalSolusi.current?.abort?.();
    batalkanBalasan();
    setBalasanBerjalan(false);
    setSolusiBerjalan(false);
    setSoal(null);
    setFen("");
    setIndeks(0);
    setLangkahNyata([]);
    setPetunjuk({ tingkat: "kosong", petak: null, panah: null });
    setJalurSelesai(false);
    setAktif(-1);
    terekam.current = 0;
    setWaktu(0);
    setMulai(null);
  }, [batalkanBalasan]);

  const bukaSoal = useCallback((dipilih, entri = null) => {
    batalSolusi.current?.abort?.();
    batalkanBalasan();
    setBalasanBerjalan(false);
    setSolusiBerjalan(false);
    setSoal(dipilih);
    setFen(posisiAwalPemain(dipilih.fen));
    setIndeks(0);
    setLangkahNyata([]);
    setPetunjuk({ tingkat: "kosong", petak: null, panah: null });
    setPesan("");
    // Soal yang dibuka ulang dari riwayat mempertahankan waktu tersimpan;
    // pewaktu hanya hidup untuk soal yang belum ditandai.
    const statusEntri = entri?.status ?? STATUS_SOAL.BELUM;
    terekam.current = entri?.waktu ?? 0;
    setWaktu(terekam.current);
    setMulai(catatWaktu && statusEntri === STATUS_SOAL.BELUM ? Date.now() : null);
    setJalurSelesai(statusEntri === STATUS_SOAL.BENAR);
  }, [catatWaktu, batalkanBalasan]);

  const soalBaru = useCallback((kolam = daftar, dasarRating = null) => {
    if (!kolam.length) return null;
    const [bawah, atas] = progresif && dasarRating !== null
      ? rentangProgresif(dasarRating)
      : [ratingMin, ratingMax];
    const terpakai = riwayatRef.current.map((entri) => entri.id);
    const dipilih = pilihSoal(kolam, { terpakai, ratingMin: bawah, ratingMax: atas, tema: temaAktif || null });
    if (!dipilih) {
      // Tidak ada kandidat: sesi lama wajib dibersihkan seluruhnya. Sebelumnya
      // hanya soal/fen yang dihapus sehingga pewaktu lama terus berjalan dan
      // progres soal lama masih dianggap sesi aktif.
      kosongkanSesi();
      setPesan("kosong");
      return null;
    }
    const entri = buatEntri(dipilih);
    setRiwayat((lama) => [...lama, entri]);
    setAktif(riwayatRef.current.length);
    bukaSoal(dipilih, entri);
    return dipilih;
  }, [daftar, progresif, ratingMin, ratingMax, temaAktif, bukaSoal, kosongkanSesi]);

  // Muat sumber lalu buka soal pertama. Pergantian sumber memulai sesi baru.
  useEffect(() => {
    let hidup = true;
    setMemuat(true);
    // Sesi sumber lama dibersihkan SEBELUM menunggu unduhan. Kalau soal/FEN
    // lama dibiarkan, papan masih bisa dimainkan selama sumber baru dimuat dan
    // langkahnya tercatat ke soal sumber lama; pewaktu lama juga terus berjalan.
    // Ganti sumber juga memulai riwayat baru, berbeda dari saringan kosong.
    kosongkanSesi();
    setDaftar([]);
    setPesan("");
    setRiwayat([]);
    riwayatRef.current = [];
    muatSoal(sumber).then((hasil) => {
      // Respons sumber yang sudah ditinggalkan tidak boleh menimpa sumber aktif.
      if (!hidup) return;
      setDaftar(hasil);
      setMemuat(false);
      if (!hasil.length) { setPesan("gagal"); return; }
      // Tema dinilai terhadap sumber yang baru dimuat, bukan kolam sebelumnya.
      const temaSumber = tema && daftarTema(hasil).includes(tema) ? tema : null;
      const dipilih = pilihSoal(hasil, { ratingMin, ratingMax, tema: temaSumber });
      if (!dipilih) { setPesan("kosong"); return; }
      const entri = buatEntri(dipilih);
      setRiwayat([entri]);
      riwayatRef.current = [entri];
      setAktif(0);
      bukaSoal(dipilih, entri);
    });
    return () => { hidup = false; batalSolusi.current?.abort?.(); };
    // Saringan sengaja tidak menjadi dependensi: mengubah rating/tema berlaku
    // untuk soal BERIKUTNYA, bukan mengganti soal yang sedang dikerjakan.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sumber]);

  // Rangkaian balasan tidak boleh hidup melewati umur komponen.
  useEffect(() => () => batalkanBalasan(), [batalkanBalasan]);

  const status = riwayat[aktif]?.status ?? STATUS_SOAL.BELUM;
  // Papan boleh dimainkan selama jalur belum selesai dan soal belum benar —
  // soal yang sudah ditandai salah tetap bisa dilanjutkan (paritas En Croissant).
  // Tanpa soal aktif tidak ada sesi yang "belum selesai": keadaan kosong tidak
  // boleh menghidupkan pewaktu maupun menyatakan sesi lama masih berjalan.
  const belumSelesai = !!soal && !jalurSelesai && status !== STATUS_SOAL.BENAR;

  // Nyalakan/matikan pencatatan di tengah soal. Mematikan membekukan waktu yang
  // sudah terkumpul; menyalakan melanjutkan dari angka itu. Tanpa ini, mematikan
  // lalu menyalakan menghitung seluruh jeda (Date.now() - mulai lama), dan soal
  // yang dibuka saat pencatatan mati tidak pernah mulai menghitung saat dinyalakan.
  useEffect(() => {
    const berjalan = mulaiRef.current;
    if (!catatWaktu) {
      if (berjalan !== null) {
        terekam.current += Date.now() - berjalan;
        setWaktu(terekam.current);
        setMulai(null);
      }
      return;
    }
    // Hanya untuk soal yang benar-benar sudah terbuka, bukan selama memuat.
    if (berjalan === null && soal && belumSelesai && status === STATUS_SOAL.BELUM) setMulai(Date.now());
  }, [catatWaktu, belumSelesai, status, soal]);

  // Pewaktu tampilan: hanya berjalan saat soal belum selesai dan waktu dicatat.
  useEffect(() => {
    if (!catatWaktu || !belumSelesai || mulai === null) return undefined;
    const id = setInterval(() => setWaktu(terekam.current + (Date.now() - mulai)), 200);
    return () => clearInterval(id);
  }, [catatWaktu, belumSelesai, mulai]);

  const tandai = useCallback((status) => {
    const dipakai = terekam.current + (mulai !== null ? Date.now() - mulai : 0);
    terekam.current = dipakai;
    setWaktu(dipakai);
    setMulai(null);
    setRiwayat((lama) => lama.map((entri, i) => (
      i === aktif ? { ...entri, status, waktu: dipakai, tema: soal?.tema ?? [] } : entri
    )));
  }, [aktif, mulai, soal]);

  /**
   * Dipanggil papan saat pemain melepas bidak/klik tujuan: ({from,to,promotion}).
   *
   * Langkah pemain dinilai seperti biasa, tetapi balasan lawan diterbitkan
   * sebagai perubahan FEN TERSENDIRI setelah luncuran bidak pemain selesai.
   *
   * Mengapa: papan menyimpulkan luncuran dari perbedaan FEN, dan
   * `geseranDariFen` menolak perubahan yang menggerakkan dua warna sekaligus
   * (pengaman itu benar — satu langkah catur hanya memindahkan satu warna).
   * Menerapkan pemain + balasan dalam satu `setFen` karena itu menghasilkan
   * daftar luncuran kosong dan kedua bidak "teleport". Pemeriksa dua warna
   * TIDAK dilonggarkan; urutan penerbitan FEN yang dipisah di sini.
   *
   * Jeda dibaca dari `GESER_ISEPIC.durasi` — tetapan yang sama dipakai
   * `animate()` papan — jadi bukan angka arbitrer dan tidak bisa melenceng
   * dari durasi luncuran sebenarnya.
   */
  const mainkan = useCallback(async (langkah) => {
    // `batalBalasan.current` dipasang sinkron sebelum jeda pertama, jadi dua
    // klik cepat tidak bisa lolos bersamaan menunggu state React ter-commit.
    if (!soal || !belumSelesai || solusiBerjalan || balasanBerjalan || batalBalasan.current) return;
    const hasil = nilaiLangkah({ fen, langkahSoal: soal.langkah, indeks, pemain: langkah });
    if (!hasil.sah) return;
    if (!hasil.benar) {
      // Hanya tanda pertama yang menghentikan pewaktu dan mencatat waktu.
      if (status === STATUS_SOAL.BELUM) tandai(STATUS_SOAL.SALAH);
      setPesan("salah");
      return;
    }
    const langkahPemain = { from: langkah.from, to: langkah.to, promotion: langkah.promotion };
    setPetunjuk({ tingkat: "kosong", petak: null, panah: null });
    // Status/waktu dicatat pada SAAT langkah pemain dimainkan, bukan setelah
    // animasi: durasi luncuran tidak boleh ikut terhitung sebagai waktu berpikir.
    const tandaiSelesai = () => {
      if (!hasil.selesai) { setPesan("benar"); return; }
      setJalurSelesai(true);
      // Soal yang sudah salah tetap tercatat salah meski jalur dituntaskan.
      if (status === STATUS_SOAL.BELUM) tandai(STATUS_SOAL.BENAR);
      setPesan("selesai");
    };

    if (!hasil.balasan) {
      setFen(hasil.fenBaru);
      setIndeks(indeks + 1);
      setLangkahNyata((lama) => [...lama, langkahPemain]);
      tandaiSelesai();
      if (hasil.selesai && lompatCepat) soalBaru(daftar, soal.rating);
      return;
    }

    const posisiAkhir = terapkanLangkah(hasil.fenBaru, hasil.balasan);
    const pengendali = new AbortController();
    batalBalasan.current = pengendali;
    setBalasanBerjalan(true);
    // 1) Penerbitan langkah pemain saja → papan meluncurkan bidak pemain.
    setFen(hasil.fenBaru);
    setIndeks(indeks + 1);
    setLangkahNyata((lama) => [...lama, langkahPemain]);
    tandaiSelesai();

    await jedaLuncuran(pengendali);
    if (pengendali.signal.aborted) return; // soal berganti/dibatalkan: jangan terapkan balasan
    // 2) Balasan lawan sebagai FEN tersendiri → luncuran kedua, bukan lompatan gabungan.
    setFen(posisiAkhir);
    setIndeks(indeks + 2);
    setLangkahNyata((lama) => [...lama, hasil.balasan]);

    if (hasil.selesai && lompatCepat) {
      // Luncuran balasan dibiarkan selesai dulu; kalau soal berikutnya langsung
      // dibuka, FEN-nya menimpa posisi ini dan balasan tidak pernah terlihat.
      await jedaLuncuran(pengendali);
      if (pengendali.signal.aborted) return;
      batalBalasan.current = null;
      setBalasanBerjalan(false);
      soalBaru(daftar, soal.rating);
      return;
    }
    batalBalasan.current = null;
    setBalasanBerjalan(false);
  }, [soal, belumSelesai, solusiBerjalan, balasanBerjalan, fen, indeks, status, tandai, lompatCepat, soalBaru, daftar, jedaLuncuran]);

  const ambilPetunjuk = useCallback(() => {
    // Selama balasan lawan meluncur, indeks sudah maju ke langkah lawan;
    // petunjuk saat itu akan menunjuk langkah yang bukan milik pemain.
    if (!soal || !belumSelesai || solusiBerjalan || balasanBerjalan) return;
    const diharapkan = langkahDiharapkan(soal.langkah, indeks);
    setPetunjuk((lama) => petunjukBerikutnya(lama.tingkat, diharapkan));
    // Memakai petunjuk berarti soal tidak lagi dihitung benar.
    if (status === STATUS_SOAL.BELUM) tandai(STATUS_SOAL.SALAH);
    setPesan("salah");
  }, [soal, belumSelesai, solusiBerjalan, balasanBerjalan, indeks, status, tandai]);

  const lihatSolusi = useCallback(async () => {
    if (!soal || solusiBerjalan || balasanBerjalan) return;
    if (status === STATUS_SOAL.BELUM) tandai(STATUS_SOAL.SALAH);
    setJalurSelesai(true);
    const pengendali = new AbortController();
    batalSolusi.current = pengendali;
    setSolusiBerjalan(true);
    setPetunjuk({ tingkat: "kosong", petak: null, panah: null });
    let posisi = posisiAwalPemain(soal.fen);
    setFen(posisi);
    for (let i = 0; i < soal.langkah.length; i++) {
      if (pengendali.signal.aborted) break;
      posisi = terapkanLangkah(posisi, soal.langkah[i]);
      setFen(posisi);
      setIndeks(i + 1);
      setLangkahNyata(soal.langkah.slice(0, i + 1));
      await new Promise((selesaiJeda) => setTimeout(selesaiJeda, JEDA_SOLUSI));
    }
    if (!pengendali.signal.aborted) { setSolusiBerjalan(false); setPesan("solusi"); }
  }, [soal, solusiBerjalan, balasanBerjalan, status, tandai]);

  const bersihkanSesi = useCallback(() => {
    batalSolusi.current?.abort?.();
    // `soalBaru` kembali lebih awal bila kolam kosong, jadi rangkaian balasan
    // dibatalkan di sini juga — bukan hanya lewat bukaSoal/kosongkanSesi.
    batalkanBalasan();
    setBalasanBerjalan(false);
    setRiwayat([]);
    riwayatRef.current = [];
    setAktif(-1);
    soalBaru(daftar, null);
  }, [daftar, soalBaru, batalkanBalasan]);

  const pilihRiwayat = useCallback((i) => {
    const entri = riwayat[i];
    if (!entri) return;
    const ditemukan = daftar.find((item) => item.id === entri.id);
    if (!ditemukan) return;
    setAktif(i);
    bukaSoal(ditemukan, entri);
  }, [riwayat, daftar, bukaSoal]);

  // Ulangi soal aktif sebagai percobaan baru: entri dicatat ulang belum dikerjakan
  // (waktu nol), papan kembali ke posisi awal pemain dan terbuka untuk dimainkan.
  const ulangSoal = useCallback(() => {
    if (!soal) return;
    batalSolusi.current?.abort?.();
    const entri = buatEntri(soal);
    setRiwayat((lama) => lama.map((e, i) => (i === aktif ? entri : e)));
    bukaSoal(soal, entri);
  }, [soal, aktif, bukaSoal]);

  return {
    memuat, soal, fen, indeks, langkahNyata, riwayat, aktif, pesan, petunjuk, waktu, solusiBerjalan,
    // Rangkaian balasan otomatis masih meluncur → papan dikunci sebentar.
    balasanBerjalan,
    temaTersedia,
    statistik: hitungStatistik(riwayat),
    status, belumSelesai,
    mainkan, ambilPetunjuk, lihatSolusi, soalBaru: () => soalBaru(daftar, soal?.rating ?? null),
    bersihkanSesi, pilihRiwayat, ulangSoal,
  };
}
