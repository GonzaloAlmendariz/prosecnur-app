import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { VarWithSource } from "../useVariables";
import { SIN_MATRIZ } from "./sugerenciasMatriz";
import { TemasPorPublico } from "./TemasPorPublico";

// D5 (unión de láminas, 2026-10-29): el buscador de la fila de Estudiantes abría filtrado en Docentes (la primera base).
vi.mock("../VariablePicker", () => ({
  default: (p: { fuenteInicial?: string }) => createElement("span", { "data-picker": "", "data-fuente": p.fuenteInicial ?? "" }),
}));

describe("cada fila de público abre el buscador en su base", () => {
  it("la fila de cada público le pasa su base al buscador", () => {
    const html = renderToStaticMarkup(createElement(TemasPorPublico, {
      temas: [{ key: "tema_1", title: "", vars: [] }], publicos: ["docentes", "estudiantes"], variables: [] as VarWithSource[],
      matriz: SIN_MATRIZ, onChange: () => undefined, nuevoTema: (n: number) => ({ key: `tema_${n}`, title: "", vars: [] }),
    }));
    expect(html).toContain('data-fuente="docentes"');
    expect(html).toContain('data-fuente="estudiantes"');
  });
});
