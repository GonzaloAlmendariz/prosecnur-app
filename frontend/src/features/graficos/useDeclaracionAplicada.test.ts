import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// ADR 0096 decisión 8, enmendada por ADR 0103: `useDeclaracionAplicada` sólo lleva los avisos de la siembra del
// compartido (`preflight.equivalencias.avisos`) a «Avisos del informe» de Láminas; el estado de la declaración aplicada
// (al día, desfasada…) se retiró con el sello de la matriz.
// Sin DOM en vitest el hook no se monta: se fija que exista y quién lo consume.

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const fuente = (rel: string) => fs.readFileSync(path.join(AQUI, rel), "utf8");

function archivosDeProducto(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) return archivosDeProducto(abs);
    if (!entry.isFile() || !/\.tsx?$/.test(entry.name) || /\.(?:test|spec)\./.test(entry.name)) return [];
    return [abs];
  });
}

describe("useDeclaracionAplicada · avisos de la siembra", () => {
  it("el hook existe y se exporta", async () => {
    const mod = await import("./useDeclaracionAplicada");
    expect(typeof mod.useDeclaracionAplicada).toBe("function");
  });

  // ADR 0103: la matriz ya no arma láminas, así que no hay estado de «declaración aplicada» que calcular.
  // Mata: reintroducir el sello o el aviso de desfase.
  it("no queda cálculo del estado de la declaración ni aviso de desfase", async () => {
    const fuentes = archivosDeProducto(AQUI);
    expect(fuentes.length).toBeGreaterThan(100);
    const llamadores = fuentes.filter((f) => /\bestadoDeclaracionAplicada\(|equivalenciasRevision/.test(fs.readFileSync(f, "utf8")));
    expect(llamadores).toEqual([]);
    const mod = await import("./useDeclaracionAplicada");
    expect(Object.keys(mod).sort()).toEqual(["fijarAvisosSiembraCompartido", "useDeclaracionAplicada"]);
  });

  it("Láminas lo consume para los avisos de la siembra", () => {
    expect(fuente("laminas/LaminasWorkbench.tsx")).toContain("useDeclaracionAplicada(");
  });

  // F8: el aviso `sin_matriz` del preflight llega a «Avisos del informe» de Láminas por el grupo de equivalencias.
  it("Láminas pasa los avisos de equivalencias al agrupar los avisos del informe", () => {
    const src = fuente("laminas/LaminasWorkbench.tsx");
    const linea = src.split("\n").find((l) => l.includes("agruparAvisos(")) ?? "";
    expect(linea).toMatch(/equivalencias|avisosEquivalencias|declaracion/i);
  });
});
