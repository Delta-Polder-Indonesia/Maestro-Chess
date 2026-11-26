/**
 * Empat dialog konfirmasi Database: ekspor kosong, hapus partai, hapus
 * koleksi, dan kosongkan seluruh basis data.
 *
 * Semuanya dikendalikan state di `layarDatabase.jsx`; berkas ini hanya
 * memindahkan markup-nya. `container` tetap diteruskan agar dialog ikut tema
 * gelap Analisa (lihat `wadahDialog` di layar).
 */
import { useI18n } from "../../../../../lib/i18n.jsx";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../../../../components/ui/alert-dialog.jsx";

export default function DialogDatabase({
  wadahDialog,
  dialogEksporKosong,
  setDialogEksporKosong,
  dialogHapusPartai,
  setDialogHapusPartai,
  setTargetHapusPartai,
  tanganiHapusPartai,
  dialogHapusKoleksi,
  setDialogHapusKoleksi,
  koleksiHapus,
  totalPartai,
  konfirmasiHapusKoleksi,
  dialogKosongkanSemua,
  setDialogKosongkanSemua,
  konfirmasiKosongkanSemua,
}) {
  const { t } = useI18n();

  return (
    <>
      <AlertDialog open={dialogEksporKosong} onOpenChange={setDialogEksporKosong}>
  <AlertDialogContent container={wadahDialog} className="bg-backgroundBoxDarker border-border text-foreground shadow-2xl">
    <AlertDialogHeader>
      <AlertDialogTitle className="text-foregroundHighlighted">
        {t("analisa.basisData.eksporKosongJudul")}
      </AlertDialogTitle>
      <AlertDialogDescription className="text-foregroundGrey">
        {t("analisa.basisData.eksporKosongIsi")}
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogAction className="bg-backgroundBoxBoxHighlighted hover:bg-backgroundBoxBoxHighlightedHover text-black font-bold">{t("analisa.basisData.mengerti")}</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>

{/* ── Konfirmasi hapus partai ── */}
<AlertDialog
  open={dialogHapusPartai}
  onOpenChange={(o) => {
    setDialogHapusPartai(o);
    if (!o) setTargetHapusPartai(null);
  }}
>
  <AlertDialogContent container={wadahDialog} className="bg-backgroundBoxDarker border-border text-foreground shadow-2xl">
    <AlertDialogHeader>
      <AlertDialogTitle className="text-foregroundHighlighted">
        {t("analisa.basisData.hapusPartai")}
      </AlertDialogTitle>
      <AlertDialogDescription className="text-foregroundGrey">
        {t("analisa.basisData.konfirmasiHapusPartai")}
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel className="bg-backgroundPanel border-border text-foreground hover:bg-backgroundPanelHover hover:text-foregroundHighlighted">{t("analisa.basisData.batal")}</AlertDialogCancel>
      <AlertDialogAction onClick={tanganiHapusPartai} className="bg-backgroundBoxBoxHighlighted hover:bg-backgroundBoxBoxHighlightedHover text-black font-bold">
        {t("analisa.basisData.hapus")}
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>

{/* ── Konfirmasi hapus koleksi ── */}
<AlertDialog
  open={Boolean(dialogHapusKoleksi)}
  onOpenChange={(o) => {
    if (!o) setDialogHapusKoleksi(null);
  }}
>
  <AlertDialogContent container={wadahDialog} className="bg-backgroundBoxDarker border-border text-foreground shadow-2xl">
    <AlertDialogHeader>
      <AlertDialogTitle className="text-foregroundHighlighted">
        {t("analisa.basisData.hapusKoleksi")}
      </AlertDialogTitle>
      <AlertDialogDescription className="text-foregroundGrey">
        {t("analisa.basisData.konfirmasiHapusKoleksi", {
          koleksi: koleksiHapus?.label || dialogHapusKoleksi,
          jumlah: koleksiHapus?.jumlahPartai ?? totalPartai,
        })}
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel className="bg-backgroundPanel border-border text-foreground hover:bg-backgroundPanelHover hover:text-foregroundHighlighted">{t("analisa.basisData.batal")}</AlertDialogCancel>
      <AlertDialogAction onClick={konfirmasiHapusKoleksi} className="bg-backgroundBoxBoxHighlighted hover:bg-backgroundBoxBoxHighlightedHover text-black font-bold">
        {t("analisa.basisData.hapus")}
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>

{/* ── Konfirmasi kosongkan seluruh basis data ── */}
<AlertDialog open={dialogKosongkanSemua} onOpenChange={setDialogKosongkanSemua}>
  <AlertDialogContent container={wadahDialog} className="bg-backgroundBoxDarker border-border text-foreground shadow-2xl">
    <AlertDialogHeader>
      <AlertDialogTitle className="text-foregroundHighlighted">
        {t("analisa.basisData.hapusSemua")}
      </AlertDialogTitle>
      <AlertDialogDescription className="text-foregroundGrey">
        {t("analisa.basisData.konfirmasiHapusSemua")}
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel className="bg-backgroundPanel border-border text-foreground hover:bg-backgroundPanelHover hover:text-foregroundHighlighted">{t("analisa.basisData.batal")}</AlertDialogCancel>
      <AlertDialogAction onClick={konfirmasiKosongkanSemua} className="bg-backgroundBoxBoxHighlighted hover:bg-backgroundBoxBoxHighlightedHover text-black font-bold">
        {t("analisa.basisData.hapusSemuaAksi")}
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
    </>
  );
}
