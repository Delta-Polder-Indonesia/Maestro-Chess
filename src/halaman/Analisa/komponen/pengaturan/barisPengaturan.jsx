/**
 * Baris pengaturan bergaya En Croissant: judul (boleh berupa node preview)
 * dan deskripsi di kiri, kontrol di kanan, dipisah garis tipis antarbaris.
 */
export default function BarisPengaturan({ judul, deskripsi, children }) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-border py-3.5 first:border-t-0">
      <div className="min-w-0">{judul}
        {deskripsi ? (
          <p className="mt-0.5 text-xs leading-4 text-foregroundGrey">{deskripsi}</p>
        ) : null}
      </div>
      {children ? <div className="shrink-0">{children}</div> : null}
    </div>
  );
}
