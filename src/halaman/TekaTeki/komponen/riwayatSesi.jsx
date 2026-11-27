/**
 * Riwayat sesi (pola ChallengeHistory En Croissant): satu keping per soal dengan
 * rating dan status benar/salah/belum; klik keping membuka soal itu kembali.
 */
export default function RiwayatSesi({ t, riwayat, aktif, onPilih }) {
  return (
    <div className="flex min-h-0 flex-col gap-2 rounded-borderRoundness border border-border bg-backgroundBoxDarker p-3">
      <h2 className="text-[11px] font-bold uppercase tracking-wide text-foregroundGrey">{t("tekaTeki.riwayat.judul")}</h2>
      {riwayat.length ? (
        <div className="flex min-h-0 flex-wrap gap-1.5 overflow-y-auto" role="list">
          {riwayat.map((entri, i) => {
            const nada = entri.status === "benar"
              ? "border-winGreen text-winGreen"
              : entri.status === "salah" ? "border-lossRed text-lossRed" : "border-border text-foregroundGrey";
            return (
              <button
                key={`${entri.id}-${i}`}
                type="button"
                role="listitem"
                aria-current={i === aktif}
                aria-label={`${entri.rating ?? "—"} · ${t(`tekaTeki.status.${entri.status}`)}`}
                onClick={() => onPilih(i)}
                className={`h-7 min-w-[44px] rounded-borderRoundness border px-2 text-[12px] font-semibold tabular-nums transition-colors ${nada} ${i === aktif ? "bg-backgroundBox" : ""}`}
              >{entri.rating ?? "—"}</button>
            );
          })}
        </div>
      ) : <p className="text-[12px] text-foregroundGrey">{t("tekaTeki.riwayat.kosong")}</p>}
    </div>
  );
}
