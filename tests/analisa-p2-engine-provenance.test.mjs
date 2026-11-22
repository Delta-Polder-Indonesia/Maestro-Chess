import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { basename, join } from "node:path";
import test from "node:test";
import { gunzipSync } from "node:zlib";
import { DAFTAR_ENGINE } from "../src/lib/engineCatur.js";

// Each source archive is pinned by SHA-256 in analisa-engine.test.mjs. Keep
// this map explicit: package versions are not always engine versions, and the
// 18.0.5 source snapshot has the same src/ and build.js as the 18.0.0 release.
const sumber = [
  { id: "stockfish-16", label: "16", sha: "efc5758a1cf72ec7644fa771a1f17fcbfdae410e", suffix: "-no-networks", version: "16.0.0", header: "evaluate.h", macro: "EvalFileDefaultName", net: "nn-5af11540bbfe.nnue" },
  { id: "stockfish-16.1-lite", label: "16.1", sha: "215df8c6a72847e306644d399733de18fb8e0d6c", suffix: "-source-only", version: "16.1.0", header: "lite_nets.h", macro: "EvalFileDefaultNameBig", net: "nn-9067e33176e8.nnue" },
  { id: "stockfish-17-lite", label: "17.1", sha: "602fd7e1a571a2be71f242942db90483731f2a1f", suffix: "-source-only", version: "17.1.0", header: "lite_nets.h", macro: "EvalFileDefaultNameBig", net: "nn-9067e33176e8.nnue" },
  { id: "stockfish-18-lite", label: "18", sha: "082eeba46b0c5f8f8065e5386750aa0ecfa2062c", suffix: "", version: "18.0.5", header: "lite_nets.h", macro: "EvalFileDefaultNameBig", net: "nn-9067e33176e8.nnue" },
  { id: "stockfish-18.0.8-lite", label: "18 (JS 18.0.8)", sha: "93c994592dcf3b4b21052ab925e9b534df9c0918", suffix: "", version: "18.0.8", header: "lite_nets.h", macro: "EvalFileDefaultNameBig", net: "nn-9067e33176e8.nnue" },
  { id: "stockfish-19-lite", label: "19", sha: "0d5dd7944f88c817c07a26bc4fb1905d5f9c46d6", suffix: "", version: "19.0.1", header: "evaluate.h", macro: "EvalFileLiteName", net: "nn-61e7af4bb97d.nnue" },
];

function archiveName(item) {
  return `stockfish.js-${item.sha}${item.suffix}.tar.gz`;
}

// Read regular, short-name entries from these fixed upstream tar archives
// without requiring a platform-specific tar executable in the test suite.
function tarEntry(tar, name) {
  for (let offset = 0; offset + 512 <= tar.length;) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    const field = (start, length) => header.subarray(start, start + length).toString("utf8").split("\0")[0];
    const path = [field(345, 155), field(0, 100)].filter(Boolean).join("/");
    const rawSize = field(124, 12).trim();
    const size = rawSize ? Number.parseInt(rawSize, 8) : 0;
    assert.ok(Number.isSafeInteger(size) && size >= 0, `bad tar entry size: ${path}`);
    const start = offset + 512;
    assert.ok(start + size <= tar.length, `truncated tar entry: ${path}`);
    if (path === name) {
      assert.ok(header[156] === 0 || header[156] === 48, `not a regular file: ${name}`);
      return tar.subarray(start, start + size);
    }
    offset = start + Math.ceil(size / 512) * 512;
  }
  throw new Error(`Missing tar entry: ${name}`);
}

// Decode the fixed WebAssembly binaries' active data segments. The embedded
// NNUE is split across many segments; reconstructing initial linear memory
// permits an exact byte comparison with the separately supplied source net.
function leb128(bytes, position, signed = false) {
  let result = 0;
  let shift = 0;
  let byte;
  do {
    assert.ok(position < bytes.length && shift < 35, "invalid WASM integer");
    byte = bytes[position++];
    result += (byte & 0x7f) * 2 ** shift;
    shift += 7;
  } while (byte & 0x80);
  if (signed && (byte & 0x40)) result -= 2 ** shift;
  return [result, position];
}

function initialMemory(wasm) {
  assert.equal(wasm.subarray(0, 8).toString("hex"), "0061736d01000000");
  let offset = 8;
  let data;
  while (offset < wasm.length) {
    const id = wasm[offset++];
    let size;
    [size, offset] = leb128(wasm, offset);
    assert.ok(offset + size <= wasm.length, "truncated WASM section");
    if (id === 11) {
      data = wasm.subarray(offset, offset + size);
      break;
    }
    offset += size;
  }
  assert.ok(data, "WASM has no data section");
  offset = 0;
  let count;
  [count, offset] = leb128(data, offset);
  const segments = [];
  let memorySize = 0;
  for (let i = 0; i < count; i++) {
    let flags;
    [flags, offset] = leb128(data, offset);
    let destination = null;
    if (flags === 0 || flags === 2) {
      if (flags === 2) {
        let memory;
        [memory, offset] = leb128(data, offset);
        assert.equal(memory, 0, "unexpected WASM memory index");
      }
      assert.equal(data[offset++], 0x41, "expected i32.const offset");
      [destination, offset] = leb128(data, offset, true);
      assert.ok(destination >= 0, "negative WASM data offset");
      assert.equal(data[offset++], 0x0b, "unterminated WASM offset");
    } else {
      assert.equal(flags, 1, "unsupported WASM data segment");
    }
    let size;
    [size, offset] = leb128(data, offset);
    assert.ok(offset + size <= data.length, "truncated WASM data segment");
    if (destination !== null) {
      segments.push([destination, data.subarray(offset, offset + size)]);
      memorySize = Math.max(memorySize, destination + size);
    }
    offset += size;
  }
  assert.ok(memorySize <= 64 * 1024 * 1024, "unexpected WASM data size");
  const memory = Buffer.alloc(memorySize);
  for (const [destination, bytes] of segments) bytes.copy(memory, destination);
  return memory;
}

test("each engine links its pinned source and the source names the supplied NNUE", () => {
  assert.deepEqual(sumber.map(({ id }) => id), DAFTAR_ENGINE.map(({ id }) => id));
  const page = readFileSync("src/app/attributions/page.tsx", "utf8");
  const notices = readFileSync("ATTRIBUTIONS", "utf8");
  assert.match(notices, /Stockfish 19: npm stockfish@19\.0\.1 and release v19\.0\.1/);
  assert.doesNotMatch(notices, /stockfish@19\.0\.0/);
  for (const item of sumber) {
    const archive = archiveName(item);
    assert.ok(page.includes(`<Local href="engine/source/${archive}">${item.label}</Local>`), item.id);
    const tar = gunzipSync(readFileSync(join("public/engine/source", archive)));
    const root = `stockfish.js-${item.sha}`;
    const pkg = JSON.parse(tarEntry(tar, `${root}/package.json`).toString("utf8"));
    assert.equal(pkg.version, item.version, item.id);
    assert.ok(tarEntry(tar, `${root}/build.js`).length > 0, item.id);
    assert.ok(tarEntry(tar, `${root}/src/Makefile`).length > 0, item.id);
    const header = tarEntry(tar, `${root}/src/${item.header}`).toString("utf8");
    assert.match(header, new RegExp(`#define\\s+${item.macro}\\s+"${item.net.replace(/\./g, "\\.")}"`), item.id);
    const netDir = item.id === "stockfish-16" ? "public/engine" : "public/engine/source";
    assert.ok(readFileSync(join(netDir, item.net)).length > 0, item.id);
  }
});

test("each Lite WASM embeds the exact NNUE supplied with its corresponding source", () => {
  for (const item of sumber.filter(({ id }) => id !== "stockfish-16")) {
    const engine = DAFTAR_ENGINE.find(({ id }) => id === item.id);
    const file = basename(engine.url).replace(/\.js$/, ".wasm");
    const wasm = readFileSync(join("public/engine", file));
    const net = readFileSync(join("public/engine/source", item.net));
    assert.ok(initialMemory(wasm).includes(net), `${item.id}: embedded NNUE differs from ${item.net}`);
  }
});
