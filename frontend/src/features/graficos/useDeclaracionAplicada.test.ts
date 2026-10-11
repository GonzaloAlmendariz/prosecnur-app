import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// ADR 0096 decisión 8: el estado de la declaración aplicada (al día, desfasada, retirada, revisión anterior, sin mazo
// derivado) se calcula en UN solo lugar —`useDeclaracionAplicada`— y lo consumen el Editor anterior (GraficosPage) y
// «Avisos del informe» de Láminas, junto con los avisos de la siembra (`preflight.equivalencias.avisos`).
// Sin DOM en vitest el hook no se monta: se fija que exista, que sea el único que llama al cálculo y quién lo consume.

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

describe("useDeclaracionAplicada · un solo lugar para el estado de la declaración", () => {
  it("el hook existe y se exporta", async () => {
    const mod = await import("./useDeclaracionAplicada");
    expect(typeof mod.useDeclaracionAplicada).toBe("function");
  });

  // Mata: volver a calcular el estado en cada superficie (el editor anterior y Láminas discreparían).
  it("sólo el hook llama a estadoDeclaracionAplicada", () => {
    const llamadores = archivosDeProducto(AQUI)
      .filter((f) => /\bestadoDeclaracionAplicada\(/.test(fs.readFileSync(f, "utf8")))
      .map((f) => path.relative(AQUI, f).split(path.sep).join("/"))
      .filter((f) => f !== "declaracionAplicada.ts");
    expect(llamadores).toEqual(["useDeclaracionAplicada.ts"]);
  });

  it("lo consumen el Editor anterior y Láminas", () => {
    expect(fuente("GraficosPage.tsx")).toContain("useDeclaracionAplicada(");
    expect(fuente("laminas/LaminasWorkbench.tsx")).toContain("useDeclaracionAplicada(");
  });

  // F8: el aviso `sin_matriz` del preflight llega a «Avisos del informe» de Láminas por el grupo de equivalencias.
  it("Láminas pasa los avisos de equivalencias al agrupar los avisos del informe", () => {
    const src = fuente("laminas/LaminasWorkbench.tsx");
    const linea = src.split("\n").find((l) => l.includes("agruparAvisos(")) ?? "";
    expect(linea).toMatch(/equivalencias|avisosEquivalencias|declaracion/i);
  });
});
