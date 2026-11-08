// @vitest-environment happy-dom
// Ítem 8 (2026-11-08): las paletas con nombre como muestras pintadas sobre las respuestas de ESTA pregunta. Pasar el
// cursor pinta la barra de arriba sin escribir en el plan; el clic elige en un solo paso (setPaletasYVinculos).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
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
// No nombra «Sí» ni «No»: va detrás de Marca aunque llegue antes (R6-3).
const ACUERDO = fila("f3", "Acuerdo con un nombre largo que no cabe en la tarjeta", "acuerdo", { "Muy de acuerdo": "#0000aa" }, grupo("g3", ["Muy de acuerdo"], ["b1$p8"]));

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
vi.mock("../../estilo/usePaletasRespuestas", () => ({ usePaletasRespuestas: () => ({ listas: [], filas: [PROPIA, ACUERDO, MARCA] }) }));

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
  it("R6-3: la paleta que no nombra estas respuestas va al final, marcada, y no promete un cambio", () => {
    const radios = [...host.querySelectorAll<HTMLButtonElement>('[role="radio"]')];
    expect(radios.map((r) => r.querySelector(".pulso-pg-muestra-nombre")?.textContent)).toEqual(["Marca", "Acuerdo con un nombre largo que no cabe en la tarjeta"]);
    expect(radios[1].classList.contains("is-ajena")).toBe(true);
    expect(radios[1].getAttribute("aria-label")).toContain("No nombra estas respuestas");
    expect(radios[1].textContent).not.toContain("Cambia");
    expect(radios[0].classList.contains("is-ajena")).toBe(false);
  });
});

// R6-1: el alto de la cabecera no puede cambiar con la vista previa (pasaba de 18 a 41 px y oscilaba bajo el cursor).
// happy-dom no mide, así que se prueba lo que fija el alto: la misma estructura en las dos fases (nada se agrega ni se
// quita) y la regla de una línea —sin partir, nombre recortado, sello que no encoge—.
const css = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "paletaDelGrafico.css"), "utf8");

describe("R6-1: la cabecera de la paleta no cambia de alto con la vista previa", () => {
  const forma = () => {
    const cab = host.querySelector<HTMLElement>(".pulso-pg-cabecera")!;
    return [...cab.children].map((c) => `${c.tagName}.${[...c.classList].filter((k) => k !== "is-vista").join(".")}`);
  };
  const regla = (sel: string) => css.match(new RegExp(`(?:^|\\n)${sel.replace(/\./g, "\\.")} \\{([^}]*)\\}`))?.[1] ?? "";
  it("la misma estructura con y sin vista previa, y el nombre entero en el title", () => {
    const sin = forma();
    act(() => { muestra().dispatchEvent(new MouseEvent("mouseover", { bubbles: true })); });
    expect(forma()).toEqual(sin);
    expect(host.querySelector(".pulso-pg-nombre")?.getAttribute("title")).toBe("Vista previa: Marca");
  });
  it("una sola línea: la cabecera no parte, el nombre se recorta y el sello no encoge", () => {
    expect(regla(".pulso-pg-cabecera")).toMatch(/flex-wrap:\s*nowrap/);
    const nombre = regla(".pulso-pg-nombre");
    expect(nombre).toMatch(/white-space:\s*nowrap/);
    expect(nombre).toMatch(/text-overflow:\s*ellipsis/);
    expect(nombre).toMatch(/min-width:\s*0/);
    expect(regla(".pulso-pg-cabecera .pulso-cr-sello")).toMatch(/flex-shrink:\s*0/);
  });
  it("R6-2: el nombre de la muestra parte en líneas en vez de montarse sobre el alcance", () => {
    expect(css).toMatch(/\.pulso-pg-muestra-nombre \{[^}]*white-space:\s*normal/);
  });
});
