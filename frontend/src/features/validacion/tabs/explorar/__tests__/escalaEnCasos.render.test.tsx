// @vitest-environment happy-dom
// Ítem 39: la escala de p34 (5 opciones) leída en "Casos" y en "Porcentaje".
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import type { ExploradorDist } from "../../../../../api/validacionExplorar";
import DistribucionBarras from "../DistribucionBarras";
import { cabeEnElTramo, cifraDelResumen } from "../cifrasDeLaDivergente";
import { nombreDelGrupo } from "../nombreDelGrupo";

const P34: [string, number][] = [
  ["Nada interesado/a", 143],
  ["Poco interesado/a", 211],
  ["Neutral", 462],
  ["Bastante interesado/a", 127],
  ["Muy interesado/a", 55],
];
const BASE = P34.reduce((t, [, n]) => t + n, 0);
const DIST: ExploradorDist = {
  tipo: "so",
  ordinal: true,
  base_n: BASE,
  filas: P34.map(([etiqueta, n], i) => ({ codigo: String(i + 1), etiqueta, n, pct: (100 * n) / BASE })),
};

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const resumen = () => Array.from(host.querySelectorAll(".vx-div-resumen > span")).map((s) => s.textContent);
const tramos = () => Array.from(host.querySelectorAll(".vx-div-barra > .vx-div-seg")).map((s) => s.textContent);
const leyenda = () => Array.from(host.querySelectorAll(".vx-div .vx-leyenda > span")).map((s) => s.textContent);

describe("escala ordinal de 5 opciones", () => {
  test("con Casos, el resumen dice el conteo y el porcentaje entre paréntesis", () => {
    act(() => root.render(<DistribucionBarras dist={DIST} sinRespuesta={null} valor="casos" />));
    expect(resumen()).toEqual([
      "354(35.5 %)Nada o poco interesado/a",
      "462(46.3 %)Neutral",
      "182(18.2 %)Bastante o muy interesado/a",
    ]);
    expect(tramos()).toEqual(["143", "211", "462", "127", ""]);
    // El último tramo no tiene sitio para su número: va en la leyenda.
    expect(leyenda()[4]).toBe("Muy interesado/a55");
  });

  test("con Porcentaje, el resumen y los tramos dicen el porcentaje", () => {
    act(() => root.render(<DistribucionBarras dist={DIST} sinRespuesta={null} valor="porcentaje" />));
    expect(resumen()).toEqual([
      "35.5%Nada o poco interesado/a",
      "46.3%Neutral",
      "18.2%Bastante o muy interesado/a",
    ]);
    expect(tramos()).toEqual(["14%", "21%", "46%", "13%", ""]);
    expect(leyenda()[4]).toBe("Muy interesado/a6%");
    expect(leyenda()[3]).toBe("Bastante interesado/a");
  });
});

describe("tramos con globo", () => {
  test("cada tramo es enfocable y dice opción, casos y porcentaje en el globo del kit y en su nombre", () => {
    act(() => root.render(<DistribucionBarras dist={DIST} sinRespuesta={null} valor="casos" />));
    const segs = Array.from(host.querySelectorAll<HTMLElement>(".vx-div-barra > .vx-div-seg"));
    expect(segs.every((s) => s.tabIndex === 0)).toBe(true);
    expect(segs.some((s) => s.hasAttribute("title"))).toBe(false);
    expect(segs[4].getAttribute("aria-label")).toBe("Muy interesado/a: 55 casos (5.5 %)");
    act(() => segs[4].focus());
    expect(document.querySelector(".pulso-popover.vx-div-globo")?.textContent).toBe("Muy interesado/a: 55 casos (5.5 %)");
    act(() => segs[4].blur());
  });

  test("el resumen muestra los colores de las opciones que agrupa", () => {
    act(() => root.render(<DistribucionBarras dist={DIST} sinRespuesta={null} valor="porcentaje" />));
    const muestras = Array.from(host.querySelectorAll(".vx-div-resumen > span")).map((s) => s.querySelectorAll(".vx-div-muestras > i").length);
    expect(muestras).toEqual([2, 1, 2]);
  });
});

describe("piezas", () => {
  test("el nombre del grupo sale de todas sus opciones", () => {
    expect(nombreDelGrupo(["Nada interesado/a", "Poco interesado/a"])).toBe("Nada o poco interesado/a");
    expect(nombreDelGrupo(["Muy en desacuerdo", "En desacuerdo"])).toBe("Muy en desacuerdo o en desacuerdo");
    expect(nombreDelGrupo(["Nada", "Poco", "Algo"])).toBe("Nada, poco o algo");
    expect(nombreDelGrupo(["Neutral"])).toBe("Neutral");
  });

  test("la cifra del resumen sigue a la lectura", () => {
    expect(cifraDelResumen({ n: 354, pct: 35.5 }, "casos")).toEqual({ fuerte: "354", aparte: "(35.5 %)" });
    expect(cifraDelResumen({ n: 354, pct: 35.5 }, "porcentaje")).toEqual({ fuerte: "35.5%", aparte: null });
    expect(cabeEnElTramo("55", 5.5)).toBe(false);
    expect(cabeEnElTramo("127", 12.7)).toBe(true);
  });
});
