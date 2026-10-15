// I1 del rediseño (2026-10-14): el Informe pinta maquetas, no miniaturas del motor («cómo se ve en PowerPoint se queda
// en Láminas»). Mata: volver a pedir el lote de miniaturas desde el Informe (LibreOffice por cada tarjeta) o pintar la
// imagen del motor dentro de la tarjeta.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dir = path.dirname(fileURLToPath(import.meta.url));
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const leer = (f: string) => sinComentarios(fs.readFileSync(path.join(dir, f), "utf8"));

describe("Informe · maquetas en vez de miniaturas", () => {
  it("la tarjeta monta MaquetaTarjeta y no la miniatura del motor", () => {
    const tarjeta = leer("TarjetaLamina.tsx");
    expect(tarjeta).toContain("<MaquetaTarjeta");
    expect(tarjeta).not.toContain("ContenidoMiniatura");
  });

  it("el Informe no pide el lote de miniaturas", () => {
    expect(leer("VistaGeneral.tsx")).not.toMatch(/useMiniaturasLote|useTarjetasVistas/);
  });

  it("la maqueta usa las ranuras reales de la composición y la paleta de la pregunta, sin botones", () => {
    const maqueta = leer("MaquetaTarjeta.tsx");
    expect(maqueta).toContain("ranurasDeMaqueta(");
    expect(maqueta).toContain("coloresDeEscala(");
    expect(maqueta).not.toContain("<button");
  });
});
