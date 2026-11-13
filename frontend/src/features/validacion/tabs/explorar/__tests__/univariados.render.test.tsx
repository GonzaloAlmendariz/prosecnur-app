// @vitest-environment happy-dom
// E6 con la maqueta v4 (2026-11-03): la primera en navy sólo si le saca 2 puntos a la segunda, la pista de 0 a
// 100 %, la fecha con el eje de dos líneas de Monitoreo y el histograma con su mediana rotulada.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test } from "vitest";
import type { ExploradorDist } from "../../../../../api/validacionExplorar";
import DistribucionBarras from "../DistribucionBarras";
import DistribucionFecha from "../DistribucionFecha";
import DistribucionNumerica from "../DistribucionNumerica";
import DistribucionTexto from "../DistribucionTexto";
import { MemoryRouter } from "react-router-dom";

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const so = (filas: [string, number][]): ExploradorDist => {
  const base = filas.reduce((t, [, n]) => t + n, 0);
  return { tipo: "so", ordinal: false, base_n: base, filas: filas.map(([etiqueta, n], i) => ({ codigo: String(i + 1), etiqueta, n, pct: (100 * n) / base })) };
};

test("todas las barras van igual, sin destacar la mayor (prototipo); la pista es de 0 a 100 %", () => {
  act(() => root.render(<DistribucionBarras dist={so([["Redes", 63], ["Televisión", 27], ["Otro", 10]])} sinRespuesta={null} />));
  expect(host.querySelector(".vx-barra-fila.is-primera")).toBeNull();
  expect(host.querySelector(".vx-barra-fila.is-residual")?.textContent).toContain("Otro");
  const primera = host.querySelector<HTMLElement>(".vx-barra-fila");
  expect(primera?.textContent).toContain("Redes");
  expect(primera?.querySelector<HTMLElement>(".vx-relleno")?.style.width).toBe("63%");
});

test("la fecha rotula cada día y el mes sólo donde empieza, como Monitoreo; el día con más casos se anota", () => {
  const dias = [
    { fecha: "2026-06-29", n: 10 }, { fecha: "2026-06-30", n: 40 }, { fecha: "2026-07-01", n: 0 }, { fecha: "2026-07-02", n: 5 },
  ];
  act(() => root.render(<DistribucionFecha dias={dias} />));
  const dia = Array.from(host.querySelectorAll("text.mon-eje-fecha:not(.is-mes)")).map((t) => t.textContent);
  const mes = Array.from(host.querySelectorAll("text.mon-eje-fecha.is-mes")).map((t) => t.textContent);
  expect(dia).toEqual(["29", "30", "1", "2"]);
  expect(mes).toEqual(["jun", "jul"]);
  expect(host.querySelector("text.vx-svg-anota")?.textContent).toBe("40, 30 jun");
  expect(host.querySelectorAll("rect.vx-svg-columna")).toHaveLength(4);
  expect(host.querySelector("rect.vx-svg-columna.is-mayor title")?.textContent).toBe("30 jun: 40 casos");
});

test("el histograma va de un solo color y rotula la mediana; la caja comparte la escala", () => {
  act(() => root.render(<DistribucionNumerica num={{
    bins: [{ desde: 10, hasta: 20, n: 5 }, { desde: 20, hasta: 30, n: 12 }, { desde: 30, hasta: 40, n: 3 }],
    min: 12, p25: 21, mediana: 25, p75: 31, max: 39, media: 25.4, n_atipicos: 0,
  }} />));
  expect(host.querySelectorAll("rect.vx-svg-columna.is-mayor")).toHaveLength(0);
  expect(host.querySelectorAll("rect.vx-svg-columna.is-dist")).toHaveLength(3);
  expect(host.querySelector("text.vx-svg-anota")?.textContent).toBe("Mediana 25");
  expect(host.querySelector("rect.vx-svg-cajita")).toBeTruthy();
});

test("en una abierta, las barras sólo aparecen si alguna respuesta se repite", () => {
  act(() => root.render(<MemoryRouter><DistribucionTexto grupos={[{ texto: "Barrio", n: 3 }, { texto: "Oscar", n: 1 }]} /></MemoryRouter>));
  expect(host.querySelectorAll(".vx-texto-barra")).toHaveLength(2);
  expect(host.querySelector("li.is-mayor")?.textContent).toContain("Barrio");
  act(() => root.render(<MemoryRouter><DistribucionTexto grupos={[{ texto: "Barrio", n: 1 }, { texto: "Oscar", n: 1 }]} /></MemoryRouter>));
  expect(host.querySelectorAll(".vx-texto-barra")).toHaveLength(0);
});

const escala = (etiquetas: string[], ns: number[], extra: [string, string, number][] = []): ExploradorDist => {
  const filas = [
    ...etiquetas.map((etiqueta, i) => ({ codigo: String(i + 1), etiqueta, n: ns[i] })),
    ...extra.map(([codigo, etiqueta, n]) => ({ codigo, etiqueta, n })),
  ];
  const base = filas.reduce((t, f) => t + f.n, 0);
  return { tipo: "so", ordinal: true, base_n: base, filas: filas.map((f) => ({ ...f, pct: (100 * f.n) / base })) };
};

test('una escala de 7 con "No sabe" y un código fuera de lista: los dos cierran la barra en gris y van en la leyenda', () => {
  const dist = escala(
    ["Muy en desacuerdo", "Bastante en desacuerdo", "En desacuerdo", "Neutral", "De acuerdo", "Bastante de acuerdo", "Muy de acuerdo"],
    [5, 8, 12, 20, 25, 15, 5],
    [["98", "No sabe", 8], ["99", "Sin información", 3], ["77", "77", 2]],
  );
  act(() => root.render(<DistribucionBarras dist={dist} sinRespuesta={3} declarados={new Set(["1", "2", "3", "4", "5", "6", "7", "98", "99"])} />));
  const seg = host.querySelectorAll(".vx-div-barra > .vx-div-seg");
  expect(seg).toHaveLength(10);
  expect(host.querySelectorAll(".vx-div-barra > .vx-div-seg.is-aparte")).toHaveLength(3);
  expect(host.querySelector(".vx-div-barra > .vx-div-seg.is-corte")?.getAttribute("aria-label")).toContain("No sabe");
  const leyenda = Array.from(host.querySelectorAll(".vx-div .vx-leyenda > span")).map((x) => x.textContent);
  expect(leyenda).toHaveLength(10);
  // La cifra que no entra en su tramo va junto a su opción en la leyenda (ítem 39).
  expect(leyenda.slice(-3)).toEqual(["No sabe", "Sin información3%", "772%"]);
  // Cada lado se nombra con todas las opciones que suma (ítem 39); el centro, "Neutral".
  const resumen = Array.from(host.querySelectorAll(".vx-div-resumen > span")).map((x) => x.textContent);
  expect(resumen).toEqual([
    "24.3%Muy en desacuerdo, bastante en desacuerdo o en desacuerdo",
    "19.4%Neutral",
    "43.7%De acuerdo, bastante de acuerdo o muy de acuerdo",
  ]);
});

test("una escala de 0 a 10 (11 puntos) y una de 4 sin centro se dibujan enteras", () => {
  const once = escala(Array.from({ length: 11 }, (_, i) => String(i)), [3, 2, 4, 5, 6, 20, 10, 15, 15, 10, 10]);
  act(() => root.render(<DistribucionBarras dist={once} sinRespuesta={null} />));
  expect(host.querySelectorAll(".vx-div-barra > .vx-div-seg")).toHaveLength(11);
  expect(Array.from(host.querySelectorAll(".vx-div-resumen > span")).map((x) => x.textContent?.replace(/^[\d.]+%/, ""))).toEqual(["0 a 4", "5", "6 a 10"]);
  const cuatro = escala(["Nada", "Poco", "Algo", "Mucho"], [10, 20, 30, 40]);
  act(() => root.render(<DistribucionBarras dist={cuatro} sinRespuesta={null} />));
  const resumen = Array.from(host.querySelectorAll(".vx-div-resumen > span")).map((x) => x.textContent);
  expect(resumen).toEqual(["30.0%Nada o poco", "70.0%Algo o mucho"]);
  expect(host.querySelector(".vx-div-resumen .is-alta")).toBeTruthy();
});
