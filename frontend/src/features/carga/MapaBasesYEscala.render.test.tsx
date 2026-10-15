// G1 y G3: lo que se ve del mapa de bases y de «Aplicar a otras con la misma escala».
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { VariableDeBase } from "../../api/equivalencias";
import { aFilasEditor } from "./equivalenciasEditorModel";
import { MapaBasesCuerpo } from "./MapaBasesPanel";
import { EscalaCompartidaAviso, EscalaCompartidaLista } from "./ArmonizacionEscalaCompartida";
import type { CandidatoEscala } from "./escalaCompartidaModel";

const sinAccion = () => undefined;
const v = (name: string, label = name): VariableDeBase => ({ name, label, seccion: "" });

const variablesPorBase: Record<string, VariableDeBase[]> = {
  "2024": Array.from({ length: 400 }, (_, i) => v(`p${i + 1}`, `Pregunta ${i + 1} de 2024`)),
  "2025": [v("q1", "Edad"), v("q2", "Sexo")],
};
const filas = aFilasEditor([
  { seccion: "", etiqueta_estandar: "Edad", variables: { "2024": "p1", "2025": "q1" }, cantidad: 2 },
  { seccion: "", etiqueta_estandar: "Sexo", variables: { "2025": "q2" }, cantidad: 1 },
]);
const bases = ["2024", "2025"];
const cuerpo = (extra: Partial<Parameters<typeof MapaBasesCuerpo>[0]> = {}) =>
  renderToStaticMarkup(createElement(MapaBasesCuerpo, {
    cargando: false, bases, filas, variablesPorBase, foco: null, onIr: sinAccion, onAnadir: sinAccion, ...extra,
  }));

describe("mapa de bases", () => {
  it("resumen por base y la matriz con un indicador por base", () => {
    const html = cuerpo();
    expect(html).toContain("400 variables");
    expect(html).toContain("1 en la matriz · 399 fuera");
    expect(html).toContain("2 en la matriz · 0 fuera");
    expect(html).toContain("Ver las 399 fuera");
    expect(html).toContain("Todas en la matriz");
    expect(html).toContain("Preguntas de la matriz");
    expect(html).toContain("1 falta en alguna base.");
    expect(html).toContain("Falta");
    expect(html).toContain('data-qa-geometry-group="carga-mapa-bases-base"');
    expect((html.match(/data-qa-geometry-member/g) ?? []).length).toBe(2);
  });

  it("con foco en una base, sus variables fuera de la matriz con «Añadir a la matriz»", () => {
    const html = cuerpo({ foco: "2024" });
    expect(html).toContain("Fuera de la matriz en 2024");
    expect(html).toContain("399 variables");
    expect((html.match(/Añadir a la matriz<\/button>/g) ?? []).length).toBe(399);
    expect(html).toContain('aria-label="Añadir a la matriz: p2 de 2024"');
    expect(html).toContain('aria-current="true"');
    expect(html).not.toContain("Preguntas de la matriz");
  });

  it("cada vacío dice el suyo", () => {
    expect(cuerpo({ foco: "2025" })).toContain("Todas las variables de 2025 están en la matriz.");
    expect(cuerpo({ foco: "1999" })).toContain("La base «1999» no está en este estudio.");
    expect(cuerpo({ filas: [] })).toContain("Todavía no hay preguntas en la matriz.");
    expect(cuerpo({ cargando: true })).toContain("Leyendo la matriz");
    expect(cuerpo({ bases: [] })).toContain("todavía no tiene bases que comparar");
  });
});

describe("aplicar a otras con la misma escala", () => {
  const candidato = (indice: number, reemplaza: boolean): CandidatoEscala => ({
    indice,
    etiqueta: `Frecuencia ${indice}`,
    variables: [{ base: "2024", variable: `p${indice}` }, { base: "2025", variable: `q${indice}` }],
    armonizacion: { escala: [], por_base: {} },
    reemplaza,
  });

  it("sin otras no hay aviso; con otras dice cuántas", () => {
    expect(renderToStaticMarkup(createElement(EscalaCompartidaAviso, { n: 0, onVer: sinAccion }))).toBe("");
    const html = renderToStaticMarkup(createElement(EscalaCompartidaAviso, { n: 18, onVer: sinAccion }));
    expect(html).toContain("Otras 18 preguntas usan esta misma escala.");
    expect(html).toContain("Aplicar a otras con la misma escala");
  });

  it("la lista marca las elegidas, avisa la que reemplaza y cuenta las parciales", () => {
    const html = renderToStaticMarkup(createElement(EscalaCompartidaLista, {
      candidatos: [candidato(1, false), candidato(2, true)],
      parciales: 3,
      elegidos: new Set([1]),
      guardaOrigen: true,
      onAlternar: sinAccion,
      onTodas: sinAccion,
    }));
    expect(html).toContain("Preguntas con la misma escala");
    expect(html).toContain("2024 p1 · 2025 q1");
    expect(html).toContain("Ya armonizada");
    expect(html).toContain("Esta pregunta también se guarda.");
    expect(html).toContain("3 preguntas casan sólo en algunas de sus bases y quedan fuera");
    expect((html.match(/checked=""/g) ?? []).length).toBe(1);
  });
});
