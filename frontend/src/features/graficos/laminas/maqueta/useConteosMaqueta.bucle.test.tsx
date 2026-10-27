// Renzo (Arte_v1-8, app 0.9.5, 2026-10-27): «no me deja editar, se congela cuando toca esa lámina» — la del Sí/No del
// reglamento con su escala dependiente (s-mkdlbuc5). La maqueta re-arma `ranuras` en cada render y, con los conteos ya en
// memoria, `cargarCategorias` responde en una microtarea: si el efecto dependiera del arreglo, efecto → estado → render →
// ranuras nuevas → efecto, sin fin y sin tocar la red. Este test monta el hook como lo usa la maqueta (arreglo nuevo en cada
// render) y exige que se aquiete: con el hook de 0.9.5 los renders y las lecturas crecen sin tope.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RanuraMaqueta } from "../modeloMaqueta";

const cargar = vi.hoisted(() => vi.fn(async () => ({ categorias: [{ codigo: "1", etiqueta: "Sí", n: 77 }, { codigo: "2", etiqueta: "No", n: 38 }] })));
vi.mock("../useCategoriasGrafico", () => ({ cargarCategorias: cargar }));
vi.mock("react-router-dom", () => ({ useLocation: () => ({ search: "", pathname: "/graficos" }) }));
vi.mock("../../reportScope", () => ({ useGraficosReportScope: () => "active" }));
vi.mock("../../../../lib/SessionContext", () => ({ useSession: () => ({ state: { active_base: "docentes" } }) }));

import { useConteosMaqueta } from "./useConteosMaqueta";

const ranura = (variable: string, graficador: string): RanuraMaqueta =>
  ({ graficador, variable, pinta: "categorias", preguntas: [variable] }) as unknown as RanuraMaqueta;

let renders = 0;
let ultimo: ReturnType<typeof useConteosMaqueta> | null = null;
function Maqueta() {
  renders += 1;
  // Como MaquetaLamina: el arreglo se arma de nuevo en cada render (superior Sí/No + inferior escala dependiente).
  ultimo = useConteosMaqueta([ranura("docentes$p18", "p_barras_agrupadas"), ranura("docentes$p19_1", "p_barras_apiladas")]);
  return null;
}

// Sin DOM: el componente no pinta nodos, así que basta un contenedor que acepte los listeners que React DOM registra.
// (El entorno `happy-dom` está declarado pero no siempre instalado; este test no lo necesita.)
const g = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean; window?: unknown };
g.IS_REACT_ACT_ENVIRONMENT = true;
if (typeof g.window === "undefined") g.window = { HTMLIFrameElement: class {} };
const doc = { nodeType: 9, documentElement: { namespaceURI: "http://www.w3.org/1999/xhtml" }, addEventListener: () => undefined, removeEventListener: () => undefined };
const contenedor = () => ({ nodeType: 1, tagName: "DIV", namespaceURI: "http://www.w3.org/1999/xhtml", ownerDocument: doc, addEventListener: () => undefined, removeEventListener: () => undefined }) as unknown as Element;

let root: Root | null = null;
afterEach(() => { act(() => root?.unmount()); root = null; renders = 0; ultimo = null; cargar.mockClear(); });

describe("useConteosMaqueta · la lámina del Sí/No con su dependiente no se congela", () => {
  it("se aquieta: pocos renders y una sola lectura aunque las ranuras sean un arreglo nuevo en cada render", async () => {
    await act(async () => { root = createRoot(contenedor()); root.render(<Maqueta />); });
    // Deja correr muchas vueltas de microtareas: un bucle efecto→estado→render las consumiría todas.
    for (let i = 0; i < 60; i += 1) await act(async () => { await Promise.resolve(); });
    expect(renders).toBeLessThanOrEqual(4);
    expect(cargar).toHaveBeenCalledTimes(1);   // sólo la agrupada pide conteos; las apiladas no
    expect(ultimo?.listos).toBe(true);
    expect(ultimo?.conteos.get("docentes$p18")?.map((c) => c.n)).toEqual([77, 38]);
  });
});
