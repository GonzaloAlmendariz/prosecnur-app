import { describe, expect, test } from "vitest";
import { isDynamicImportLoadError, moduloConComponente, recargarSiElBuildCambio } from "./lazyWithReload";

describe("isDynamicImportLoadError", () => {
  test("detects Vite dynamic import failures", () => {
    expect(
      isDynamicImportLoadError(
        new TypeError(
          "Failed to fetch dynamically imported module: http://127.0.0.1:8787/assets/DashboardPage-old.js",
        ),
      ),
    ).toBe(true);
  });

  test("detects common chunk load failures", () => {
    expect(isDynamicImportLoadError(new Error("Loading chunk 42 failed."))).toBe(true);
    expect(isDynamicImportLoadError(new Error("ChunkLoadError: loading CSS chunk failed"))).toBe(true);
  });

  test("ignores unrelated runtime errors", () => {
    expect(isDynamicImportLoadError(new Error("Cannot read properties of null"))).toBe(false);
  });
});

describe("moduloConComponente", () => {
  test("un módulo servido vacío es un fallo de carga que nombra el módulo, no un #306", () => {
    let error: unknown;
    try {
      moduloConComponente({}, "GraficosPage");
    } catch (e) {
      error = e;
    }
    expect(String(error)).toContain("GraficosPage");
    expect(isDynamicImportLoadError(error)).toBe(true);
  });

  test("deja pasar un componente función o un lazy/memo (objeto)", () => {
    const fn = () => null;
    expect(moduloConComponente({ default: fn }, "X").default).toBe(fn);
    const memo = { $$typeof: Symbol.for("react.memo") };
    expect(moduloConComponente({ default: memo }, "X").default).toBe(memo);
  });
});

describe("recargarSiElBuildCambio", () => {
  test("un error ajeno a la carga del chunk no recarga", () => {
    expect(recargarSiElBuildCambio(new Error("Cannot read properties of null"), "monitoreo-territorial")).toBe(false);
  });
});
