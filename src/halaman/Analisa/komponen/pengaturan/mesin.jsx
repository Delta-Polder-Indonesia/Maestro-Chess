/* Bagian pengaturan fitur Analisa — ditulis untuk ChessClub (bukan port). */
import { memo, useContext, useEffect, useId, useState } from "react";
import { useI18n } from "../../../../lib/i18n.jsx";
import { cariEngine } from "../../../../modul/analisis/mesin.js";
import { gambar } from "../../../../lib/asets.js";
import { useMesin } from "../../../../modul/sesi/mesin.js";
import { AnalyzeContext } from "../../../../modul/sesi/analisa.js";

import { tulis } from "../../../../modul/sesi/preferensi.js";
import Gambar from "../Gambar.jsx";

/**
 * Pilihan engine + kedalaman analisis.
 *
 * Susunan mengikuti kartu Pengaturan Engine di Papan Interaktif: thumbnail
 * (foto + nama berkas + lencana versi/kedalaman), garis "Pengaturan umum",
 * lalu baris Kedalaman + foto 128px. Pemilihan engine dilakukan lewat kartu di
 * panel kiri layar Engine, jadi select Nama dan field Versi tidak direrender
 * di sini. Bagian status khas Analisa (muat/coba lagi, tanpa wasm, memuat)
 * tetap dipertahankan karena engine dimuat sebagai WebAssembly.
 *
 * Engine memakai adaptor EngineCatur + berkas Lite di /public/engine/.
 * Bagian Brilliant-Chess yang membuat Worker
 * sendiri, membaca navigator.hardwareConcurrency, dan menawarkan opsi thread
 * sengaja tidak dipindah — itulah bagian yang bug. Di sini pengguna hanya
 * memilih build Stockfish lokal; unduhan pertamanya ditangguhkan sampai
 * pengguna menekan tombol atau benar-benar membutuhkan analisis.
 */

const IsiPengaturanMesin = memo(function IsiPengaturanMesin({ idEngine, status, galat, siapkan, didukung, opsi, opsiBawaan, ubahOpsi, depth, setDepth }) {
  const { t } = useI18n();
  const depthId = useId();
  const hashId = useId();
  const skillId = useId();
  const waktuId = useId();
  const modeId = useId();
  const nodeId = useId();

  const aktif = cariEngine(idEngine) ?? cariEngine(undefined);
  const siapDipakai = status === "siap";
  const labelMesin = aktif?.label ?? idEngine;
  const versiMesin = /\d+(?:\.\d+)*/.exec(labelMesin)?.[0] ?? "-";
  const namaBerkas = aktif?.url.split("/").pop() ?? "-";
  // useMesin() bisa untuk sementara tidak menyediakan opsi saat engine
  // sedang dibangun ulang; jangan sampai panel ikut hilang.
  const hashMb = Number.isFinite(opsi?.hash) ? opsi.hash : 32;
  const skill = opsi && "skill" in opsi ? opsi.skill : null;
  const movetime = opsi && Number.isFinite(opsi.movetime) ? opsi.movetime : null;
  const mode = opsi?.mode === "waktu" || opsi?.mode === "node" ? opsi.mode : "kedalaman";
  const nodes = Number.isFinite(opsi?.nodes) ? opsi.nodes : 250000;
  const PILIHAN_WAKTU = [1000, 2000, 4000, 8000, 15000, 30000, 60000];
  const PILIHAN_NODE = [50000, 100000, 250000, 500000, 1000000, 2000000];
  const labelNode = (n) => (n >= 1000000
    ? t("analisa.pengaturan.nodeJuta", { n: n / 1000000 })
    : t("analisa.pengaturan.nodeRibu", { n: n / 1000 }));
  // Samakan tinggi dan lebar semua kontrol (pola .text-input/.number-input-wrapper
  // di prompt.md) supaya kolomnya rapi walaupun isinya input atau select.
  const kelasKontrol = "h-[30px] w-full rounded-borderRoundness border border-border bg-[#272727] px-2 text-sm text-foreground outline-none";

  /* State string lokal untuk input angka. Masalah sebelumnya:
     - `terapkanAngka` menolak teks kosong (return), jadi Backspace tidak
       pernah mengosongkan field — value React tetap 6, input tidak bisa
       dihapus.
     - Mengetik '8' saat field masih '6' menghasilkan '68' yang di-clamp
       ke 20, bukannya mengganti.
     Solusinya: simpan mentah sebagai string saat pengguna mengetik,
     izinkan kosong agar Backspace bekerja, baru parse+simpan+clamp
     saat angka valid terbentuk; saat blur nilai yang tidak valid
     dikembalikan ke depth terakhir yang sah. */
  const MIN_D = 6;
  const MAX_D = 20;
  const PILIHAN_HASH = [16, 32, 64, 128];
  const [depthMentah, setDepthMentah] = useState(String(depth));
  useEffect(() => setDepthMentah(String(depth)), [depth]);

  function simpanKedalaman(angka) {
    const n = Math.min(MAX_D, Math.max(MIN_D, Math.round(Number(angka))));
    setDepth(n);
    tulis("kedalaman", n);
  }

  /* Ganti mode pencarian. Mode "waktu" memastikan ada nilai batas waktu
     (bawaan 4 dtk bila belum pernah diset); mode lain menihilkan movetime
     supaya tidak ikut membatasi pencarian. Kedalaman tetap tersimpan di
     state papan sehingga kembali ke mode kedalaman tidak kehilangan nilai. */
  function gantiMode(m) {
    ubahOpsi?.({ mode: m, movetime: m === "waktu" ? (movetime ?? 4000) : null });
  }

  function kembalikanBawaan() {
    const n = 8;
    setDepthMentah(String(n));
    setDepth(n);
    tulis("kedalaman", n);
    ubahOpsi?.({
      hash: opsiBawaan?.hash ?? 32,
      skill: null,
      movetime: null,
      mode: "kedalaman",
      nodes: opsiBawaan?.nodes ?? 250000,
    });
  }

  return (
    <section>
      {didukung ? null : (
        <p className="mx-3 mb-2 rounded-borderRoundness bg-backgroundBoxBox p-2 text-sm text-foregroundGrey">
          {t("analisa.status.tanpaWasm")}
        </p>
      )}

      <div className="flex items-center gap-3 rounded-borderRoundness border border-[#81b64c] bg-backgroundBoxBox p-3">
        <Gambar
          src={gambar("/images/stockfish.webp")}
          alt="Stockfish"
          width={48}
          height={48}
          className="h-12 w-12 shrink-0 rounded-[0.25rem] border border-border object-cover"
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-bold text-foreground">{labelMesin}</span>
          <span className="truncate text-xs text-foregroundGrey">{namaBerkas}</span>
        </div>
        <div className="flex shrink-0 flex-row gap-4">
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-bold uppercase text-foregroundGrey">{t("analisa.pengaturan.versiMesin")}</span>
            <span className="text-sm font-bold text-foreground">{versiMesin}</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-bold uppercase text-foregroundGrey">{t("analisa.pengaturan.kedalaman")}</span>
            <span className="text-sm font-bold text-foreground">{depth}</span>
          </div>
        </div>
      </div>
      {aktif?.keterangan ? <p className="mt-2 text-xs leading-5 text-foregroundGrey">{t(aktif.keterangan)}</p> : null}

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="h-px flex-1 bg-border" />
          <span className="text-xs font-bold text-foregroundGrey">{t("analisa.pengaturan.umum")}</span>
          <span className="h-px flex-1 bg-border" />
        </div>
        <div className="flex items-center gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            {status === "mati" || status === "gagal" ? (
              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => {
                    siapkan().catch((error) => {
                      console.error("Gagal menyiapkan engine analisis:", error);
                    });
                  }}
                  className="w-full h-9 rounded-borderRoundness bg-backgroundBoxBox hover:bg-backgroundBoxBoxHover font-bold text-sm transition-colors"
                >
                  {status === "gagal" ? t("analisa.status.cobaLagi") : t("analisa.status.muat")}
                </button>
                {status === "gagal" && galat ? <p className="text-xs text-highlightMiss break-words">{t("analisa.status.gagal")} — {aktif?.label}</p> : null}
              </div>
            ) : null}
            {!siapDipakai && status === "memuat" ? (
              <p className="text-xs text-foregroundGrey animate-[pulse_1.25s_cubic-bezier(0.4,_0,_0.6,_1)_infinite]">{t("analisa.status.memuat")}</p>
            ) : null}
          </div>
          <Gambar
            src={gambar("/images/stockfish.webp")}
            alt="Stockfish"
            width={96}
            height={96}
            className="h-24 w-24 shrink-0 rounded-[0.4rem] border border-border object-cover"
          />
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-2">
          <div className="flex min-w-0 flex-col gap-1">
            <label htmlFor={modeId} className="text-xs font-bold text-foregroundGrey">{t("analisa.pengaturan.modeCari")}</label>
            <select
              id={modeId}
              value={mode}
              onChange={(e) => gantiMode(e.target.value)}
              className={kelasKontrol}
            >
              <option value="kedalaman">{t("analisa.pengaturan.modeKedalaman")}</option>
              <option value="waktu">{t("analisa.pengaturan.modeWaktu")}</option>
              <option value="node">{t("analisa.pengaturan.modeNode")}</option>
            </select>
          </div>
          {mode === "kedalaman" ? (
          <div className="flex min-w-0 flex-col gap-1">
            <label htmlFor={depthId} className="text-xs font-bold text-foregroundGrey">{t("analisa.pengaturan.kedalaman")}</label>
            <input
              id={depthId}
              type="number"
              min={MIN_D}
              max={MAX_D}
              value={depthMentah}
              onChange={(e) => {
                const teks = e.target.value;
                setDepthMentah(teks);
                // Izinkan kosong (untuk Backspace) dan biarkan user
                // mengetik; hanya simpan bila teks berupa angka
                // finite dalam rentang. Angka di luar rentang
                // sengaja tidak di-clamp saat mengetik (mis. '2'
                // yang ingin jadi '20') — clamp dilakukan saat
                // blur / saat nilai sudah final.
                if (teks.trim() === "") return;
                const n = Number(teks);
                if (!Number.isFinite(n)) return;
                if (n >= MIN_D && n <= MAX_D && String(Math.round(n)) === teks.trim()) {
                  simpanKedalaman(n);
                }
              }}
              onBlur={() => {
                // Saat keluar dari field, pastikan value yang
                // tampil = angka tersimpan yang sah (rentang
                // [MIN_D..MAX_D]). Jika pengguna menutup dengan
                // teks kosong atau angka tak valid, kembalikan ke
                // depth terakhir. Jika angka di luar batas (mis.
                // '200'), clamp ke MAX_D/MIN_D.
                const teks = depthMentah.trim();
                if (teks === "") {
                  setDepthMentah(String(depth));
                  return;
                }
                let n = Math.round(Number(teks));
                if (!Number.isFinite(n)) n = depth;
                n = Math.min(MAX_D, Math.max(MIN_D, n));
                if (n !== depth) simpanKedalaman(n);
                else setDepthMentah(String(n));
              }}
              className={kelasKontrol}
            />
          </div>
          ) : null}
          {mode === "waktu" ? (
          <div className="flex min-w-0 flex-col gap-1">
            <label htmlFor={waktuId} className="text-xs font-bold text-foregroundGrey">{t("analisa.pengaturan.batasWaktu")}</label>
            <select
              id={waktuId}
              value={movetime === null ? 4000 : movetime}
              onChange={(e) => ubahOpsi?.({ movetime: Number(e.target.value) })}
              className={kelasKontrol}
            >
              {(movetime === null || PILIHAN_WAKTU.includes(movetime) ? PILIHAN_WAKTU : [movetime, ...PILIHAN_WAKTU]).map((n) => (
                <option key={n} value={n}>{n / 1000} s</option>
              ))}
            </select>
          </div>
          ) : null}
          {mode === "node" ? (
          <div className="flex min-w-0 flex-col gap-1">
            <label htmlFor={nodeId} className="text-xs font-bold text-foregroundGrey">{t("analisa.pengaturan.batasNode")}</label>
            <select
              id={nodeId}
              value={nodes}
              onChange={(e) => ubahOpsi?.({ nodes: Number(e.target.value) })}
              className={kelasKontrol}
            >
              {(PILIHAN_NODE.includes(nodes) ? PILIHAN_NODE : [nodes, ...PILIHAN_NODE]).map((n) => (
                <option key={n} value={n}>{labelNode(n)}</option>
              ))}
            </select>
          </div>
          ) : null}
          <div className="flex min-w-0 flex-col gap-1">
            <label htmlFor={hashId} className="text-xs font-bold text-foregroundGrey">{t("analisa.pengaturan.hashMb")}</label>
            <select
              id={hashId}
              value={hashMb}
              onChange={(e) => ubahOpsi?.({ hash: Number(e.target.value) })}
              className={kelasKontrol}
            >
              {(PILIHAN_HASH.includes(hashMb) ? PILIHAN_HASH : [hashMb, ...PILIHAN_HASH]).map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <label htmlFor={skillId} className="text-xs font-bold text-foregroundGrey">{t("analisa.pengaturan.skill")}</label>
            <select
              id={skillId}
              value={skill === null ? "bawaan" : skill}
              onChange={(e) => ubahOpsi?.({ skill: e.target.value === "bawaan" ? null : Number(e.target.value) })}
              className={kelasKontrol}
            >
              <option value="bawaan">{t("analisa.pengaturan.skillBawaan")}</option>
              {Array.from({ length: 21 }, (_, n) => n).map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            onClick={kembalikanBawaan}
            className="h-[30px] rounded-borderRoundness border border-border bg-backgroundBoxBoxHover px-3 text-xs font-bold text-foreground transition-colors"
          >
            {t("analisa.pengaturan.reset")}
          </button>
        </div>
      </div>
    </section>
  );
});

// Progress/gerakan papan tidak boleh membangun ulang kartu engine. Pilih
// kedalaman saja sebelum melewati batas memo.
function PengaturanMesin() {
  const { idEngine, status, galat, siapkan, didukung, opsi, opsiBawaan, ubahOpsi } = useMesin();
  const analyzeContext = useContext(AnalyzeContext);
  const [depth, setDepth] = analyzeContext.depth;
  return <IsiPengaturanMesin idEngine={idEngine} status={status} galat={galat} siapkan={siapkan} didukung={didukung} opsi={opsi} opsiBawaan={opsiBawaan} ubahOpsi={ubahOpsi} depth={depth} setDepth={setDepth} />;
}

export default memo(PengaturanMesin);
