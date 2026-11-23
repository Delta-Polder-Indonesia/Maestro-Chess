/** Keyboard navigation for a horizontal, automatically activated tablist. */
export function tekanPanahTab(e) {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
  const tombol = [...e.currentTarget.querySelectorAll('[role="tab"]:not([disabled])')];
  const sekarang = tombol.indexOf(e.target);
  if (sekarang < 0 || !tombol.length) return;
  const berikut = e.key === "Home" ? 0 : e.key === "End" ? tombol.length - 1
    : (sekarang + (e.key === "ArrowRight" ? 1 : -1) + tombol.length) % tombol.length;
  e.preventDefault();
  tombol[berikut].focus();
  tombol[berikut].click();
}
