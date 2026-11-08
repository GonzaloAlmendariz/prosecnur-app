// @vitest-environment happy-dom
// Ítem 8 (2026-11-08): las paletas con nombre como muestras pintadas sobre las respuestas de ESTA pregunta. Pasar el
// cursor pinta la barra de arriba sin escribir en el plan; el clic elige en un solo paso (setPaletasYVinculos).
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FilaPaleta } from "../../estilo/modeloPaletasConNombre";
import { PaletaDelGrafico } from "./PaletaDelGrafico";

const grupo = (id: string, opciones: string[], refs: string[]) => ({
  id, opciones, listas: [`lst_${id}`], preguntas: refs.map((ref) => ({ ref, texto: ref, base: "b1" })), bases: ["b1"], colores: {}, enAlguna: {}, faltan: 0,
});
const fila = (id: string, nombre: string, clave: string | null, colores: Record<string, string>, g: ReturnType<typeof grupo>): FilaPaleta => ({
  id, nombre, clave, grupos: [g], opciones: g.opciones, colores, preguntas: g.preguntas, bases: ["b1"], faltan: 0,
});
const PROPIA = fila("f1", "Sí / No", null, { "Sí": "#111111", "No": "#222222" }, grupo("g1", ["Sí", "No"], ["b1$p1", "b1$p2", "b1$p3"]));
const MARCA = fila("f2", "Marca", "marca", { "SI": "#aa0000", "No": "#00aa00" }, grupo("g2", ["Si", "No"], ["b1$p9"]));

const escrituras: unknown[] = [];
const ESTADO = {
  paletas: {}, paletasVinculos: {},
  setPaletas: (...a: unknown[]) => { escrituras.push(["setPaletas", ...a]); },
  setPaletasYVinculos: (...a: unknown[]) => { escrituras.push(["setPaletasYVinculos", ...a]); },
};
vi.mock("../../store", () => ({ usePlanStore: (sel: (s: typeof ESTADO) => unknown) => sel(ESTADO) }));
vi.mock("react-router-dom", () => ({ useLocation: () => ({ search: "", pathname: "/graficos" }), useNavigate: () => () => undefined }));
vi.mock("../../../../lib/SessionContext", () => ({ useSession: () => ({ state: { active_base: "b1" } }) }));
vi.mock("../../reportScope", () => ({ useGraficosReportScope: () => "active" }));
vi.mock("../../estilo/usePaletasRespuestas", () => ({ usePaletasRespuestas: () => ({ listas: [], filas: [PROPIA, MARCA] }) }));

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  escrituras.length = 0;
  act(() => root.render(<PaletaDelGrafico valor={{ graficador: "p_barras_categoricas", args: { var: "p1" } }} />));
});
afterEach(() => { act(() => root.unmount()); host.remove(); });

const barra = () => [...host.querySelectorAll<HTMLElement>(".pulso-pg-barra span")].map((s) => s.style.background);
const muestra = () => host.querySelector<HTMLButtonElement>('[role="radio"]')!;

describe("PaletaDelGrafico con muestras", () => {
  it("la muestra pinta sus colores sobre las respuestas de esta pregunta y dice cuántas cambian, sin desplegable", () => {
    expect(host.querySelector("select")).toBeNull();
    expect(host.querySelector('[role="radiogroup"]')?.getAttribute("data-qa-geometry-group")).toBe("graficos/f6-paleta-muestras");
    const tira = [...muestra().querySelectorAll<HTMLElement>(".pulso-pg-muestra-tira span")].map((s) => s.style.background);
    expect(tira).toEqual(["#aa0000", "#00aa00"]);
    expect(muestra().getAttribute("aria-checked")).toBe("false");
    expect(muestra().textContent).toContain("Cambia 3 preguntas");
  });
  it("al pasar el cursor la barra de arriba muestra esa paleta sin escribir en el plan; al salir vuelve", () => {
    const antes = barra();
    expect(antes).toEqual(["#111111", "#222222"]);
    act(() => { muestra().dispatchEvent(new MouseEvent("mouseover", { bubbles: true })); });
    expect(barra()).toEqual(["#aa0000", "#00aa00"]);
    expect(host.querySelector(".pulso-pg-nombre")?.textContent).toBe("Vista previa: Marca");
    expect(escrituras).toEqual([]);
    act(() => { host.querySelector(".pulso-pg-muestras")!.dispatchEvent(new MouseEvent("mouseout", { bubbles: true })); });
    expect(barra()).toEqual(antes);
  });
  it("el clic elige en un solo paso deshacible", () => {
    act(() => muestra().click());
    expect(escrituras.map((e) => (e as unknown[])[0])).toEqual(["setPaletasYVinculos"]);
  });
});
