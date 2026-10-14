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
const matriz = fuentesDeMatriz([{ etiqueta_estandar: "Servicio de salud", variables: { docentes: "p12_1", administrativos: "p10_1" } }],
  [{ etiqueta_estandar: "Auto", variables: { docentes: "p12_1", estudiantes: "p11_1" } }]);
const render = (m = matriz) => renderToStaticMarkup(createElement(TemasPorPublico, {
  temas: [{ key: "tema_1", title: "", vars: ["docentes$p12_1"] }], publicos: pubs, variables: vars, matriz: m,
  onChange: () => undefined, nuevoTema: (n: number) => ({ key: `tema_${n}`, title: "", vars: [] }),
}));

describe("la línea vacía muestra la sugerencia de la matriz (P20)", () => {
  it("confirmada en violeta, parecida neutra con su escala dicha, y el lote sólo con la confirmada", () => {
    const html = render();
    expect(html).toContain("Equivalente según tu matriz: <code>p10_1</code> · Etiqueta p10_1");
    expect(html).toContain("pulso-mapi-sugerencia is-matriz");
    expect(html).toContain("Parece la misma pregunta: <code>p11_1</code>");
    expect(html).toContain("otra escala");
    expect(html).toContain("Completar con la matriz");
    expect(html).toContain('aria-label="Completar con la matriz el público vacío de este tema"');
  });
  it("sin matriz no hay chip ni botón de lote", () => {
    const html = render(SIN_MATRIZ);
    expect(html).not.toContain("pulso-mapi-sugerencia");
    expect(html).not.toContain("Completar con la matriz");
  });
});
