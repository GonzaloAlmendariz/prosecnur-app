import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

// «Modelo > Resumen» decía «100% de 1,200 entrevistas» con 1 693 respuestas: el
// 141 % real se perdía en un `Math.min(100, …)` que servía para la barra y se
// imprimía también como texto.
//
// Pasarse de la meta es un dato del operativo, no un desbordamiento que haya que
// esconder —la pestaña vecina ya enseña «107 %»—. El techo va donde hace falta:
// el ancho de la barra, que con 141 % no cabe.
//
// Mismo molde que el detector de escala de aulas: una razón contra una meta puede
// superar el 100 %, y tratarla como si no pudiera rompe la lectura.

const workbench = fs.readFileSync(
  path.resolve(__dirname, "TerritorialModelWorkbench.tsx"),
  "utf8",
);
const atlas = fs.readFileSync(
  path.resolve(__dirname, "TerritorialRouteCoverageAtlas.tsx"),
  "utf8",
);
const sinComentarios = (t: string) =>
  t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\/[^\n]*/g, "");

describe("una razón contra una meta puede pasar del 100 %", () => {
  it("el cálculo no lleva techo", () => {
    const codigo = sinComentarios(workbench);
    expect(codigo).toContain("const progressPct = routeMeta && routeMeta > 0 ? Math.max(0, Math.round((responseCount / routeMeta) * 100)) : null;");
    expect(codigo).not.toMatch(/const progressPct = [^\n]*Math\.min\(100/);
  });

  it("el techo vive en el ancho de la barra", () => {
    const codigo = sinComentarios(atlas);
    expect(codigo).toContain('`${Math.min(100, progressPct ?? 0)}%`');
  });

  it("el texto imprime el valor sin tocar", () => {
    const codigo = sinComentarios(atlas);
    expect(codigo).toContain("`${progressPct}% de ${formatMetric(routeMeta)} entrevistas`");
  });
});
