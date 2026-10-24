// El glifo del radar dibuja N vértices (los criterios, 3 a 8) y, con tabla en líneas y puntos o barras, N filas alineadas.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CuerpoGlifo } from "./GlifoGrafico";
import type { OpcionesGlifo } from "./glifosGrafico";

const html = (o: OpcionesGlifo) => renderToStaticMarkup(createElement("svg", null, createElement(CuerpoGlifo, { tipo: "p_radar", opciones: o })));
const vertices = (h: string) => {
  const rejilla = h.match(/<polygon points="([^"]+)" class="pulso-glifo__rejilla"/);
  return rejilla ? rejilla[1].trim().split(/\s+/).length : 0;
};
const ys = (h: string, clase: string) => [...h.matchAll(new RegExp(`<[a-z]+ [^>]*class="${clase}"[^>]*>`, "g"))].map((m) => m[0]);

describe("glifo de radar: un vértice por criterio", () => {
  it.each([[3, 3], [4, 4], [5, 5], [6, 6], [7, 7], [8, 8], [12, 8], [0, 5]])("%i criterios dibujan %i vértices", (n, v) => {
    expect(vertices(html({ formaRadar: "radar", criterios: n }))).toBe(v);
  });
  it("dibuja un eje por vértice", () => {
    expect((html({ formaRadar: "radar", criterios: 4 }).match(/pulso-glifo__eje-radar/g) ?? []).length).toBe(4);
  });
});

describe("glifo de líneas y puntos y barras con tabla: filas alineadas", () => {
  const centrosY = (h: string, re: RegExp) => [...h.matchAll(re)].map((m) => Number(m[1]));
  it.each([4, 6])("con %i criterios, N filas de gráfico y N de tabla en el mismo y", (n) => {
    const h = html({ formaRadar: "puntos", tabla: true, criterios: n });
    const grafico = centrosY(h, /<circle[^>]*cy="([\d.]+)"[^>]*class="pulso-glifo__a"/g);
    const tabla = centrosY(h, /data-fila-tabla="([\d.]+)"/g);
    expect(grafico).toHaveLength(n);
    expect(tabla).toEqual(grafico);
  });
  it("las barras también", () => {
    const h = html({ formaRadar: "barras", tabla: true, criterios: 4 });
    expect(centrosY(h, /data-fila-tabla="([\d.]+)"/g)).toHaveLength(4);
    expect(centrosY(h, /data-fila-grafico="([\d.]+)"/g)).toEqual(centrosY(h, /data-fila-tabla="([\d.]+)"/g));
  });
  void ys;
});
