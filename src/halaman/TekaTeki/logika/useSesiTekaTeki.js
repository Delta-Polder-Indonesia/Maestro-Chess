/**
 * Hook sesi teka-teki — mengatur alur latihan seperti layar puzzle En Croissant
 * (GPL-3.0), ditulis ulang di atas modul bersama `src/modul/tekaTeki`:
 *
 *  1. sumber dimuat malas, satu soal dipilih menurut rentang rating/tema;
 *  2. langkah pembuka lawan dimainkan otomatis, pemain membalas;
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
import { useCallback, useEffect, useRef, useState } from "react";
import {
  muatSoal, pilihSoal, rentangProgresif, posisiAwalPemain, nilaiLangkah, terapkanLangkah,
  petunjukBerikutnya, langkahDiharapkan, buatEntri, hitungStatistik, STATUS_SOAL,
} from "../../../modul/tekaTeki/index.js";

const JEDA_SOLUSI = 450;

export default function useSesiTekaTeki({
  sumber = "skakmat", ratingMin = 1000, ratingMax = 1500, tema = "",
  progresif = false, lompatCepat = true, catatWaktu = true,
} = {}) {
  const [daftar, setDaftar] = useState([]);
  const [memuat, setMemuat] = useState(true);
  const [soal, setSoal] = useState(null);
  const [fen, setFen] = useState("");
  const [indeks, setIndeks] = useState(1);
  const [riwayat, setRiwayat] = useState([]);
  const [aktif, setAktif] = useState(-1);
  const [pesan, setPesan] = useState("");
  const [petunjuk, setPetunjuk] = useState({ tingkat: "kosong", petak: null, panah: null });
  const [mulai, setMulai] = useState(null);
  const [waktu, setWaktu] = useState(0);
  const [solusiBerjalan, setSolusiBerjalan] = useState(false);
  // Jalur solusi sudah dituntaskan (langkah terakhir atau lihat solusi).
  // Terpisah dari status benar/salah: soal yang salah tetap boleh dilanjutkan.
  const [jalurSelesai, setJalurSelesai] = useState(false);
  const batalSolusi = useRef(null);
  // Cermin riwayat untuk memilih soal tanpa menunggu render berikutnya.
  const riwayatRef = useRef([]);
  riwayatRef.current = riwayat;

  const bukaSoal = useCallback((dipilih, entri = null) => {
    batalSolusi.current?.abort?.();
    setSolusiBerjalan(false);
    setSoal(dipilih);
    setFen(posisiAwalPemain(dipilih.fen, dipilih.langkah));
    setIndeks(1);
    setPetunjuk({ tingkat: "kosong", petak: null, panah: null });
    setPesan("");
    // Soal yang dibuka ulang dari riwayat mempertahankan waktu tersimpan;
    // pewaktu hanya hidup untuk soal yang belum ditandai.
    const statusEntri = entri?.status ?? STATUS_SOAL.BELUM;
    setWaktu(entri?.waktu ?? 0);
    setMulai(catatWaktu && statusEntri === STATUS_SOAL.BELUM ? Date.now() : null);
    setJalurSelesai(statusEntri === STATUS_SOAL.BENAR);
  }, [catatWaktu]);

  const soalBaru = useCallback((kolam = daftar, dasarRating = null) => {
    if (!kolam.length) return null;
    const [bawah, atas] = progresif && dasarRating !== null
      ? rentangProgresif(dasarRating)
      : [ratingMin, ratingMax];
    const terpakai = riwayatRef.current.map((entri) => entri.id);
    const dipilih = pilihSoal(kolam, { terpakai, ratingMin: bawah, ratingMax: atas, tema: tema || null });
    if (!dipilih) { setSoal(null); setFen(""); setPesan("kosong"); return null; }
    const entri = buatEntri(dipilih);
    setRiwayat((lama) => [...lama, entri]);
    setAktif(riwayatRef.current.length);
    bukaSoal(dipilih, entri);
    return dipilih;
  }, [daftar, progresif, ratingMin, ratingMax, tema, bukaSoal]);

  // Muat sumber lalu buka soal pertama. Pergantian sumber memulai sesi baru.
  useEffect(() => {
    let hidup = true;
    setMemuat(true);
    muatSoal(sumber).then((hasil) => {
      if (!hidup) return;
      setDaftar(hasil);
      setMemuat(false);
      setRiwayat([]);
      riwayatRef.current = [];
      setAktif(-1);
      if (!hasil.length) { setSoal(null); setFen(""); setPesan("gagal"); return; }
      const dipilih = pilihSoal(hasil, {
        ratingMin, ratingMax, tema: tema || null,
      });
      if (!dipilih) { setSoal(null); setFen(""); setPesan("kosong"); return; }
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

  const status = riwayat[aktif]?.status ?? STATUS_SOAL.BELUM;
  // Papan boleh dimainkan selama jalur belum selesai dan soal belum benar —
  // soal yang sudah ditandai salah tetap bisa dilanjutkan (paritas En Croissant).
  const belumSelesai = !jalurSelesai && status !== STATUS_SOAL.BENAR;

  // Pewaktu tampilan: hanya berjalan saat soal belum selesai dan waktu dicatat.
  useEffect(() => {
    if (!catatWaktu || !belumSelesai || mulai === null) return undefined;
    const id = setInterval(() => setWaktu(Date.now() - mulai), 200);
    return () => clearInterval(id);
  }, [catatWaktu, belumSelesai, mulai]);

  const tandai = useCallback((status) => {
    const dipakai = mulai !== null ? Date.now() - mulai : 0;
    setWaktu(dipakai);
    setMulai(null);
    setRiwayat((lama) => lama.map((entri, i) => (
      i === aktif ? { ...entri, status, waktu: dipakai, tema: soal?.tema ?? [] } : entri
    )));
  }, [aktif, mulai, soal]);

  /** Dipanggil papan saat pemain melepas bidak: (fen, {from,to,promotion}). */
  const mainkan = useCallback((langkah) => {
    if (!soal || !belumSelesai || solusiBerjalan) return;
    const hasil = nilaiLangkah({ fen, langkahSoal: soal.langkah, indeks, pemain: langkah });
    if (!hasil.sah) return;
    if (!hasil.benar) {
      // Hanya tanda pertama yang menghentikan pewaktu dan mencatat waktu.
      if (status === STATUS_SOAL.BELUM) tandai(STATUS_SOAL.SALAH);
      setPesan("salah");
      return;
    }
    let posisi = hasil.fenBaru;
    let berikutnya = indeks + 1;
    if (hasil.balasan) {
      posisi = terapkanLangkah(posisi, hasil.balasan);
      berikutnya = indeks + 2;
    }
    setFen(posisi);
    setIndeks(berikutnya);
    setPetunjuk({ tingkat: "kosong", petak: null, panah: null });
    if (!hasil.selesai) { setPesan("benar"); return; }
    setJalurSelesai(true);
    // Soal yang sudah salah tetap tercatat salah meski jalur dituntaskan.
    if (status === STATUS_SOAL.BELUM) tandai(STATUS_SOAL.BENAR);
    setPesan("selesai");
    if (lompatCepat) soalBaru(daftar, soal.rating);
  }, [soal, belumSelesai, solusiBerjalan, fen, indeks, status, tandai, lompatCepat, soalBaru, daftar]);

  const ambilPetunjuk = useCallback(() => {
    if (!soal || !belumSelesai || solusiBerjalan) return;
    const diharapkan = langkahDiharapkan(soal.langkah, indeks);
    setPetunjuk((lama) => petunjukBerikutnya(lama.tingkat, diharapkan));
    // Memakai petunjuk berarti soal tidak lagi dihitung benar.
    if (status === STATUS_SOAL.BELUM) tandai(STATUS_SOAL.SALAH);
    setPesan("salah");
  }, [soal, belumSelesai, solusiBerjalan, indeks, status, tandai]);

  const lihatSolusi = useCallback(async () => {
    if (!soal || solusiBerjalan) return;
    if (status === STATUS_SOAL.BELUM) tandai(STATUS_SOAL.SALAH);
    setJalurSelesai(true);
    const pengendali = new AbortController();
    batalSolusi.current = pengendali;
    setSolusiBerjalan(true);
    setPetunjuk({ tingkat: "kosong", petak: null, panah: null });
    let posisi = posisiAwalPemain(soal.fen, soal.langkah);
    setFen(posisi);
    for (let i = 1; i < soal.langkah.length; i++) {
      if (pengendali.signal.aborted) break;
      posisi = terapkanLangkah(posisi, soal.langkah[i]);
      setFen(posisi);
      setIndeks(i + 1);
      await new Promise((selesaiJeda) => setTimeout(selesaiJeda, JEDA_SOLUSI));
    }
    if (!pengendali.signal.aborted) { setSolusiBerjalan(false); setPesan("solusi"); }
  }, [soal, solusiBerjalan, status, tandai]);

  const bersihkanSesi = useCallback(() => {
    batalSolusi.current?.abort?.();
    setRiwayat([]);
    riwayatRef.current = [];
    setAktif(-1);
    soalBaru(daftar, null);
  }, [daftar, soalBaru]);

  const pilihRiwayat = useCallback((i) => {
    const entri = riwayat[i];
    if (!entri) return;
    const ditemukan = daftar.find((item) => item.id === entri.id);
    if (!ditemukan) return;
    setAktif(i);
    bukaSoal(ditemukan, entri);
  }, [riwayat, daftar, bukaSoal]);

  return {
    memuat, soal, fen, indeks, riwayat, aktif, pesan, petunjuk, waktu, solusiBerjalan,
    statistik: hitungStatistik(riwayat),
    status, belumSelesai,
    mainkan, ambilPetunjuk, lihatSolusi, soalBaru: () => soalBaru(daftar, soal?.rating ?? null),
    bersihkanSesi, pilihRiwayat,
  };
}
