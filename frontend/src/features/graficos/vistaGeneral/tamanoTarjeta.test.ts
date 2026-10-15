// I10 del rediseño (2026-10-14). Mata: un tamaño que no se aplica a la vista, que no se recuerda, o que rompe la vista
// cuando el navegador bloquea el almacenamiento.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";

const dir = path.dirname(fileURLToPath(import.meta.url));

describe("tamaño de las tarjetas del Informe", () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

  it("la vista lleva data-tamano y el CSS define los tres anchos de caja", () => {
    expect(fs.readFileSync(path.join(dir, "VistaGeneral.tsx"), "utf8")).toContain("data-tamano={tamano}");
    const css = fs.readFileSync(path.join(dir, "vistaGeneral.css"), "utf8");
    expect(css).toContain("--pulso-f6-vg-caja: 220px");
    expect(css).toMatch(/\[data-tamano="grande"\] \{ --pulso-f6-vg-caja: 300px; \}/);
    expect(css).toMatch(/\[data-tamano="chico"\] \{ --pulso-f6-vg-caja: 160px; \}/);
  });

  it("se recuerda y, sin almacenamiento, vuelve a Medio sin romper", async () => {
    const guardado: Record<string, string> = {};
    vi.stubGlobal("localStorage", { getItem: (k: string) => guardado[k] ?? null, setItem: (k: string, v: string) => { guardado[k] = v; } });
    const { useVistaGeneralUi } = await import("./vistaGeneralStore");
    expect(useVistaGeneralUi.getState().tamano).toBe("medio");
    useVistaGeneralUi.getState().setTamano("chico");
    expect(Object.values(guardado)).toEqual(["chico"]);

    vi.resetModules();
    vi.stubGlobal("localStorage", { getItem: () => { throw new Error("bloqueado"); }, setItem: () => { throw new Error("bloqueado"); } });
    const otra = await import("./vistaGeneralStore");
    expect(otra.useVistaGeneralUi.getState().tamano).toBe("medio");
    expect(() => otra.useVistaGeneralUi.getState().setTamano("grande")).not.toThrow();
    expect(otra.useVistaGeneralUi.getState().tamano).toBe("grande");
  });
});
