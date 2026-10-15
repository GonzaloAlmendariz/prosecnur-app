import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { VarWithSource } from "../useVariables";
import { fuentesDeMatriz } from "./sugerenciasMatriz";
import { TemasPorPublico, type TemaPublicos } from "./TemasPorPublico";

vi.mock("../VariablePicker", () => ({ default: () => createElement("span", { "data-picker": "" }) }));

// Tope de seis barras (Gonzalo, 2026-10-14): «Públicos por tema» no deja agregar lo que haría pasar de seis.

const pubs = ["docentes", "administrativos", "estudiantes"];
const v = (source: string, name: string) =>
  ({ source, name, label: `Etiqueta ${name}`, tipo: "select_one", seccion: "", scale_signature: "sat5" }) as VarWithSource;
const variables = [v("docentes", "p1"), v("administrativos", "p1"), v("estudiantes", "p1"), v("docentes", "p2"), v("administrativos", "p2")];
const lleno = (n: number): TemaPublicos => ({ key: `tema_${n}`, title: `Tema ${n}`, vars: pubs.map((p) => `${p}$p${n}`) });
const render = (temas: TemaPublicos[], cupo?: number) => renderToStaticMarkup(createElement(TemasPorPublico, {
  temas, publicos: pubs, variables, cupo, pie: createElement("span", null, "N de 6 barras"),
  matriz: fuentesDeMatriz([{ etiqueta_estandar: "Tema 2", variables: { docentes: "p2", administrativos: "p2" } }]),
  onChange: () => undefined, nuevoTema: (n: number) => ({ key: `tema_${n}`, title: "", vars: [] }),
}));

describe("«Públicos por tema» respeta el tope de seis barras", () => {
  it("con lugar, «Agregar tema» está activo y el conteo va a su lado", () => {
    const html = render([lleno(1)], 3);
    expect(html).toMatch(/<button type="button" class="pulso-f6-boton pulso-mapi-agregar">/);
    expect(html).toContain("N de 6 barras");
  });
  it("con seis barras, «Agregar tema» se apaga y dice por qué", () => {
    const html = render([lleno(1), lleno(2)], 0);
    expect(html).toMatch(/pulso-mapi-agregar" disabled="" title="Una multiapilada lleva hasta 6 barras\."/);
  });
  it("sin cupo, una línea vacía no ofrece selector, sugerencia ni lote", () => {
    const html = render([lleno(1), { key: "tema_2", title: "Tema 2", vars: ["docentes$p2"] }], 0);
    expect(html).toContain("Ya hay 6 barras.");
    expect(html).not.toContain("pulso-mapi-sugerencia");
    expect(html).toMatch(/pulso-mapi-completar" disabled=""/);
  });
  it("sin tope declarado se comporta como antes", () => {
    const html = render([lleno(1), lleno(2), lleno(3)]);
    expect(html).toMatch(/<button type="button" class="pulso-f6-boton pulso-mapi-agregar">/);
  });
});
