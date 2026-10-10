"use strict";

// Contrato del afterPack que mete LibreOffice en el .app de macOS (F6.0b, plan de empaquetado P6).

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const afterPack = require("../scripts/after-pack-mac.cjs");
const { archName, stagedPreviewRendererApp, macResourcesDir, embeddedPreviewRendererApp, embedPreviewRenderer } = afterPack;
const { resolvePreviewRendererDir } = require("../preview-renderer.cjs");
const pkg = require("../package.json");

test("traduce el enum de builder-util a la arch del staging", () => {
  assert.equal(archName(1), "x64");
  assert.equal(archName(3), "arm64");
  assert.equal(archName("arm64"), "arm64");
  assert.throws(() => archName(99), /desconocida/);
});

test("el staging vive por arch en packaging/macos/preview-renderer", () => {
  assert.equal(
    stagedPreviewRendererApp(3, "/repo"),
    path.join("/repo", "packaging", "macos", "preview-renderer", "arm64", "LibreOffice.app")
  );
});

test("la copia anidada queda donde desktop/preview-renderer.cjs la busca y donde R espera soffice", () => {
  const context = { appOutDir: "/out/mac-arm64", packager: { appInfo: { productFilename: "Prosecnur" } } };
  const resources = macResourcesDir(context);
  assert.equal(resources, path.join("/out/mac-arm64", "Prosecnur.app", "Contents", "Resources"));
  const internals = path.join(resources, "Internals");
  const embedded = embeddedPreviewRendererApp(resources);
  const rendererDir = path.dirname(embedded);
  assert.equal(resolvePreviewRendererDir(internals, {}, (p) => p === rendererDir), rendererDir);
  // api/R/router_graficos.R, .bundled_soffice_candidates: <root>/LibreOffice.app/Contents/MacOS/soffice.
  assert.equal(path.basename(embedded), "LibreOffice.app");
});

test("falla cerrado si no hay staging y no llama a ditto", () => {
  const llamadas = [];
  assert.throws(
    () => embedPreviewRenderer({
      resourcesDir: "/no/existe",
      stagedApp: "/no/existe/LibreOffice.app",
      run: (...args) => llamadas.push(args),
      exists: () => false,
      log: () => {}
    }),
    /stage-preview-renderer\.sh/
  );
  assert.equal(llamadas.length, 0);
});

test("copia con ditto y verifica la firma sobre la copia anidada, en ese orden", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "after-pack-mac-"));
  try {
    const resources = path.join(tmp, "Resources");
    const staged = path.join(tmp, "stage", "LibreOffice.app");
    const llamadas = [];
    const destino = embedPreviewRenderer({
      resourcesDir: resources,
      stagedApp: staged,
      run: (cmd, args) => llamadas.push([cmd, ...args]),
      exists: () => true,
      log: () => {}
    });
    assert.equal(destino, path.join(resources, "Internals", "preview-renderer", "LibreOffice.app"));
    assert.deepEqual(llamadas, [
      ["ditto", staged, destino],
      ["codesign", "--verify", "--deep", "--strict", destino]
    ]);
    assert.ok(fs.existsSync(path.dirname(destino)));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("package.json engancha el afterPack y lleva el aviso de LibreOffice junto al LICENSE", () => {
  assert.equal(pkg.build.afterPack, "scripts/after-pack-mac.cjs");
  const recursos = pkg.build.extraResources;
  const destinos = recursos.map((r) => r.to);
  assert.ok(destinos.includes("LICENSE"));
  const aviso = recursos.find((r) => r.to === "LIBREOFFICE-NOTICE.md");
  assert.ok(aviso, "falta LIBREOFFICE-NOTICE.md en extraResources");
  assert.ok(fs.existsSync(path.resolve(__dirname, "..", aviso.from)));
  // LibreOffice NO entra por extraResources: rompería los symlinks de sus frameworks y con ellos la firma.
  assert.ok(!recursos.some((r) => String(r.from).includes("preview-renderer")));
});

test("no corre fuera de macOS más allá de la limpieza de atributos", async () => {
  await afterPack({ electronPlatformName: "win32" });
});
