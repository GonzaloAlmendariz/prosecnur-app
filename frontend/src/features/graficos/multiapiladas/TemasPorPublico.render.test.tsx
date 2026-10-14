import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { VarWithSource } from "../useVariables";
import { fuentesDeMatriz, SIN_MATRIZ } from "./sugerenciasMatriz";
import { TemasPorPublico } from "./TemasPorPublico";

vi.mock("../VariablePicker", () => ({ default: () => createElement("span", { "data-picker": "" }) }));

const pubs = ["docentes", "administrativos", "estudiantes"];
const v = (source: string, name: string, scale_signature: string) =>
  ({ source, name, label: `Etiqueta ${name}`, tipo: "select_one", seccion: "", scale_signature }) as VarWithSource;
const vars = [v("docentes", "p12_1", "sat5"), v("administrativos", "p10_1", "sat5"), v("estudiantes", "p11_1", "sat4")];
const matriz = fuentesDeMatriz([
  { etiqueta_estandar: "Servicio de salud", variables: { docentes: "p12_1", administrativos: "p10_1" } },
  { etiqueta_estandar: "Salud con otra escala", variables: { docentes: "p12_1", estudiantes: "p11_1" } },
]);
const render = (m = matriz) => renderToStaticMarkup(createElement(TemasPorPublico, {
  temas: [{ key: "tema_1", title: "", vars: ["docentes$p12_1"] }], publicos: pubs, variables: vars, matriz: m,
  onChange: () => undefined, nuevoTema: (n: number) => ({ key: `tema_${n}`, title: "", vars: [] }),
}));

describe("la línea vacía muestra la sugerencia de la matriz (P20)", () => {
  it("sólo sugiere lo declarado: «Equivalente según tu matriz», la escala distinta dicha y fuera del lote", () => {
    const html = render();
    expect(html).toContain("Equivalente según tu matriz: <code>p10_1</code> · Etiqueta p10_1");
    expect(html).toContain("Equivalente según tu matriz: <code>p11_1</code>");
    expect(html).toContain("pulso-mapi-sugerencia is-otra-escala");
    expect(html).toContain("otra escala");
    expect(html).not.toContain("Parece la misma pregunta");
    expect(html).toContain("Completar con la matriz");
    // El lote sólo lleva la de la misma escala.
    expect(html).toContain('aria-label="Completar con la matriz el público vacío de este tema"');
  });
  it("ADR 0104: una propuesta guardada sin confirmar no ofrece chip ni lote", () => {
    const html = render(fuentesDeMatriz([
      { etiqueta_estandar: "Propuesta", variables: { docentes: "p12_1", administrativos: "p10_1" }, sugerida: true },
    ]));
    expect(html).not.toContain("pulso-mapi-sugerencia");
    expect(html).not.toContain("Completar con la matriz");
  });
  it("sin matriz no hay chip ni botón de lote", () => {
    const html = render(SIN_MATRIZ);
    expect(html).not.toContain("pulso-mapi-sugerencia");
    expect(html).not.toContain("Completar con la matriz");
  });
});
