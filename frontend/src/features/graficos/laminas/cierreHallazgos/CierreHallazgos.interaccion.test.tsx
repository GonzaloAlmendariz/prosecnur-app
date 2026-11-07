// @vitest-environment happy-dom
// «Cierre con hallazgos» montado (ADR 0135 §6 y §8): rótulo con «?», tres filas de partida con la frase vacía (nada
// sugerido), escribir la frase la guarda en el plan, el aviso de la lámina o la cifra que ya no están, y el vacío del
// informe sin láminas de resumen.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ArgMetadata, Slide } from "../../../../api/graficos";
import { usePlanStore } from "../../store";
import type { CifrasEnVivo } from "./useCifrasDeOrigen";

const estado = vi.hoisted(() => ({ actual: { cifras: null, cargando: false, error: null } as CifrasEnVivo }));
vi.mock("./useCifrasDeOrigen", () => ({ useCifrasDeOrigen: () => estado.actual }));

import { CierreHallazgos } from "./CierreHallazgos";
import { useLaminasUi } from "../laminasStore";

const ARGS: ArgMetadata[] = [{ name: "hallazgos", label: "Hallazgos", tipo_input: "cierre_hallazgos", grupo: "datos" }];
const PANORAMA: Slide = { id: "s1", tipo: "p_slide_1_grafico", payload: { titulo: "", grafico: { graficador: "p_panorama", args: {} } } };
const cierre = (hallazgos: unknown[]): Slide => ({ id: "c1", tipo: "p_slide_cierre_hallazgos", payload: { titulo: "", hallazgos } });

let host: HTMLDivElement;
let root: Root;

function Vista() {
  const slide = usePlanStore((s) => s.plan.slides.find((x) => x.id === "c1"));
  return slide ? <CierreHallazgos slide={slide} args={ARGS} /> : null;
}

function montar(slides: Slide[]) {
  usePlanStore.setState((s) => ({ plan: { ...s.plan, slides } }));
  act(() => root.render(<MemoryRouter><Vista /></MemoryRouter>));
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  estado.actual = { cifras: null, cargando: false, error: null };
  useLaminasUi.getState().abrirSeccionLamina("ajustes");
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  document.body.innerHTML = "";
});

const payloadCierre = () => usePlanStore.getState().plan.slides.find((s) => s.id === "c1")?.payload as Record<string, unknown>;

describe("CierreHallazgos", () => {
  it("rótulo con «?», tres filas de partida y la frase vacía, sin texto sugerido", () => {
    montar([PANORAMA, cierre([])]);
    expect(host.textContent).toContain("Hallazgos");
    expect(host.querySelector("[aria-label='Qué es “Hallazgos”']")).toBeTruthy();
    const filas = host.querySelectorAll("[role='group'][aria-label^='Hallazgo ']");
    expect(filas).toHaveLength(3);
    const frases = [...host.querySelectorAll("textarea")];
    expect(frases.every((t) => t.value === "" && !t.getAttribute("placeholder"))).toBe(true);
    expect(host.textContent).toContain("0 de 3 completos");
    expect(host.querySelector("input[type='checkbox'], table")).toBeNull();
  });

  it("escribir la frase la guarda en el plan sin inventar lámina ni cifra", async () => {
    montar([PANORAMA, cierre([])]);
    const frase = host.querySelector("textarea") as HTMLTextAreaElement;
    await act(async () => {
      const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
      set?.call(frase, "Los docentes valoran más");
      frase.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(payloadCierre().hallazgos).toEqual([{ lamina: "", cifra: "", texto: "Los docentes valoran más" }]);
    expect(host.textContent).toContain("Falta elegir la lámina");
  });

  it("la lámina de origen que ya no está se avisa en la fila", () => {
    montar([PANORAMA, cierre([{ lamina: "borrada", cifra: "mediana:Docentes", texto: "Los docentes valoran más" }])]);
    expect(host.textContent).toContain("La lámina de origen ya no está");
  });

  it("la cifra que ya no está en su lámina se avisa cuando llegan las cifras", () => {
    estado.actual = { cargando: false, error: null, cifras: { tipo: "panorama/1", avisos: [], cifras: [
      { clave: "mediana:Estudiantes", rotulo: "Mediana de Estudiantes", texto: "61%", valor: 61, unidad: "%" },
    ] } };
    montar([PANORAMA, cierre([{ lamina: "s1", cifra: "mediana:Docentes", texto: "Los docentes valoran más" }])]);
    expect(host.textContent).toContain("La cifra ya no está en su lámina de origen");
  });

  it("sin láminas de resumen en el informe, el vacío es del bloque y no hay filas", () => {
    montar([cierre([])]);
    expect(host.textContent).toContain("El informe todavía no tiene láminas de resumen");
    expect(host.textContent).not.toContain("Agregar hallazgo");
  });
});
