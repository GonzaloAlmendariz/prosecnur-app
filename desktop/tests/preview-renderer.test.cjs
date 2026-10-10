"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const { resolvePreviewRendererDir } = require("../preview-renderer.cjs");

const root = path.join("/Applications", "Prosecnur.app", "Contents", "Resources", "Internals");

test("en macOS encuentra el LibreOffice empaquetado junto a Internals", () => {
  const esperado = path.join(root, "preview-renderer");
  assert.equal(resolvePreviewRendererDir(root, {}, (p) => p === esperado), esperado);
});

test("en Windows también lo busca en runtime/, junto a los otros binarios de terceros", () => {
  const winRoot = path.join("C:", "Prosecnur", "Internals");
  const esperado = path.join("C:", "Prosecnur", "runtime", "preview-renderer");
  assert.equal(resolvePreviewRendererDir(winRoot, {}, (p) => p === esperado), esperado);
});

test("respeta la variable ya definida y devuelve vacío si no hay renderer", () => {
  assert.equal(resolvePreviewRendererDir(root, { PROSECNUR_PREVIEW_RENDERER_DIR: "/dev/lo" }, () => true), "/dev/lo");
  assert.equal(resolvePreviewRendererDir(root, {}, () => false), "");
  assert.equal(resolvePreviewRendererDir(root, {}, () => { throw new Error("EACCES"); }), "");
});
