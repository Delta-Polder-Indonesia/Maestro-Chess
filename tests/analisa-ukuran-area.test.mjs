import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import TestRenderer from "react-test-renderer";
import { cukupRuangSejajar, useUkuranArea } from "../src/halaman/Analisa/komponen/useUkuranArea.js";

const { act } = TestRenderer;

test("the panel only moves alongside when the available workspace keeps the board at least as large", () => {
  assert.equal(cukupRuangSejajar(890, 764), false);
  assert.equal(cukupRuangSejajar(1052, 764), false);
  assert.equal(cukupRuangSejajar(1195, 764), false);
  assert.equal(cukupRuangSejajar(1196, 764), true);
  assert.equal(cukupRuangSejajar(1100, 1044), false, "a tall screen needs more horizontal space");
  assert.equal(cukupRuangSejajar(1476, 1044), true);
  assert.equal(cukupRuangSejajar(2000, 299), false, "a very short screen uses a scrollable column");
  assert.equal(cukupRuangSejajar(1156, 614), true, "a short report still fits side by side");
});

test("without ResizeObserver the sidebar mutation and window resize update the workspace and are cleaned up", async (t) => {
  const sebelumnya = { window: globalThis.window, ResizeObserver: globalThis.ResizeObserver, MutationObserver: globalThis.MutationObserver };
  t.after(() => {
    for (const [key, value] of Object.entries(sebelumnya)) {
      if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
    }
  });

  const pendengar = new Map();
  globalThis.window = {
    innerWidth: 1440,
    addEventListener: (jenis, fn) => pendengar.set(jenis, fn),
    removeEventListener: (jenis) => pendengar.delete(jenis),
  };
  globalThis.ResizeObserver = undefined;
  const pengamat = [];
  globalThis.MutationObserver = class {
    constructor(callback) { this.callback = callback; this.diamati = []; pengamat.push(this); }
    observe(elemen, opsi) { this.diamati.push({ elemen, opsi }); }
    disconnect() { this.terputus = true; }
  };

  const bilah = {};
  const root = { querySelector: (selector) => selector === "nav" ? bilah : null };
  const main = { clientWidth: 1230, clientHeight: 864, closest: (selector) => selector === ".analisa-root" ? root : null };
  const isi = { closest: (selector) => selector === "main" ? main : null };
  let ukuran;
  let renders = 0;
  function Harness() {
    const wadahRef = React.useRef(null);
    const isiRef = React.useRef(null);
    ukuran = useUkuranArea(wadahRef, isiRef);
    renders++;
    return React.createElement("main", { ref: wadahRef }, React.createElement("div", { ref: isiRef }));
  }
  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(React.createElement(Harness), { createNodeMock: (element) => element.type === "main" ? main : isi });
  });
  assert.deepEqual(ukuran, { lebar: 1230, tinggi: 864, navDiAtas: false, sejajar: false });
  assert.equal(pengamat.length, 1);
  assert.deepEqual(pengamat[0].diamati, [
    { elemen: bilah, opsi: { attributes: true, attributeFilter: ["class"] } },
    { elemen: root, opsi: { attributes: true, attributeFilter: ["style"] } },
  ]);

  main.clientWidth = 1392;
  await act(async () => { pengamat[0].callback(); });
  assert.deepEqual(ukuran, { lebar: 1392, tinggi: 864, navDiAtas: false, sejajar: true });
  const sebelum = renders;
  await act(async () => { pengamat[0].callback(); });
  // React may enter the component once to bail out on the identical state;
  // the returned dimensions themselves must stay referentially unchanged.
  const tetap = ukuran;
  await act(async () => { pengamat[0].callback(); });
  assert.equal(ukuran, tetap);
  assert.ok(renders <= sebelum + 1);

  globalThis.window.innerWidth = 1920;
  main.clientWidth = 1872;
  await act(async () => { pendengar.get("resize")(); });
  assert.equal(ukuran.tinggi, 864, "resize may run before the root height is committed");
  main.clientHeight = 1044;
  await act(async () => { pengamat[0].callback(); });
  assert.equal(ukuran.tinggi, 1044, "the later root style mutation corrects the height");

  globalThis.window.innerWidth = 515;
  main.clientWidth = 515;
  main.clientHeight = 724;
  await act(async () => { pendengar.get("resize")(); });
  assert.deepEqual(ukuran, { lebar: 515, tinggi: 724, navDiAtas: true, sejajar: false });
  await act(async () => { renderer.unmount(); });
  assert.equal(pengamat[0].terputus, true);
  assert.equal(pendengar.has("resize"), false);
});
