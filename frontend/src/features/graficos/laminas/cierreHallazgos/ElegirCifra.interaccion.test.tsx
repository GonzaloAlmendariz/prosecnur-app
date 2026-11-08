// @vitest-environment happy-dom
// «Elegir cifra» montado en el cierre: un solo control con buscador (combobox) y lista agrupada por lámina (listbox y
// option), columnas por medida, teclado completo (flechas, Enter, Escape), la elección escribe lámina, clave y la cifra
// como se leía, y la maqueta marca con «Hallazgo N» las tarjetas sin cifra.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ArgMetadata, Slide } from "../../../../api/graficos";
import type { CifraClave } from "../../../../api/graficosCifras";
import { usePlanStore } from "../../store";
import type { CifrasEnVivo } from "./useCifrasDeOrigen";

const cifra = (clave: string, rotulo: string, texto: string, valor: number): CifraClave => ({ clave, rotulo, texto, valor, unidad: "%" });
const vivas = (cifras: CifraClave[]): CifrasEnVivo => ({ cifras: { tipo: "x/1", avisos: [], cifras }, cargando: false, error: null });

const estado = vi.hoisted(() => ({ porOrigen: {} as Record<string, CifrasEnVivo> }));
vi.mock("./useCifrasDeOrigen", () => ({
  useCifrasDeOrigenes: (origenes: readonly { id: string }[]) =>
    Object.fromEntries(origenes.map((o) => [o.id, estado.porOrigen[o.id] ?? { cifras: null, cargando: true, error: null }])),
}));

import { CierreHallazgos } from "./CierreHallazgos";
import { useElegirCifraUi } from "./elegirCifraStore";
import { useLaminasUi } from "../laminasStore";

const ARGS: ArgMetadata[] = [{ name: "hallazgos", label: "Hallazgos", tipo_input: "cierre_hallazgos", grupo: "datos" }];
const PANORAMA: Slide = { id: "s1", tipo: "p_slide_1_grafico", payload: { titulo: "Panorama", grafico: { graficador: "p_panorama", args: {} } } };
const ESCALA: Slide = { id: "s2", tipo: "p_slide_1_grafico", payload: { titulo: "Escala", grafico: { graficador: "p_barras_divergentes", args: {} } } };
const cierre = (hallazgos: unknown[]): Slide => ({ id: "c1", tipo: "p_slide_cierre_hallazgos", payload: { titulo: "", hallazgos } });

let host: HTMLDivElement;
let root: Root;

function Vista() {
  const slide = usePlanStore((s) => s.plan.slides.find((x) => x.id === "c1"));
  return slide ? <CierreHallazgos slide={slide} args={ARGS} /> : null;
}

function montar(hallazgos: unknown[] = []) {
  usePlanStore.setState((s) => ({ plan: { ...s.plan, slides: [PANORAMA, ESCALA, cierre(hallazgos)] } }));
  act(() => root.render(<MemoryRouter><Vista /></MemoryRouter>));
}

const payloadCierre = () => usePlanStore.getState().plan.slides.find((s) => s.id === "c1")?.payload as Record<string, unknown>;
const disparadores = () => [...host.querySelectorAll<HTMLButtonElement>(".pulso-f6-elegir-cifra-disparador")];
const buscador = () => host.querySelector<HTMLInputElement>("[role='combobox']");
const tecla = (el: Element, key: string) => act(() => { el.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true })); });

function teclear(texto: string) {
  const input = buscador() as HTMLInputElement;
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, texto);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  useElegirCifraUi.setState({ abierta: null, busqueda: "", orden: "valor", activa: null });
  useLaminasUi.getState().abrirSeccionLamina("ajustes");
  estado.porOrigen = {
    s1: vivas([cifra("mediana:Docentes", "Docentes: mediana", "71%", 71), cifra("mediana:Estudiantes", "Estudiantes: mediana", "64%", 64)]),
    s2: vivas([
      cifra("t2b:Biblioteca", "Biblioteca: acuerdo", "52%", 52), cifra("sin_info:Biblioteca", "Biblioteca: Sin información", "11%", 11),
      cifra("t2b:Tutoría", "Tutoría: acuerdo", "80%", 80), cifra("sin_info:Tutoría", "Tutoría: Sin información", "4%", 4),
    ]),
  };
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  document.body.innerHTML = "";
});

describe("Elegir cifra", () => {
  it("un solo control por fila; abierto, buscador combobox y lista agrupada por lámina con columnas por medida", () => {
    montar();
    expect(host.querySelectorAll("[aria-label^='Lámina del']")).toHaveLength(0);
    expect(disparadores()).toHaveLength(3);
    act(() => disparadores()[0].click());
    const input = buscador();
    expect(input?.getAttribute("aria-expanded")).toBe("true");
    const lista = host.querySelector("[role='listbox']");
    expect(input?.getAttribute("aria-controls")).toBe(lista?.id);
    const grupos = [...host.querySelectorAll("[role='listbox'] > [role='group']")].map((g) => g.getAttribute("aria-label"));
    expect(grupos).toEqual(["Lámina 1: Panorama", "Lámina 2: Escala"]);
    const escala = host.querySelector("[role='group'][data-lamina='s2']") as HTMLElement;
    expect(escala.querySelector(".pulso-f6-elegir-cifra-grupo-cabeza")?.textContent).toContain("Sin información");
    // Por valor: Tutoría (80) antes que Biblioteca (52).
    expect([...escala.querySelectorAll("[role='option']")].map((o) => o.getAttribute("aria-label"))).toEqual([
      "Tutoría, acuerdo: 80%", "Tutoría, Sin información: 4%", "Biblioteca, acuerdo: 52%", "Biblioteca, Sin información: 11%",
    ]);
  });

  it("el segmentado cambia al orden de la lámina", () => {
    montar();
    act(() => disparadores()[0].click());
    const lamina = [...host.querySelectorAll<HTMLButtonElement>("[role='radio']")].find((b) => b.textContent === "Orden de la lámina");
    act(() => lamina?.click());
    const escala = host.querySelector("[role='group'][data-lamina='s2']") as HTMLElement;
    expect(escala.querySelector("[role='option']")?.getAttribute("aria-label")).toBe("Biblioteca, acuerdo: 52%");
  });

  it("buscar filtra; flechas recorren filas y medidas; Enter elige y escribe la clave correcta", () => {
    montar();
    act(() => disparadores()[0].click());
    teclear("tutoria");
    expect(host.querySelectorAll("[role='option']")).toHaveLength(2);
    const input = buscador() as HTMLInputElement;
    tecla(input, "ArrowDown");
    const activa = () => host.querySelector(`#${CSS.escape(input.getAttribute("aria-activedescendant") ?? "")}`)?.getAttribute("aria-label");
    expect(activa()).toBe("Tutoría, acuerdo: 80%");
    tecla(input, "ArrowRight");
    expect(activa()).toBe("Tutoría, Sin información: 4%");
    tecla(input, "Enter");
    expect(payloadCierre().hallazgos).toEqual([{ lamina: "s2", cifra: "sin_info:Tutoría", texto: "", cifra_al_escribir: "4%" }]);
    expect(buscador()).toBeNull();
    expect(document.activeElement).toBe(disparadores()[0]);
    expect(disparadores()[0].textContent).toContain("4%");
  });

  it("un clic en una opción la elige de una vez (lámina y cifra en un solo cambio)", () => {
    montar();
    act(() => disparadores()[1].click());
    const op = [...host.querySelectorAll<HTMLElement>("[role='option']")].find((o) => o.getAttribute("aria-label") === "Docentes, mediana: 71%");
    act(() => op?.click());
    expect(payloadCierre().hallazgos).toEqual([{ lamina: "s1", cifra: "mediana:Docentes", texto: "", cifra_al_escribir: "71%" }]);
  });

  it("Escape cierra sin elegir y devuelve el foco; la búsqueda sin resultados lo dice", () => {
    montar();
    act(() => disparadores()[0].click());
    teclear("comedor");
    expect(host.querySelector("[role='listbox']")?.textContent).toContain('Ninguna cifra coincide con "comedor"');
    tecla(buscador() as HTMLInputElement, "Escape");
    expect(buscador()).toBeNull();
    expect(document.activeElement).toBe(disparadores()[0]);
    expect(payloadCierre().hallazgos).toEqual([]);
  });

  it("C2: con Inicio, la primera opción de un grupo trae también su cabecera a la vista", () => {
    montar();
    act(() => disparadores()[0].click());
    const lista = host.querySelector<HTMLElement>("[role='listbox']") as HTMLElement;
    const grupo = host.querySelector<HTMLElement>("[role='group'][data-lamina='s1']") as HTMLElement;
    lista.getBoundingClientRect = () => ({ top: 100 } as DOMRect);
    grupo.getBoundingClientRect = () => ({ top: 40 } as DOMRect);
    let desplazado = 0;
    Object.defineProperty(lista, "scrollTop", { configurable: true, get: () => desplazado, set: (v: number) => { desplazado = v; } });
    const input = buscador() as HTMLInputElement;
    tecla(input, "ArrowDown");
    tecla(input, "ArrowDown");
    desplazado = 80;
    tecla(input, "Home");
    // La cabecera del grupo estaba 60 px por encima del borde de la lista: sube 60 para que se vea con su primera fila.
    expect(desplazado).toBe(20);
  });

  it("C6 y C7: el buscador dice qué se busca y el nombre de la lámina va en su propia fila, sobre las medidas", () => {
    montar();
    act(() => disparadores()[0].click());
    expect(buscador()?.getAttribute("placeholder")).toBe("Pregunta o cifra");
    const cabeza = host.querySelector("[role='group'][data-lamina='s2'] .pulso-f6-elegir-cifra-grupo-cabeza") as HTMLElement;
    const hijos = [...cabeza.children].map((c) => c.className);
    expect(hijos).toEqual([
      "pulso-f6-elegir-cifra-grupo-nombre", "pulso-f6-elegir-cifra-columna-hueco", "pulso-f6-elegir-cifra-columna", "pulso-f6-elegir-cifra-columna",
    ]);
    expect(cabeza.querySelector(".pulso-f6-elegir-cifra-grupo-nombre")?.getAttribute("title")).toBe("Lámina 2: Escala");
  });

  it("la cifra que cambió desde que se eligió se avisa en la fila", () => {
    montar([{ lamina: "s1", cifra: "mediana:Docentes", texto: "Docentes arriba", cifra_al_escribir: "68%" }]);
    expect(host.textContent).toContain("La cifra cambió desde que se escribió el texto: era 68% y hoy es 71%.");
  });
});

describe("la maqueta del cierre", () => {
  it("las tarjetas sin cifra muestran «Hallazgo N» atenuado; la elegida, su cifra viva", () => {
    montar();
    const maqueta = () => [...host.querySelectorAll<HTMLElement>("[data-qa='cierre-maqueta'] > .pulso-f6-cierre-tarjeta")];
    expect(maqueta().map((t) => t.textContent)).toEqual(["Hallazgo 1", "Hallazgo 2", "Hallazgo 3"]);
    expect(maqueta().every((t) => t.classList.contains("is-vacia"))).toBe(true);
    montar([{ lamina: "s1", cifra: "mediana:Docentes", texto: "Docentes arriba" }, { lamina: "", cifra: "", texto: "Otra" }]);
    expect(maqueta().map((t) => [t.textContent, t.classList.contains("is-vacia")])).toEqual([["71%Docentes arriba", false], ["Hallazgo 2Otra", true], ["Hallazgo 3", true]]);
  });

  it("C4: elegir la primera cifra no cambia el número de tarjetas, y sin filas siguen las tres", () => {
    montar();
    const maqueta = () => [...host.querySelectorAll<HTMLElement>("[data-qa='cierre-maqueta'] > .pulso-f6-cierre-tarjeta")];
    act(() => disparadores()[0].click());
    const op = [...host.querySelectorAll<HTMLElement>("[role='option']")].find((o) => o.getAttribute("aria-label") === "Docentes, mediana: 71%");
    act(() => op?.click());
    expect(maqueta()).toHaveLength(3);
    expect(host.querySelector("[data-qa='cierre-maqueta']")?.className).toContain("is-n3");
    for (let k = 0; k < 3; k += 1) {
      const quitar = host.querySelector<HTMLButtonElement>("[aria-label^='Quitar el hallazgo']");
      act(() => quitar?.click());
    }
    expect(host.querySelectorAll("[role='group'][aria-label^='Hallazgo ']")).toHaveLength(0);
    expect(maqueta().map((t) => t.textContent)).toEqual(["Hallazgo 1", "Hallazgo 2", "Hallazgo 3"]);
    expect(maqueta().every((t) => t.getAttribute("aria-hidden") === "true")).toBe(true);
  });
});
