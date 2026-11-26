import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { runInThisContext } from "node:vm";
import React from "react";
import TestRenderer from "react-test-renderer";
import ts from "typescript";
import { ambilKartuPemain, urlBendera } from "../src/modul/profil/index.js";

const require = createRequire(import.meta.url);
const { act } = TestRenderer;
const AWALAN = "maestro-analisa-pemain-v2-";
const AVATAR_SAH = "https://images.chesscomfiles.com/uploads/v1/user/15448422.88c010c1.200x200o.3c5619f5441e.png";

function gantiGlobal(tes, nama, nilai) {
  const lama = Object.getOwnPropertyDescriptor(globalThis, nama);
  Object.defineProperty(globalThis, nama, { configurable: true, writable: true, value: nilai });
  tes.after(() => {
    if (lama) Object.defineProperty(globalThis, nama, lama);
    else delete globalThis[nama];
  });
}

function storageMemori(awal = {}) {
  const data = new Map(Object.entries(awal));
  return {
    data,
    getItem: (kunci) => data.get(kunci) ?? null,
    setItem: (kunci, nilai) => data.set(kunci, String(nilai)),
    removeItem: (kunci) => data.delete(kunci),
  };
}

const respons = (data) => ({ ok: true, json: async () => data });

// Cache modul bersifat per-(platform,username) dan hidup sepanjang proses,
// jadi tiap kasus memakai username unik agar tidak saling mencemari cache.
let urut = 0;
const namaUnik = () => `avatar-uji-${++urut}`;

function pasangFetchChess(tes, avatar, jejak = []) {
  gantiGlobal(tes, "fetch", async (url) => {
    jejak.push(url);
    if (url.endsWith("/stats")) return respons({});
    return respons({ name: "Pemain Uji", avatar, country: "https://api.chess.com/pub/country/ID" });
  });
}

test("avatar Chess.com sah dari hostname resmi diteruskan apa adanya", async (tes) => {
  gantiGlobal(tes, "localStorage", storageMemori());
  pasangFetchChess(tes, AVATAR_SAH);
  const kartu = await ambilKartuPemain(namaUnik(), "chessCom");
  assert.equal(kartu.avatar, AVATAR_SAH);
});

test("avatar kosong, null, atau bukan string menghasilkan null tanpa crash", async (tes) => {
  gantiGlobal(tes, "localStorage", storageMemori());
  for (const nilai of [null, undefined, "", "   ", 123, {}, []]) {
    pasangFetchChess(tes, nilai);
    const kartu = await ambilKartuPemain(namaUnik(), "chessCom");
    assert.equal(kartu.avatar, null, `nilai ${JSON.stringify(nilai)} harus ditolak`);
  }
});

const URL_DITOLAK = [
  ["http (bukan https)", "http://images.chesscomfiles.com/uploads/v1/user/a.png"],
  ["skema javascript", "javascript:alert(1)"],
  ["skema data", "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'/>"],
  ["hostname tidak dikenal", "https://evil.example.com/a.png"],
  ["hostname tiruan (suffix)", "https://images.chesscomfiles.com.evil.com/a.png"],
  ["hostname tiruan (prefix)", "https://evilimages.chesscomfiles.com/a.png"],
  ["hostname mirip tanpa titik", "https://images-chesscomfiles.com/a.png"],
  ["kredensial pada authority", "https://user:pass@images.chesscomfiles.com/a.png"],
  ["username saja pada authority", "https://user@images.chesscomfiles.com/a.png"],
  ["port nonstandar", "https://images.chesscomfiles.com:8443/a.png"],
  ["URL relatif/tanpa skema", "images.chesscomfiles.com/a.png"],
  ["string bukan URL", "bukan url sama sekali"],
  ["ftp", "ftp://images.chesscomfiles.com/a.png"],
];

for (const [label, url] of URL_DITOLAK) {
  test(`avatar manipulatif ditolak: ${label}`, async (tes) => {
    gantiGlobal(tes, "localStorage", storageMemori());
    pasangFetchChess(tes, url);
    const kartu = await ambilKartuPemain(namaUnik(), "chessCom");
    assert.equal(kartu.avatar, null, `${label} harus menjadi null`);
    assert.equal(kartu.exists, true, "kartu tetap ada; hanya avatar yang di-null-kan");
  });
}

test("avatar cache localStorage lama yang berbahaya dibersihkan saat dibaca", async (tes) => {
  const nama = namaUnik();
  const kartuLama = {
    username: nama, exists: true, name: "Lama", title: null,
    avatar: "https://evil.example.com/lama.png", flag: "id", country: "ID",
    joined: null, status: null, url: null, total: null, ratings: {}, peak: {},
  };
  const storage = storageMemori({ [AWALAN + `chessCom:${nama}`]: JSON.stringify(kartuLama) });
  gantiGlobal(tes, "localStorage", storage);
  const jejak = [];
  pasangFetchChess(tes, AVATAR_SAH, jejak);
  const kartu = await ambilKartuPemain(nama, "chessCom");
  assert.equal(kartu.avatar, null, "avatar lama berbahaya harus di-null-kan");
  assert.equal(jejak.length, 0, "cache lama dipakai tanpa fetch ulang");
});

test("avatar cache localStorage lama yang sah tetap dipertahankan", async (tes) => {
  const nama = namaUnik();
  const kartuLama = {
    username: nama, exists: true, name: "Lama", title: null,
    avatar: AVATAR_SAH, flag: "id", country: "ID",
    joined: null, status: null, url: null, total: null, ratings: {}, peak: {},
  };
  gantiGlobal(tes, "localStorage", storageMemori({ [AWALAN + `chessCom:${nama}`]: JSON.stringify(kartuLama) }));
  const jejak = [];
  pasangFetchChess(tes, "https://evil.example.com/baru.png", jejak);
  const kartu = await ambilKartuPemain(nama, "chessCom");
  assert.equal(kartu.avatar, AVATAR_SAH);
  assert.equal(jejak.length, 0);
});

test("Lichess tidak pernah menghasilkan avatar (API tanpa field avatar)", async (tes) => {
  gantiGlobal(tes, "localStorage", storageMemori());
  gantiGlobal(tes, "fetch", async () => respons({
    id: "li", profile: { firstName: "Li", lastName: "Chess" }, perfs: {}, count: {},
    avatar: "https://evil.example.com/tidak-dipakai.png",
  }));
  const kartu = await ambilKartuPemain(namaUnik(), "lichessOrg");
  assert.equal(kartu.avatar, null);
});

test("bendera tetap resolves ke SVG lokal dan tidak terpengaruh validasi avatar", () => {
  assert.equal(urlBendera("ID"), "/flags/id.svg");
  assert.equal(urlBendera("gb-eng"), "/flags/gb-eng.svg");
  assert.equal(urlBendera("kode-tak-valid"), null);
});

// --- Fallback komponen: avatar valid tampil, avatar null/gagal → ikon profil ---
function kompilasi(path, dependencies) {
  const filename = new URL(path, import.meta.url);
  const compiled = ts.transpileModule(readFileSync(filename, "utf8"), {
    fileName: filename.pathname,
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const result = { exports: {} };
  runInThisContext(`(function (require, module, exports) {\n${compiled}\n})`)((id) => {
    if (id === "react" || id === "react/jsx-runtime") return require(id);
    if (id in dependencies) return dependencies[id];
    throw new Error(`Unexpected dependency: ${id}`);
  }, result, result.exports);
  return result.exports.default;
}

const IkonProfil = () => React.createElement("span", { "data-uji": "ikon-profil" });
const Name = kompilasi("../src/halaman/Analisa/komponen/game/name.jsx", {
  "../svg/profile.jsx": { default: IkonProfil },
  "./capturedPieces.jsx": { default: () => null },
  "../LencanaGelar.jsx": { default: () => null },
  "@/modul/profil/index.js": { urlBendera },
});

test("komponen nama menampilkan avatar sah dan jatuh ke ikon profil saat null atau gagal dimuat", async (tes) => {
  let renderer;
  tes.after(() => act(() => renderer?.unmount()));
  await act(async () => {
    renderer = TestRenderer.create(React.createElement(Name, { white: true, avatar: AVATAR_SAH }, "Pemain"));
  });
  assert.ok(renderer.root.findAllByType("img").some((n) => n.props.src === AVATAR_SAH), "avatar sah tampil");
  assert.equal(renderer.root.findAllByProps({ "data-uji": "ikon-profil" }).length, 0);

  await act(async () => {
    renderer.update(React.createElement(Name, { white: true, avatar: null }, "Pemain"));
  });
  assert.equal(renderer.root.findAllByType("img").length, 0, "avatar null → tidak ada img");
  assert.ok(renderer.root.findAllByProps({ "data-uji": "ikon-profil" }).length > 0, "ikon profil fallback tampil");

  await act(async () => {
    renderer.update(React.createElement(Name, { white: true, avatar: AVATAR_SAH }, "Pemain"));
  });
  const img = renderer.root.findAllByType("img").find((n) => n.props.src === AVATAR_SAH);
  await act(async () => { img.props.onError(); });
  assert.equal(renderer.root.findAllByType("img").length, 0, "avatar gagal dimuat → img disembunyikan");
  assert.ok(renderer.root.findAllByProps({ "data-uji": "ikon-profil" }).length > 0, "ikon profil fallback tampil setelah onError");
});
