/**
 * Panel bawah puzzle (pola En Croissant): daftar langkah soal aktif dalam
 * notasi SAN yang bisa diklik untuk meninjau posisi, plus baris navigasi
 * << < > >>. Meninjau posisi lama mengunci papan sampai kembali ke langkah
 * terakhir (live), sama seperti menelusuri pohon langkah di papan puzzle.
 */
function IkonNav({ arah }) {
  const umum = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", className: "h-[15px] w-[15px]", "aria-hidden": true };
  if (arah === "awal") return <svg {...umum}><polyline points="11 17 6 12 11 7" /><polyline points="18 17 13 12 18 7" /></svg>;
  if (arah === "sebelum") return <svg {...umum}><polyline points="15 18 9 12 15 6" /></svg>;
  if (arah === "berikut") return <svg {...umum}><polyline points="9 18 15 12 9 6" /></svg>;
  return <svg {...umum}><polyline points="13 17 18 12 13 7" /><polyline points="6 17 11 12 6 7" /></svg>;
}

function TombolNav({ label, arah, onClick, disabled }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="flex h-[34px] items-center justify-center rounded-borderRoundness border border-border bg-backgroundDropdown text-foreground transition-colors hover:bg-backgroundBoxBoxHover disabled:cursor-not-allowed disabled:opacity-40"
    ><IkonNav arah={arah} /></button>
  );
}

export default function RiwayatLangkah({ t, jejak, tinjau, onTinjau, onNavigasi }) {
  const lastIndex = jejak.length - 1;
  const langkah = jejak.slice(1);
  const kosong = langkah.length === 0;
  const diAwal = tinjau <= 0;
  const diAkhir = tinjau >= lastIndex;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2.5">
      <div className="min-h-[96px] flex-1 overflow-y-auto rounded-borderRoundness border border-border bg-backgroundBoxDarker p-3">
        {kosong ? (
          <p className="text-[12px] text-foregroundGrey">{t("tekaTeki.langkah.kosong")}</p>
        ) : (
          <ul className="flex list-none flex-wrap gap-1.5 font-mono text-[12.5px] text-foregroundGrey" aria-label={t("tekaTeki.langkah.judul")}>
            {langkah.map((l, i) => {
              const idx = i + 1;
              const nomor = l.warna === "w" ? `${l.nomor}. ` : (i === 0 ? `${l.nomor}… ` : "");
              // Struktur list asli (ul/li) dengan tombol di dalamnya: memberi
              // role="listitem" pada <button> menimpa semantik tombol interaktif.
              return (
                <li key={idx}>
                  <button
                    type="button"
                    aria-current={idx === tinjau ? "step" : undefined}
                    onClick={() => onTinjau(idx)}
                    className={`rounded px-1.5 py-0.5 transition-colors ${idx === tinjau ? "bg-backgroundBoxBoxHover text-foreground" : "hover:bg-backgroundBox"}`}
                  >{nomor}{l.san}</button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <div className="grid shrink-0 grid-cols-4 gap-2">
        <TombolNav label={t("tekaTeki.langkah.awal")} arah="awal" onClick={() => onNavigasi("awal")} disabled={kosong || diAwal} />
        <TombolNav label={t("tekaTeki.langkah.sebelum")} arah="sebelum" onClick={() => onNavigasi("sebelum")} disabled={kosong || diAwal} />
        <TombolNav label={t("tekaTeki.langkah.berikut")} arah="berikut" onClick={() => onNavigasi("berikut")} disabled={kosong || diAkhir} />
        <TombolNav label={t("tekaTeki.langkah.akhir")} arah="akhir" onClick={() => onNavigasi("akhir")} disabled={kosong || diAkhir} />
      </div>
    </div>
  );
}
