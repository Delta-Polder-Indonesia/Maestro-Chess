import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";
import * as buku from "../src/halaman/Analisa/mesin/buku.js";
import * as kunciFenMod from "../src/halaman/Analisa/mesin/kunciFen.js";
import { analisisRiwayatAntiCheat } from "../src/halaman/Analisa/akun/antiCheatRiwayat.js";

const akar = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const bukuUrl = pathToFileURL(resolve(akar, "src/halaman/Analisa/mesin/buku.js")).href;
const kunciFenUrl = pathToFileURL(resolve(akar, "src/halaman/Analisa/mesin/kunciFen.js")).href;

const FEN_AWAL = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const KUNCI_AWAL = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -";

test("kunciFen and buku expose exact named exports with no default export", () => {
  assert.deepEqual(Object.keys(kunciFenMod), ["kunciFen"]);
  assert.equal(Object.hasOwn(kunciFenMod, "default"), false);
  assert.equal(typeof kunciFenMod.kunciFen, "function");

  assert.deepEqual(Object.keys(buku).sort(), ["cariNamaPembukaan", "muatBuku"]);
  assert.equal(Object.hasOwn(buku, "default"), false);
  assert.equal(typeof buku.muatBuku, "function");
  assert.equal(typeof buku.cariNamaPembukaan, "function");
});

test("kunciFen trims whitespace, drops move counters and preserves legacy nullish/non-FEN coercions", () => {
  const { kunciFen } = kunciFenMod;
  assert.equal(kunciFen(FEN_AWAL), KUNCI_AWAL);
  assert.equal(
    kunciFen("  rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR   w  KQkq   -  14  27  "),
    KUNCI_AWAL,
  );
  assert.equal(kunciFen(null), "");
  assert.equal(kunciFen(undefined), "");
  assert.equal(kunciFen(""), "");
  assert.equal(kunciFen("   "), "");
  assert.equal(kunciFen("a b"), "a b");
  assert.equal(kunciFen("1 2 3 4 5 6"), "1 2 3 4");
  assert.equal(kunciFen(12345), "12345");
});

test("importing buku and kunciFen stays lazy without touching fetch or browser globals", () => {
  const script = `
    for (const key of ["fetch", "window", "document", "navigator", "WebAssembly", "localStorage", "sessionStorage"]) {
      Object.defineProperty(globalThis, key, { configurable: true, get() { throw new Error(key + " touched"); } });
    }
    globalThis.Worker = class { constructor() { throw new Error("worker created"); } };
    const k = await import(${JSON.stringify(kunciFenUrl)});
    const b = await import(${JSON.stringify(bukuUrl)});
    if (k.kunciFen("a b c d e f") !== "a b c d") throw new Error("unexpected kunciFen result");
    if (typeof b.muatBuku !== "function" || typeof b.cariNamaPembukaan !== "function") throw new Error("missing exports");
    console.log("ok");
  `;
  const child = spawnSync(process.execPath, ["--input-type=module", "-e", script], { cwd: akar, encoding: "utf8" });
  assert.equal(child.status, 0, child.stderr);
  assert.equal(child.stdout.trim(), "ok");
});

test("muatBuku resolves URL lazily with ?v=2026-11-26 and honors NEXT_PUBLIC_BASE_PATH at call time", () => {
  const script = `
    delete process.env.NEXT_PUBLIC_BASE_PATH;
    const urls = [];
    globalThis.fetch = async (url) => {
      urls.push(url);
      return { ok: true, json: async () => ({}) };
    };
    const { muatBuku } = await import(${JSON.stringify(bukuUrl)});
    await muatBuku();
    process.env.NEXT_PUBLIC_BASE_PATH = "/Maestro-Chess/";
    await muatBuku();
    process.env.NEXT_PUBLIC_BASE_PATH = "";
    await muatBuku();
    console.log(JSON.stringify(urls));
  `;
  const child = spawnSync(process.execPath, ["--input-type=module", "-e", script], { cwd: akar, encoding: "utf8" });
  assert.equal(child.status, 0, child.stderr);
  assert.deepEqual(JSON.parse(child.stdout.trim()), [
    "/data/buku-analisa.json?v=2026-11-26",
    "/Maestro-Chess/data/buku-analisa.json?v=2026-11-26",
    "/data/buku-analisa.json?v=2026-11-26",
  ]);
});

test("muatBuku and cariNamaPembukaan log failures, share in-flight retryable cache, and preserve null quirk", async (t) => {
  const fetchAsli = globalThis.fetch;
  const consoleAsli = console.error;
  const tercatat = [];
  console.error = (...args) => {
    tercatat.push(args);
    if (args[0] !== "Gagal memuat buku pembukaan:") consoleAsli(...args);
  };
  t.after(() => {
    globalThis.fetch = fetchAsli;
    console.error = consoleAsli;
  });

  // 1. Panggilan bersamaan saat gagal (HTTP 503) berbagi satu fetch dan sama-sama jatuh ke {}.
  let jumlahFetch = 0;
  globalThis.fetch = async () => {
    jumlahFetch++;
    return { ok: false, status: 503 };
  };
  const [petaA, pencariA] = await Promise.all([buku.muatBuku(), buku.cariNamaPembukaan()]);
  assert.equal(jumlahFetch, 1);
  assert.deepEqual(petaA, {});
  assert.equal(typeof pencariA, "function");
  assert.equal(pencariA(FEN_AWAL), undefined);
  assert.equal(tercatat.length, 1);
  assert.match(String(tercatat[0][1]), /HTTP 503/);

  // 2. Setelah selesai dengan {}, janji di-reset sehingga kegagalan jaringan berikutnya tetap dicoba lagi.
  globalThis.fetch = async () => {
    jumlahFetch++;
    throw new Error("jaringan putus");
  };
  const pencariB = await buku.cariNamaPembukaan();
  assert.equal(jumlahFetch, 2);
  assert.equal(pencariB(FEN_AWAL), undefined);
  assert.equal(tercatat.length, 2);
  assert.match(String(tercatat[1][1]), /jaringan putus/);

  // 3. Respons {} kosong tetap me-reset janji tanpa mencatat error.
  globalThis.fetch = async () => {
    jumlahFetch++;
    return { ok: true, json: async () => ({}) };
  };
  assert.deepEqual(await buku.muatBuku(), {});
  assert.equal(jumlahFetch, 3);
  assert.equal(tercatat.length, 2);

  // 4. Perilaku lama jika respon.json() mengembalikan null: janji di-reset, pencari melempar TypeError saat dipanggil.
  globalThis.fetch = async () => {
    jumlahFetch++;
    return { ok: true, json: async () => null };
  };
  const pencariNull = await buku.cariNamaPembukaan();
  assert.equal(jumlahFetch, 4);
  assert.throws(() => pencariNull(FEN_AWAL), TypeError);
  assert.equal(tercatat.length, 2);
});

test("muatBuku caches non-empty opening map as singleton promise and cariNamaPembukaan ignores move counters", async (t) => {
  const fetchAsli = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = fetchAsli;
  });

  const kunciE4 = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3";
  let jumlahFetch = 0;
  globalThis.fetch = async () => {
    jumlahFetch++;
    return {
      ok: true,
      json: async () => ({
        [KUNCI_AWAL]: "Posisi Awal",
        [kunciE4]: "King's Pawn",
      }),
    };
  };

  const janji1 = buku.muatBuku();
  const janji2 = buku.muatBuku();
  assert.strictEqual(janji1, janji2);

  const peta1 = await janji1;
  const pencari1 = await buku.cariNamaPembukaan();
  const pencari2 = await buku.cariNamaPembukaan();
  assert.equal(jumlahFetch, 1);
  assert.strictEqual(await buku.muatBuku(), peta1);

  assert.equal(pencari1(FEN_AWAL), "Posisi Awal");
  assert.equal(pencari1(`${KUNCI_AWAL} 12 34`), "Posisi Awal");
  assert.equal(pencari2(`${kunciE4} 0 1`), "King's Pawn");
  assert.equal(pencari1("8/8/8/8/8/8/8/8 w - - 0 1"), undefined);
  assert.equal(pencari1(null), undefined);
});

test("antiCheatRiwayat default opening lookup uses cariNamaPembukaan and survives failed book fetch", async () => {
  const script = `
    import assert from "node:assert/strict";
    const { analisisRiwayatAntiCheat } = await import(${JSON.stringify(
      pathToFileURL(resolve(akar, "src/halaman/Analisa/akun/antiCheatRiwayat.js")).href,
    )});
    const pgn = '[White "Budi"]\\n[Black "Law"]\\n[Result "1-0"]\\n\\n1. e4 e5 1-0';
    const partai = [{ id: "g-buku-1", pgn, whiteName: "Budi", blackName: "Law", timestamp: 1700000000000 }];

    globalThis.fetch = async () => ({ ok: false, status: 500 });
    const asliConsoleError = console.error;
    console.error = () => {};
    let argBukuGagal;
    const resGagal = await analisisRiwayatAntiCheat({
      partai,
      username: "Budi",
      paksa: true,
      parserPgn: async (_mesin, _pgn, _d, openings) => {
        argBukuGagal = openings;
        return { metadata: {}, moves: [] };
      },
    });
    assert.equal(typeof argBukuGagal, "function");
    assert.equal(argBukuGagal("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1"), undefined);
    assert.equal(resGagal.total, 1);
    assert.equal(resGagal.dianalisis, 1);

    const kunciE4 = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3";
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ [kunciE4]: "King's Pawn" }) });
    let argBukuSukses;
    await analisisRiwayatAntiCheat({
      partai,
      username: "Budi",
      paksa: true,
      parserPgn: async (_mesin, _pgn, _d, openings) => {
        argBukuSukses = openings;
        return { metadata: {}, moves: [] };
      },
    });
    console.error = asliConsoleError;
    assert.equal(argBukuSukses(kunciE4 + " 0 1"), "King's Pawn");
    console.log("ok");
  `;
  const child = spawnSync(process.execPath, ["--input-type=module", "-e", script], { cwd: akar, encoding: "utf8" });
  assert.equal(child.status, 0, child.stderr);
  assert.equal(child.stdout.trim(), "ok");
  assert.equal(typeof analisisRiwayatAntiCheat, "function");
});

test("useMuatPartai and useAnalisisPapan integrate with cariNamaPembukaan on success and 503 fallback", async () => {
  const script = `
    import assert from "node:assert/strict";
    import React, { useRef, useState } from "react";
    import TestRenderer from "react-test-renderer";
    import { useMuatPartai } from ${JSON.stringify(
      pathToFileURL(resolve(akar, "src/halaman/Analisa/komponen/game/useMuatPartai.js")).href,
    )};
    import { useAnalisisPapan } from ${JSON.stringify(
      pathToFileURL(resolve(akar, "src/halaman/Analisa/komponen/game/useAnalisisPapan.js")).href,
    )};

    const { act } = TestRenderer;
    const noop = () => {};
    const flush = () => new Promise((resolve) => setImmediate(resolve));
    const kunciE4 = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq -";
    const engine = {
      gameBaru: noop,
      setop: noop,
      async cari() {
        return { staticEval: ["cp", "15"], bestMove: undefined, daftarKandidat: [] };
      },
    };

    // 1. Ketika fetch gagal 503, useAnalisisPapan tetap menilai langkah tanpa crash dan mencatat galat buku.
    const asliError = console.error;
    const galatBuku = [];
    console.error = (...args) => {
      if (args[0] === "Gagal memuat buku pembukaan:") galatBuku.push(args);
      else asliError(...args);
    };
    globalThis.fetch = async () => ({ ok: false, status: 503 });

    let papanHooks;
    let customLineTerakhir = {
      moveNumber: 0,
      moves: [{ fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1" }],
      arrows: { 0: [] },
    };
    function PapanHarness() {
      const controllerRef = useRef(new AbortController());
      const muatSeqRef = useRef(0);
      const openingsRef = useRef(null);
      papanHooks = useAnalisisPapan({
        controllerRef, muatSeqRef, openingsRef, data: { format: "fen" }, depth: 6, time: 0, move2: null,
        siapkan: async () => engine, ambilMesin: () => engine, t: (k) => k,
        setErrors: noop, setAnalyzeController: (c) => { controllerRef.current = c; }, setPageState: noop,
        setAnimation: noop, setForward: noop,
        setCustomLine: (fn) => {
          customLineTerakhir = typeof fn === "function" ? fn(customLineTerakhir) : fn;
        },
        setAnalyzingMove: noop, analyzingMove: false,
      });
      return null;
    }
    let rendererPapan;
    await act(async () => {
      rendererPapan = TestRenderer.create(React.createElement(PapanHarness));
    });
    await act(async () => {
      await papanHooks.analyzeMove("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", { from: "e2", to: "e4" }, false, [["cp", "15"]], false);
      await flush();
    });
    assert.equal(galatBuku.length, 1);
    assert.equal(customLineTerakhir.moves[1].san, "e4");
    assert.notEqual(customLineTerakhir.moves[1].moveRating, "book");
    await act(async () => { rendererPapan.unmount(); });

    // 2. Setelah gagal (janji di-reset), useMuatPartai memuat buku sukses dan menandai langkah pembukaan sebagai book.
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ [kunciE4]: "King's Pawn" }) });
    let recordedMoves = null;
    const pgnData = { format: "pgn", string: '[White "A"]\\n[Black "B"]\\n\\n1. e4 e5 *' };
    function MuatHarness({ data }) {
      const [controller, setController] = useState(() => new AbortController());
      const boardSoundsRef = useRef(false);
      useMuatPartai({
        data,
        depth: 6, boardSoundsRef, t: (k) => k, siapkan: async () => engine,
        analyzeController: controller, setAnalyzeController: setController,
        setPageState: noop, setPlayers: noop, setGame: (v) => { recordedMoves = v; }, setErrors: noop,
        setTab: noop, setProgress: noop, setLangkahSementara: noop, setTime: noop,
        setResult: noop, setAnimation: noop, setArrows: noop, setCustomLine: noop,
        setAnalyzingMove: noop, setMoveNumber: noop, setWhite: noop, setPlaying: noop,
      });
      return null;
    }
    let rendererMuat;
    await act(async () => {
      rendererMuat = TestRenderer.create(React.createElement(MuatHarness, { data: pgnData }));
      await flush();
    });
    assert.equal(recordedMoves[1].moveRating, "book");
    assert.equal(recordedMoves[1].comment, "King's Pawn");
    await act(async () => { rendererMuat.unmount(); });

    console.error = asliError;
    console.log("ok");
  `;
  const child = spawnSync(process.execPath, ["--input-type=module", "-e", script], { cwd: akar, encoding: "utf8" });
  assert.equal(child.status, 0, child.stderr);
  assert.equal(child.stdout.trim(), "ok");
});
