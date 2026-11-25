import assert from "node:assert/strict";
import test from "node:test";
import { Chess } from "chess.js";
import * as keamananBidak from "../src/halaman/Analisa/mesin/keamananBidak.js";
import { getMoveRating, isSacrifice } from "../src/halaman/Analisa/mesin/penilaian.js";

const { penyerangTersembunyi } = keamananBidak;

test("keamananBidak module exposes only penyerangTersembunyi with no default export", () => {
  assert.deepEqual(Object.keys(keamananBidak), ["penyerangTersembunyi"]);
  assert.equal(Object.hasOwn(keamananBidak, "default"), false);
  assert.equal(typeof penyerangTersembunyi, "function");
});

test("penyerangTersembunyi detects two-layer orthogonal and diagonal batteries for white and black", () => {
  const putihOrtogonal = new Chess("q5k1/8/8/8/8/8/R7/R5K1 w - - 0 1");
  assert.deepEqual(putihOrtogonal.attackers("a8", "w"), ["a2"]);
  assert.deepEqual(penyerangTersembunyi(putihOrtogonal, "a8", "w"), ["a1"]);

  const hitamOrtogonal = new Chess("6k1/r7/r7/8/8/8/8/Q5K1 b - - 0 1");
  assert.deepEqual(hitamOrtogonal.attackers("a1", "b"), ["a6"]);
  assert.deepEqual(penyerangTersembunyi(hitamOrtogonal, "a1", "b"), ["a7"]);

  const putihDiagonal = new Chess("3k4/7p/8/8/4B3/3Q4/8/6K1 w - - 0 1");
  assert.deepEqual(putihDiagonal.attackers("h7", "w"), ["e4"]);
  assert.deepEqual(penyerangTersembunyi(putihDiagonal, "h7", "w"), ["d3"]);
});

test("penyerangTersembunyi traverses multi-layer batteries in LIFO discovery order without duplicates", () => {
  const tigaLapis = new Chess("q5k1/8/8/8/8/R7/R7/Q5K1 w - - 0 1");
  assert.deepEqual(tigaLapis.attackers("a8", "w"), ["a3"]);
  assert.deepEqual(penyerangTersembunyi(tigaLapis, "a8", "w"), ["a2", "a1"]);

  const enamLapisDiagonal = new Chess("6k1/1B6/2B5/3B4/4Q3/5Q2/6Q1/6K1 w - - 0 1");
  assert.deepEqual(enamLapisDiagonal.attackers("a8", "w"), ["b7"]);
  assert.deepEqual(penyerangTersembunyi(enamLapisDiagonal, "a8", "w"), ["c6", "d5", "e4", "f3", "g2"]);

  const multiGaris = new Chess("6k1/1B6/R1Q5/R2Q4/Q7/Q7/8/6K1 w - - 0 1");
  assert.deepEqual(multiGaris.attackers("a8", "w"), ["b7", "a6"]);
  assert.deepEqual(penyerangTersembunyi(multiGaris, "a8", "w"), ["a5", "a4", "a3", "c6", "d5"]);
});

test("penyerangTersembunyi ignores pinned front pieces and checks that leave no legal moves", () => {
  // Posisi korpus puzzle terdokumentasi: raja Hitam di h6 disekak g5, benteng c4 tak punya langkah legal.
  const korpus = new Chess("8/2R4p/6pk/5pP1/2rP1K1P/4PP2/8/2r5 b - - 0 1");
  assert.deepEqual(penyerangTersembunyi(korpus, "c8", "b"), []);

  const korpusDenganSasaran = new Chess("2R5/7p/6pk/5pP1/2rP1K1P/4PP2/8/2r5 b - - 0 1");
  assert.deepEqual(korpusDenganSasaran.attackers("c8", "b"), ["c4"]);
  assert.deepEqual(penyerangTersembunyi(korpusDenganSasaran, "c8", "b"), []);

  // Pin absolut tanpa skak: gajah e4 terpaku di lajur e oleh benteng e8, ratu d3 di belakangnya pada diagonal d3-h7.
  const pinAbsolut = new Chess("4r1k1/7p/8/8/4B3/3Q4/8/4K3 w - - 0 1");
  assert.equal(pinAbsolut.moves({ verbose: true, square: "e4" }).length, 0);
  assert.deepEqual(pinAbsolut.attackers("h7", "w"), ["e4"]);
  assert.deepEqual(penyerangTersembunyi(pinAbsolut, "h7", "w"), []);
});

test("penyerangTersembunyi never uses a king as battery opener or hidden attacker", () => {
  const rajaDiDepan = new Chess("6k1/8/8/8/8/4Q3/4K3/8 w - - 0 1");
  assert.deepEqual(rajaDiDepan.attackers("e1", "w"), ["e2"]);
  assert.deepEqual(penyerangTersembunyi(rajaDiDepan, "e1", "w"), []);
});

test("penyerangTersembunyi invokes langkahLegal lazily once, avoids input mutation, and preserves turn semantics", () => {
  const tanpaPenyerang = new Chess("6k1/8/8/8/8/8/8/6K1 w - - 0 1");
  let panggilanKosong = 0;
  const hasilKosong = penyerangTersembunyi(tanpaPenyerang, "a8", "w", () => {
    panggilanKosong++;
    return tanpaPenyerang.moves({ verbose: true });
  });
  assert.deepEqual(hasilKosong, []);
  assert.equal(panggilanKosong, 0);

  const rantai = new Chess("q5k1/8/8/8/8/R7/R7/Q5K1 w - - 0 1");
  const fenAwal = rantai.fen();
  let panggilanRantai = 0;
  const hasilDenganCallback = penyerangTersembunyi(rantai, "a8", "w", () => {
    panggilanRantai++;
    return rantai.moves({ verbose: true });
  });
  assert.deepEqual(hasilDenganCallback, ["a2", "a1"]);
  assert.equal(panggilanRantai, 1);
  assert.equal(rantai.fen(), fenAwal);

  // Callback langkahLegal yang mengembalikan daftar kosong mencegah pembukaan baterai.
  assert.deepEqual(penyerangTersembunyi(rantai, "a8", "w", () => []), []);

  // Perilaku lama saat giliran papan bukan milik warnaPenyerang: tanpa langkahLegal hasilnya [],
  // sementara dengan daftar langkah milik penyerang penelusuran tetap berjalan.
  const giliranLawan = new Chess("q5k1/8/8/8/8/8/R7/R5K1 b - - 0 1");
  assert.deepEqual(penyerangTersembunyi(giliranLawan, "a8", "w"), []);
  assert.deepEqual(
    penyerangTersembunyi(giliranLawan, "a8", "w", () => [{ from: "a2", to: "b2" }]),
    ["a1"],
  );
});

test("penyerangTersembunyi enforces BATAS_RANTAI = 16 and stops initial-board blocked chains", () => {
  // 20 bidak peluncur Putih menarget a8; antrean membuka tepat 16 kali dan berhenti sebelum f8/g8/h8.
  const fenDuaPuluh = "1RRRRRRR/RB6/R1B5/R2B4/R3B3/R2p1B2/R1pk2BP/R6K w - - 0 1";
  const papanBatas = new Chess(fenDuaPuluh);
  const hasil = penyerangTersembunyi(papanBatas, "a8", "w");
  assert.equal(papanBatas.fen(), fenDuaPuluh);
  assert.deepEqual(hasil, [
    "c6", "d5", "e4", "f3", "g2",
    "a6", "a5", "a4", "a3", "a2", "a1",
    "c8", "d8", "e8",
  ]);
  assert.equal(hasil.includes("f8"), false);
  assert.equal(hasil.includes("g8"), false);
  assert.equal(hasil.includes("h8"), false);

  // Perilaku lama bisaMembuka terhadap papan awal: Ra5 dapat bergeser sehingga a4 terbuka,
  // namun Ra4 awalnya terkunci di antara Ra5, Ra3, dan Pb4 sehingga lapis a3 di belakangnya tak dibuka.
  const terkurungAwal = new Chess("q5k1/8/8/R7/RP6/R7/8/6K1 w - - 0 1");
  assert.deepEqual(terkurungAwal.moves({ verbose: true, square: "a4" }), []);
  assert.deepEqual(penyerangTersembunyi(terkurungAwal, "a8", "w"), ["a4"]);
});

test("penilaian integration: hidden battery flips isSacrifice and brilliant verdict without false positives", () => {
  const papanBaterai = new Chess("r6k/r7/8/8/1R6/1B6/8/7K w - - 0 1");
  const langkahBaterai = papanBaterai.move({ from: "b4", to: "a4" });

  const papanTanpaBaterai = new Chess("7k/r7/8/8/1R6/1B6/8/7K w - - 0 1");
  const langkahTanpaBaterai = papanTanpaBaterai.move({ from: "b4", to: "a4" });

  assert.equal(isSacrifice(langkahBaterai), true);
  assert.equal(isSacrifice(langkahTanpaBaterai), false);

  const dasarEval = {
    color: "b",
    staticEval: ["cp", "-200"],
    previousStaticEvals: [["cp", "200"], ["cp", "50"], ["cp", "-50"], ["cp", "50"]],
    previousSacrifice: false,
  };
  const hasilBaterai = getMoveRating({
    ...dasarEval,
    fen: langkahBaterai.after,
    sacrifice: isSacrifice(langkahBaterai),
  });
  const hasilTanpaBaterai = getMoveRating({
    ...dasarEval,
    fen: langkahTanpaBaterai.after,
    sacrifice: isSacrifice(langkahTanpaBaterai),
  });
  assert.equal(hasilBaterai.moveRating, "brilliant");
  assert.equal(hasilBaterai.commentKey, "brilliant");
  assert.equal(hasilTanpaBaterai.moveRating, "best");

  // Pada posisi puzzle korpus, langkah skak g4-g5+ tidak memicu pengorbanan palsu.
  const praKorpus = new Chess("8/2R4p/6pk/5p2/2rP1KPP/4PP2/8/2r5 w - - 0 1");
  const langkahKorpus = praKorpus.move({ from: "g4", to: "g5" });
  assert.equal(isSacrifice(langkahKorpus), false);
});
