import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

// «Salidas» mostraba RECIBIDAS 3 700 · PROCESABLES 3 700 · VÁLIDAS 3 700 y, al no
// haber saltos, la lista «Por qué bajan los conteos» desaparecía entera. Quedaban
// tres cifras idénticas sin nada que dijera si el filtro corrió y no perdió a
// nadie, o si no había filtro que correr —que es el caso en aulas: la base no
// trae columna de estado, y eso sólo lo dice un control de otra pestaña—.
//
// La superficie no puede explicar el porqué, que es de cada estudio. Sí puede
// afirmar el hecho.

const fuente = fs.readFileSync(
  path.resolve(__dirname, "MonitoreoOutputsReadiness.tsx"),
  "utf8",
);

describe("un embudo sin caídas lo dice", () => {
  it("se encontró la condición", () => {
    expect(fuente).toContain("const sinDescartes =");
  });

  it("exige los tres granos determinados, no sólo iguales", () => {
    // Con `oficial` en «sin determinar» no hay descarte CONOCIDO, que no es lo
    // mismo que no haber descarte. Sin estos dos guardas la frase mentiría.
    const bloque = fuente.slice(fuente.indexOf("const sinDescartes ="));
    const condicion = bloque.slice(0, bloque.indexOf(";"));
    expect(condicion).toContain("corte.procesable != null");
    expect(condicion).toContain("corte.oficial != null");
    expect(condicion).toContain("corte.ingesta === corte.procesable");
    expect(condicion).toContain("corte.procesable === corte.oficial");
  });

  it("la frase sólo aparece cuando no hay saltos", () => {
    expect(fuente).toMatch(/corte\.saltos\.length \? \([\s\S]*?\) : sinDescartes \? \(/);
  });

  it("no afirma una causa que esta superficie no conoce", () => {
    const frase = fuente.slice(fuente.indexOf("mon-outputs-readiness__sin-saltos"));
    const texto = frase.slice(0, frase.indexOf("</p>"));
    expect(texto).toContain("no se descarta ningún caso");
    expect(texto).not.toMatch(/columna de estado|filtro no|sin filtro/);
  });
});
