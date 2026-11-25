import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import TestRenderer from "react-test-renderer";
import { ambilKartuPemain, segarkanKartuPemain, useKartuPemain } from "../src/lib/pemainCatur.js";
import { urlBendera } from "../src/lib/bendera.js";

const { act } = TestRenderer;
const AWALAN = "maestro-analisa-pemain-v2-";
const flush = () => new Promise((resolve) => setImmediate(resolve));

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
  const jejak = [];
  return {
    data,
    jejak,
    getItem(kunci) {
      jejak.push(["get", kunci]);
      return data.get(kunci) ?? null;
    },
    setItem(kunci, nilai) {
      jejak.push(["set", kunci, String(nilai)]);
      data.set(kunci, String(nilai));
    },
    removeItem(kunci) {
      jejak.push(["remove", kunci]);
      data.delete(kunci);
    },
  };
}

function tertunda() {
  let resolve;
  let reject;
  const promise = new Promise((selesai, gagal) => { resolve = selesai; reject = gagal; });
  return { promise, resolve, reject };
}

const respons = (data) => ({ ok: true, json: async () => data });
const profilLichess = (id, namaDepan = "", namaBelakang = "") => ({
  id,
  profile: { firstName: namaDepan, lastName: namaBelakang },
  perfs: {},
  count: {},
});

function lingkungan(tes, storage = storageMemori()) {
  gantiGlobal(tes, "localStorage", storage);
  return storage;
}

test("Chess.com and Lichess normalize distinct cache keys, requests, and full profiles", async (tes) => {
  const storage = lingkungan(tes);
  const calls = [];
  const chess = {
    name: "Alice Example", title: "GM", avatar: "https://images.chesscomfiles.com/uploads/v1/user/alice.png",
    country: "https://api.chess.com/pub/country/GB-ENG", joined: 1650000000,
    status: "basic", url: "https://www.chess.com/member/alice",
  };
  const statistik = {
    chess_bullet: { last: { rating: 1200 }, best: { rating: 1300 }, record: { win: 2, loss: 3, draw: 1 } },
    chess_blitz: { last: { rating: 1400 }, best: { rating: 1500 }, record: { win: 4, loss: 1, draw: 0 } },
    chess_rapid: { last: { rating: 1600 }, record: { win: 2, loss: 2, draw: 1 } },
    chess_classical: { last: { rating: 1700 }, best: { rating: 1750 }, record: { win: 1, loss: 0, draw: 0 } },
    chess_daily: { last: { rating: 1800 }, best: { rating: 1900 }, record: { win: 3, loss: 0, draw: 0 } },
  };
  const lichess = {
    id: "cacheuser_a", title: "IM", profile: { firstName: "Alice", lastName: "Lichess" },
    createdAt: 1670000000123, count: { all: "42" },
    perfs: { bullet: { rating: 2101 }, blitz: { rating: 2102 }, rapid: { rating: 2103 }, correspondence: { rating: 2104 }, classical: { rating: 2105 } },
  };
  gantiGlobal(tes, "fetch", async (url, opsi) => {
    calls.push([url, opsi]);
    if (url === "https://api.chess.com/pub/player/cacheuser_a") return respons(chess);
    if (url === "https://api.chess.com/pub/player/cacheuser_a/stats") return respons(statistik);
    if (url === "https://lichess.org/api/user/cacheuser_a") return respons(lichess);
    throw new Error(`Unexpected URL ${url}`);
  });

  const kartuChess = await ambilKartuPemain("  CacheUser_A  ");
  assert.deepEqual(kartuChess, {
    username: "  CacheUser_A  ", exists: true, name: "Alice Example", title: "GM",
    avatar: "https://images.chesscomfiles.com/uploads/v1/user/alice.png", flag: "gb-eng", country: "GB-ENG",
    joined: 1650000000, status: "basic", url: "https://www.chess.com/member/alice", total: 20,
    ratings: { bullet: 1200, blitz: 1400, rapid: 1600, daily: 1800, classical: 1700 },
    peak: { bullet: 1300, blitz: 1500, rapid: null, daily: 1900, classical: 1750 },
  });
  const kartuLichess = await ambilKartuPemain("CACHEUSER_A", "lichessOrg");
  assert.deepEqual(kartuLichess, {
    username: "CACHEUSER_A", exists: true, name: "Alice Lichess", title: "IM",
    avatar: null, flag: null, country: null, joined: 1670000000, status: null,
    url: "https://lichess.org/@/CACHEUSER_A", total: 42,
    ratings: { bullet: 2101, blitz: 2102, rapid: 2103, daily: 2104, classical: 2105 },
    peak: { bullet: null, blitz: null, rapid: null, daily: null, classical: null },
  });
  assert.strictEqual(await ambilKartuPemain("cacheuser_a", "chessCom"), kartuChess);
  assert.strictEqual(await ambilKartuPemain("cacheuser_a", "platform-lain"), kartuChess);
  assert.strictEqual(await ambilKartuPemain("cacheuser_a", "lichessOrg"), kartuLichess);
  assert.deepEqual(calls, [
    ["https://api.chess.com/pub/player/cacheuser_a", undefined],
    ["https://api.chess.com/pub/player/cacheuser_a/stats", undefined],
    ["https://lichess.org/api/user/cacheuser_a", { headers: { Accept: "application/json" } }],
  ]);
  assert.deepEqual(JSON.parse(storage.data.get(`${AWALAN}chessCom:cacheuser_a`)), kartuChess);
  assert.deepEqual(JSON.parse(storage.data.get(`${AWALAN}lichessOrg:cacheuser_a`)), kartuLichess);
});

test("usernames are encoded for requests while the original name is retained in fallback URLs", async (tes) => {
  lingkungan(tes);
  const urls = [];
  gantiGlobal(tes, "fetch", async (url) => {
    urls.push(url);
    return url.endsWith("/stats") ? respons({}) : respons({ country: "https://api.chess.com/pub/country/not-valid" });
  });
  const nama = " Mix / Name ";
  const kartu = await ambilKartuPemain(nama, "unrecognized");
  assert.deepEqual(urls, [
    "https://api.chess.com/pub/player/mix%20%2F%20name",
    "https://api.chess.com/pub/player/mix%20%2F%20name/stats",
  ]);
  assert.equal(kartu.username, nama);
  assert.equal(kartu.url, `https://www.chess.com/member/${nama}`);
  assert.equal(kartu.flag, null);
  assert.equal(kartu.country, null);
  assert.equal(kartu.total, null);
  assert.deepEqual(kartu.ratings, { bullet: null, blitz: null, rapid: null, daily: null, classical: null });
});

test("blank and anonymous names are skipped without storage, refresh, or network access", async (tes) => {
  const storage = lingkungan(tes);
  let calls = 0;
  gantiGlobal(tes, "fetch", async () => { calls++; throw new Error("must not fetch"); });
  for (const nama of [null, undefined, "", "   ", "?", "UNKNOWN", " anonim ", "Putih", "Hitam", "white", "BLACK"]) {
    assert.equal(await ambilKartuPemain(nama, "lichessOrg"), null);
    assert.equal(await segarkanKartuPemain(nama, "chessCom"), null);
  }
  assert.equal(calls, 0);
  assert.deepEqual(storage.jejak, []);
});

test("v2 storage is read before the network and then held as the same in-memory object", async (tes) => {
  const key = `${AWALAN}lichessOrg:stored-user`;
  const storage = lingkungan(tes, storageMemori({ [key]: JSON.stringify({ name: "Stored", arbitrary: true }) }));
  let calls = 0;
  gantiGlobal(tes, "fetch", async () => { calls++; throw new Error("must not fetch"); });
  const first = await ambilKartuPemain("Stored-User", "lichessOrg");
  assert.deepEqual(first, { name: "Stored", arbitrary: true });
  storage.data.delete(key);
  const second = await ambilKartuPemain("stored-user", "lichessOrg");
  assert.strictEqual(second, first);
  assert.deepEqual(storage.jejak, [["get", key]]);
  assert.equal(calls, 0);
});

test("old cache prefixes and invalid JSON do not prevent a fresh v2 lookup", async (tes) => {
  const oldKey = "maestro-analisa-pemain-v1-lichessOrg:legacy-user";
  const brokenKey = `${AWALAN}lichessOrg:corrupt-user`;
  const storage = lingkungan(tes, storageMemori({ [oldKey]: JSON.stringify({ name: "Old" }), [brokenKey]: "{broken" }));
  const urls = [];
  gantiGlobal(tes, "fetch", async (url) => {
    urls.push(url);
    return respons(profilLichess(url.endsWith("legacy-user") ? "legacy-user" : "corrupt-user", "Fresh", "Profile"));
  });
  assert.equal((await ambilKartuPemain("legacy-user", "lichessOrg")).name, "Fresh Profile");
  assert.equal((await ambilKartuPemain("corrupt-user", "lichessOrg")).name, "Fresh Profile");
  assert.equal(urls.length, 2);
  assert.ok(storage.data.has(oldKey));
  assert.equal(JSON.parse(storage.data.get(brokenKey)).name, "Fresh Profile");
  assert.ok(storage.data.has(`${AWALAN}lichessOrg:legacy-user`));
});

test("storage read/write/remove exceptions are best effort, with cached results still usable", async (tes) => {
  let reads = 0;
  let writes = 0;
  let removes = 0;
  lingkungan(tes, {
    getItem() { reads++; throw new Error("read blocked"); },
    setItem() { writes++; throw new Error("quota"); },
    removeItem() { removes++; throw new Error("remove blocked"); },
  });
  let calls = 0;
  gantiGlobal(tes, "fetch", async () => respons(profilLichess(`storage-error-${++calls}`, "Fresh", String(calls))));
  const first = await ambilKartuPemain("storage-errors", "lichessOrg");
  assert.equal(first.name, "Fresh 1");
  assert.strictEqual(await ambilKartuPemain("STORAGE-ERRORS", "lichessOrg"), first);
  const refreshed = await segarkanKartuPemain("storage-errors", "lichessOrg");
  assert.equal(refreshed.name, "Fresh 2");
  assert.deepEqual({ reads, writes, removes, calls }, { reads: 2, writes: 2, removes: 1, calls: 2 });
});

test("profiles still work without localStorage, and refresh makes a fresh request", async (tes) => {
  gantiGlobal(tes, "localStorage", undefined);
  let calls = 0;
  gantiGlobal(tes, "fetch", async () => respons(profilLichess(`no-storage-${++calls}`, "NoStorage", String(calls))));
  const first = await ambilKartuPemain("no-local-storage", "lichessOrg");
  assert.equal(first.name, "NoStorage 1");
  assert.strictEqual(await ambilKartuPemain("no-local-storage", "lichessOrg"), first);
  assert.equal((await segarkanKartuPemain("no-local-storage", "lichessOrg")).name, "NoStorage 2");
  assert.equal(calls, 2);
});

test("a failed storage removal may make explicit refresh return the stored card without fetching", async (tes) => {
  const key = `${AWALAN}lichessOrg:remove-failure`;
  const storage = storageMemori({ [key]: JSON.stringify({ name: "Still stored" }) });
  storage.removeItem = () => { throw new Error("remove denied"); };
  lingkungan(tes, storage);
  let calls = 0;
  gantiGlobal(tes, "fetch", async () => { calls++; return respons(profilLichess("remove-failure")); });
  assert.equal((await ambilKartuPemain("remove-failure", "lichessOrg")).name, "Still stored");
  assert.equal((await segarkanKartuPemain("remove-failure", "lichessOrg")).name, "Still stored");
  assert.equal(calls, 0);
  assert.ok(storage.data.has(key));
});

test("failed lookups cache null without automatic retries, until explicit refresh on either platform", async (tes) => {
  for (const [platform, expectedRequests] of [["chessCom", 2], ["lichessOrg", 1]]) {
    await tes.test(platform, async (subtest) => {
      const storage = lingkungan(subtest);
      const nama = `no-retry-${platform}`;
      const key = `${AWALAN}${platform}:${nama.toLowerCase()}`;
      let sehat = false;
      let calls = 0;
      gantiGlobal(subtest, "fetch", async (url) => {
        calls++;
        if (!sehat) return { ok: false };
        if (platform === "lichessOrg") return respons(profilLichess(nama, "Retry", "Success"));
        return url.endsWith("/stats") ? respons({}) : respons({ name: "Retry Success" });
      });
      assert.equal(await ambilKartuPemain(nama, platform), null);
      assert.equal(storage.data.has(key), false);
      sehat = true;
      storage.data.set(key, JSON.stringify({ name: "External" }));
      assert.equal(await ambilKartuPemain(nama, platform), null);
      assert.equal(calls, expectedRequests);
      assert.equal((await segarkanKartuPemain(nama, platform)).name, "Retry Success");
      assert.equal(calls, expectedRequests * 2);
      assert.equal(JSON.parse(storage.data.get(key)).name, "Retry Success");
    });
  }
});

test("network errors, invalid JSON, and missing Lichess ids resolve to cached null", async (tes) => {
  lingkungan(tes);
  const calls = [];
  gantiGlobal(tes, "fetch", async (url) => {
    calls.push(url);
    if (url.includes("throw-network")) throw new Error("offline");
    if (url.includes("bad-json")) return { ok: true, json: async () => { throw new Error("bad JSON"); } };
    return respons({});
  });
  for (const [nama, platform, jumlah] of [
    ["throw-network", "chessCom", 2], ["bad-json", "chessCom", 2],
    ["throw-network", "lichessOrg", 1], ["bad-json", "lichessOrg", 1], ["missing-id", "lichessOrg", 1],
  ]) {
    const before = calls.length;
    assert.equal(await ambilKartuPemain(nama, platform), null);
    assert.equal(await ambilKartuPemain(nama, platform), null);
    assert.equal(calls.length - before, jumlah);
  }
});

test("Chess.com profile survives a failed stats request and retains zero/null normalization", async (tes) => {
  lingkungan(tes);
  let calls = 0;
  gantiGlobal(tes, "fetch", async (url) => {
    calls++;
    return url.endsWith("/stats") ? { ok: false } : respons({ name: "Without stats", joined: "123" });
  });
  const card = await ambilKartuPemain("stats-failed", "chessCom");
  assert.equal(card.name, "Without stats");
  assert.equal(card.joined, null);
  assert.equal(card.total, null);
  assert.deepEqual(card.ratings, { bullet: null, blitz: null, rapid: null, daily: null, classical: null });
  assert.strictEqual(await ambilKartuPemain("stats-failed", "chessCom"), card);
  assert.equal(calls, 2);
});

test("a delayed old request currently overwrites a newer explicit refresh in memory and storage", async (tes) => {
  const storage = lingkungan(tes);
  const lama = tertunda();
  let calls = 0;
  gantiGlobal(tes, "fetch", async () => ++calls === 1
    ? await lama.promise
    : respons(profilLichess("race-new", "New", "Version")));
  const permintaanLama = ambilKartuPemain("refresh-race", "lichessOrg");
  assert.equal((await segarkanKartuPemain("refresh-race", "lichessOrg")).name, "New Version");
  lama.resolve(respons(profilLichess("race-old", "Old", "Version")));
  assert.equal((await permintaanLama).name, "Old Version");
  assert.equal((await ambilKartuPemain("refresh-race", "lichessOrg")).name, "Old Version");
  assert.equal(JSON.parse(storage.data.get(`${AWALAN}lichessOrg:refresh-race`)).name, "Old Version");
  assert.equal(calls, 2);
});

test("simultaneous uncached lookups are not deduplicated and the last response wins", async (tes) => {
  const storage = lingkungan(tes);
  const requests = [tertunda(), tertunda()];
  let calls = 0;
  gantiGlobal(tes, "fetch", async () => await requests[calls++].promise);
  const first = ambilKartuPemain("parallel-lookup", "lichessOrg");
  const second = ambilKartuPemain("parallel-lookup", "lichessOrg");
  assert.equal(calls, 2);
  requests[1].resolve(respons(profilLichess("second", "Second", "Result")));
  assert.equal((await second).name, "Second Result");
  requests[0].resolve(respons(profilLichess("first", "First", "Result")));
  assert.equal((await first).name, "First Result");
  assert.equal((await ambilKartuPemain("parallel-lookup", "lichessOrg")).name, "First Result");
  assert.equal(JSON.parse(storage.data.get(`${AWALAN}lichessOrg:parallel-lookup`)).name, "First Result");
});

function ProfilUji({ nama, aktif = true, platform = "lichessOrg", onRender }) {
  const kartu = useKartuPemain(nama, aktif, platform);
  onRender?.(kartu);
  return React.createElement("output", { kartu });
}

test("profile hook transitions from inactive to loading to a card, and back to inactive", async (tes) => {
  lingkungan(tes);
  const request = tertunda();
  let calls = 0;
  gantiGlobal(tes, "fetch", async () => { calls++; return await request.promise; });
  const renders = [];
  const view = (aktif) => React.createElement(ProfilUji, { nama: "hook-active", aktif, onRender: (value) => renders.push(value) });
  let renderer;
  act(() => { renderer = TestRenderer.create(view(false)); });
  tes.after(() => act(() => renderer.unmount()));
  assert.equal(renderer.root.findByType("output").props.kartu, null);
  assert.equal(calls, 0);
  act(() => renderer.update(view(true)));
  assert.equal(renderer.root.findByType("output").props.kartu, undefined);
  assert.equal(calls, 1);
  await act(async () => { request.resolve(respons(profilLichess("hook-active", "Hook", "Loaded"))); await flush(); });
  assert.equal(renderer.root.findByType("output").props.kartu.name, "Hook Loaded");
  act(() => renderer.update(view(false)));
  assert.equal(renderer.root.findByType("output").props.kartu, null);
  assert.ok(renders.includes(undefined));
  assert.equal(calls, 1);
});

test("the hook defaults to Chess.com, follows platform changes, and reuses each platform cache", async (tes) => {
  lingkungan(tes);
  const urls = [];
  gantiGlobal(tes, "fetch", async (url) => {
    urls.push(url);
    if (url.startsWith("https://lichess.org/")) return respons(profilLichess("cross-platform", "Lichess", "Hook"));
    return url.endsWith("/stats") ? respons({}) : respons({ name: "Chess Hook" });
  });
  function Probe({ platform }) {
    const kartu = useKartuPemain("hook-platform", true, platform);
    return React.createElement("output", { kartu });
  }
  let renderer;
  await act(async () => { renderer = TestRenderer.create(React.createElement(Probe)); await flush(); });
  tes.after(() => act(() => renderer.unmount()));
  assert.equal(renderer.root.findByType("output").props.kartu.name, "Chess Hook");
  await act(async () => { renderer.update(React.createElement(Probe, { platform: "lichessOrg" })); await flush(); });
  assert.equal(renderer.root.findByType("output").props.kartu.name, "Lichess Hook");
  await act(async () => { renderer.update(React.createElement(Probe, { platform: "chessCom" })); await flush(); });
  assert.equal(renderer.root.findByType("output").props.kartu.name, "Chess Hook");
  assert.deepEqual(urls, [
    "https://api.chess.com/pub/player/hook-platform",
    "https://api.chess.com/pub/player/hook-platform/stats",
    "https://lichess.org/api/user/hook-platform",
  ]);
});

test("profile hook ignores stale results after a name change and renders nothing after unmount", async (tes) => {
  lingkungan(tes);
  const requests = new Map();
  gantiGlobal(tes, "fetch", async (url) => {
    const request = tertunda();
    requests.set(url.split("/").at(-1), request);
    return await request.promise;
  });
  const renders = [];
  const view = (nama) => React.createElement(ProfilUji, { nama, onRender: (value) => renders.push(value) });
  let renderer;
  act(() => { renderer = TestRenderer.create(view("hook-old")); });
  act(() => renderer.update(view("hook-new")));
  await act(async () => { requests.get("hook-new").resolve(respons(profilLichess("new", "New", "Hook"))); await flush(); });
  assert.equal(renderer.root.findByType("output").props.kartu.name, "New Hook");
  await act(async () => { requests.get("hook-old").resolve(respons(profilLichess("old", "Old", "Hook"))); await flush(); });
  assert.equal(renderer.root.findByType("output").props.kartu.name, "New Hook");
  act(() => renderer.update(view("hook-unmount")));
  act(() => renderer.unmount());
  const sebelum = renders.length;
  await act(async () => { requests.get("hook-unmount").resolve(respons(profilLichess("unmounted", "Late", "Hook"))); await flush(); });
  assert.equal(renders.length, sebelum);
});

test("a mounted hook is not notified by an external refresh but sees it after reactivation", async (tes) => {
  lingkungan(tes);
  let calls = 0;
  gantiGlobal(tes, "fetch", async () => respons(profilLichess(`hook-refresh-${++calls}`, calls === 1 ? "Old" : "New", "Hook")));
  const view = (aktif) => React.createElement(ProfilUji, { nama: "hook-refresh", aktif });
  let renderer;
  await act(async () => { renderer = TestRenderer.create(view(true)); await flush(); });
  tes.after(() => act(() => renderer.unmount()));
  const awal = renderer.root.findByType("output").props.kartu;
  assert.equal(awal.name, "Old Hook");
  await act(async () => { assert.equal((await segarkanKartuPemain("hook-refresh", "lichessOrg")).name, "New Hook"); await flush(); });
  assert.strictEqual(renderer.root.findByType("output").props.kartu, awal);
  act(() => renderer.update(view(false)));
  await act(async () => { renderer.update(view(true)); await flush(); });
  assert.equal(renderer.root.findByType("output").props.kartu.name, "New Hook");
  assert.equal(calls, 2);
});

test("failed hook lookup remains null across reactivation until explicit refresh", async (tes) => {
  lingkungan(tes);
  let sehat = false;
  let calls = 0;
  gantiGlobal(tes, "fetch", async () => { calls++; return sehat ? respons(profilLichess("hook-retry", "Online", "Hook")) : { ok: false }; });
  const view = (aktif) => React.createElement(ProfilUji, { nama: "hook-retry", aktif });
  let renderer;
  await act(async () => { renderer = TestRenderer.create(view(true)); await flush(); });
  tes.after(() => act(() => renderer.unmount()));
  assert.equal(renderer.root.findByType("output").props.kartu, null);
  sehat = true;
  act(() => renderer.update(view(false)));
  await act(async () => { renderer.update(view(true)); await flush(); });
  assert.equal(renderer.root.findByType("output").props.kartu, null);
  assert.equal(calls, 1);
  await act(async () => { await segarkanKartuPemain("hook-retry", "lichessOrg"); await flush(); });
  assert.equal(renderer.root.findByType("output").props.kartu, null);
  act(() => renderer.update(view(false)));
  await act(async () => { renderer.update(view(true)); await flush(); });
  assert.equal(renderer.root.findByType("output").props.kartu.name, "Online Hook");
  assert.equal(calls, 2);
});

test("flag URLs validate country codes and honor root and subpath base paths", (tes) => {
  const original = process.env.NEXT_PUBLIC_BASE_PATH;
  tes.after(() => {
    if (original === undefined) delete process.env.NEXT_PUBLIC_BASE_PATH;
    else process.env.NEXT_PUBLIC_BASE_PATH = original;
  });
  for (const [base, prefix] of [[undefined, ""], ["", ""], ["/Maestro-Chess", "/Maestro-Chess"], ["/Maestro-Chess///", "/Maestro-Chess"]]) {
    if (base === undefined) delete process.env.NEXT_PUBLIC_BASE_PATH;
    else process.env.NEXT_PUBLIC_BASE_PATH = base;
    assert.equal(urlBendera(" ID "), `${prefix}/flags/id.svg`);
    assert.equal(urlBendera("GB-ENG"), `${prefix}/flags/gb-eng.svg`);
    // Validation checks syntax only; it does not check whether this file exists.
    assert.equal(urlBendera("zz"), `${prefix}/flags/zz.svg`);
    for (const invalid of [undefined, null, "", "i", "id/../us", "gb-eng-extra", "12", "💡"]) {
      assert.equal(urlBendera(invalid), null);
    }
  }
});
