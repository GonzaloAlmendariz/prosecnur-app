// El conteo de la regla depende de la FIRMA del pedido, no del objeto `args`: la tarjeta lo re-arma en cada render y,
// con el objeto como dependencia, efecto → estado → render → objeto nuevo → efecto sin fin (el bucle que congeló la
// maqueta del Sí/No, useConteosMaqueta.bucle.test.tsx). Este test monta el hook con un `args` nuevo en cada render y exige
// que se aquiete con una sola lectura; además, que un cambio de regla pida una vez más tras la espera.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const contar = vi.hoisted(() => vi.fn(async () => ({
  total: 47, seleccionadas: ["p1", "p2"], candidatas: [{ tema: "p1", etiqueta: "P1", metrica: 30, seleccionada: true }],
  texto_regla: "Se muestran las 2 de mayor diferencia, de 47 preguntas comunes.", avisos: [],
})));
vi.mock("../../../../api/graficosRegla", () => ({ apiGraficosConteoRegla: contar }));

import { ESPERA_CONTEO_MS, mensajeDeError, pedidoDeFirma, useConteoRegla } from "./useConteoRegla";
import { firmaPedidoRegla } from "./modeloReglaPreguntas";
import { ApiError } from "../../../../api/core";

let renders = 0;
let ultimo: ReturnType<typeof useConteoRegla> | null = null;
let n = 2;
let vars = ["docentes$*", "estudiantes$*"];
function Tarjeta() {
  renders += 1;
  // Como DatosGrafico: los args se arman de nuevo en cada render.
  ultimo = useConteoRegla("p_dumbbell", { estilo: "resumen", vars, regla: { tipo: "mayor_diferencia", n } }, "active", true);
  return null;
}

const g = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean; window?: unknown };
g.IS_REACT_ACT_ENVIRONMENT = true;
if (typeof g.window === "undefined") g.window = { HTMLIFrameElement: class {} };
const doc = { nodeType: 9, documentElement: { namespaceURI: "http://www.w3.org/1999/xhtml" }, addEventListener: () => undefined, removeEventListener: () => undefined };
const contenedor = () => ({ nodeType: 1, tagName: "DIV", namespaceURI: "http://www.w3.org/1999/xhtml", ownerDocument: doc, addEventListener: () => undefined, removeEventListener: () => undefined }) as unknown as Element;

let root: Root | null = null;
beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { act(() => root?.unmount()); root = null; renders = 0; ultimo = null; n = 2; vars = ["docentes$*", "estudiantes$*"]; contar.mockClear(); vi.useRealTimers(); });

describe("useConteoRegla", () => {
  it("se aquieta: una sola lectura aunque `args` sea un objeto nuevo en cada render", async () => {
    await act(async () => { root = createRoot(contenedor()); root.render(<Tarjeta />); });
    expect(ultimo?.cargando).toBe(true);
    expect(contar).not.toHaveBeenCalled();   // espera antes de pedir
    await act(async () => { vi.advanceTimersByTime(ESPERA_CONTEO_MS); });
    for (let i = 0; i < 60; i += 1) await act(async () => { await Promise.resolve(); });
    expect(contar).toHaveBeenCalledTimes(1);
    expect(renders).toBeLessThanOrEqual(4);
    expect(ultimo?.cargando).toBe(false);
    expect(ultimo?.conteo?.seleccionadas).toEqual(["p1", "p2"]);
    // Re-render con lo mismo: no vuelve a pedir.
    await act(async () => { root?.render(<Tarjeta />); vi.advanceTimersByTime(ESPERA_CONTEO_MS * 3); });
    expect(contar).toHaveBeenCalledTimes(1);
  });

  it("un cambio de regla pide de nuevo tras la espera, y conserva el conteo anterior mientras tanto", async () => {
    await act(async () => { root = createRoot(contenedor()); root.render(<Tarjeta />); });
    await act(async () => { vi.advanceTimersByTime(ESPERA_CONTEO_MS); });
    for (let i = 0; i < 10; i += 1) await act(async () => { await Promise.resolve(); });
    n = 5;
    await act(async () => { root?.render(<Tarjeta />); });
    expect(ultimo?.cargando).toBe(true);
    expect(ultimo?.conteo).not.toBeNull();
    await act(async () => { vi.advanceTimersByTime(ESPERA_CONTEO_MS); });
    for (let i = 0; i < 10; i += 1) await act(async () => { await Promise.resolve(); });
    expect(contar).toHaveBeenCalledTimes(2);
    expect(contar.mock.calls[1]).toEqual([{ graficador: "p_dumbbell", args: { estilo: "resumen", regla: { n: 5, tipo: "mayor_diferencia" }, vars: ["docentes$*", "estudiantes$*"] } }, expect.anything()]);
  });

  it("B8: al pasar a otra lámina no muestra el conteo de la anterior mientras llega el nuevo", async () => {
    await act(async () => { root = createRoot(contenedor()); root.render(<Tarjeta />); });
    await act(async () => { vi.advanceTimersByTime(ESPERA_CONTEO_MS); });
    for (let i = 0; i < 10; i += 1) await act(async () => { await Promise.resolve(); });
    expect(ultimo?.conteo).not.toBeNull();
    // Otra lámina: otras preguntas (y otra regla). El conteo anterior no se presta.
    vars = ["egresados$*", "empleadores$*"];
    n = 3;
    await act(async () => { root?.render(<Tarjeta />); });
    expect(ultimo?.cargando).toBe(true);
    expect(ultimo?.conteo).toBeNull();
    await act(async () => { vi.advanceTimersByTime(ESPERA_CONTEO_MS); });
    for (let i = 0; i < 10; i += 1) await act(async () => { await Promise.resolve(); });
    expect(contar).toHaveBeenCalledTimes(2);
    expect(ultimo?.cargando).toBe(false);
    expect(ultimo?.conteo).not.toBeNull();
  });

  it("el pedido se reconstruye de la firma y el error llega sin el código pegado", () => {
    const f = firmaPedidoRegla("p_panorama", { vars: ["d$*"] }, "consolidated");
    expect(pedidoDeFirma(f)).toEqual({ graficador: "p_panorama", scope: "consolidated", args: { vars: ["d$*"] } });
    expect(pedidoDeFirma("roto")).toBeNull();
    const e = new ApiError("E_REGLA_PREGUNTAS_INVALIDA", "La regla «mayor_diferencia» compara grupos y la lámina tiene uno solo.");
    expect(mensajeDeError(e)).toEqual({ mensaje: "La regla «mayor_diferencia» compara grupos y la lámina tiene uno solo.", codigo: "E_REGLA_PREGUNTAS_INVALIDA" });
  });
});
