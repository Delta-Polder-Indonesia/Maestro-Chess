// Tes simulasi kegagalan penyimpanan sengaja memicu console.error di aplikasi.
// Tangkap pesan yang memang diharapkan supaya keluaran tes tetap bersih,
// tetapi teruskan pesan lain (misalnya peringatan React) agar tidak tersembunyi.
export function tangkapGalatDiuji(t, awalan) {
  const daftar = Array.isArray(awalan) ? awalan : [awalan];
  const consoleAsli = console.error;
  const tercatat = [];
  console.error = (...args) => {
    if (typeof args[0] === "string" && daftar.some((prefiks) => args[0].startsWith(prefiks))) {
      tercatat.push(args);
      return;
    }
    consoleAsli(...args);
  };
  t.after(() => { console.error = consoleAsli; });
  return tercatat;
}
