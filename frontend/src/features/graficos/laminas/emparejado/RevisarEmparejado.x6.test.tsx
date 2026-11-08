// @vitest-environment happy-dom
// «Revisar emparejado» con las herramientas de X6 (auditoría en Arte: 104 pares iguales de aspecto, textos truncados):
// la coincidencia de cada par, la evidencia con los dos textos enteros, el filtro por coincidencia con su conteo, el lote
// de idénticos (deshacible par por par) y el teclado (J, K, Enter, X) que no interfiere con los campos.
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Emparejado } from "../../../../api/graficosEmparejado";

vi.mock("../../useVariables", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../useVariables")>()),
  useVariables: () => ({
    sources: [
      { name: "docentes", variables: [] },
      { name: "estudiantes", variables: [] },
    ],
  }),
}));

const S = (v: string, etiqueta: string, puntaje: number) => ({ base: "estudiantes", var: v, etiqueta, puntaje });

// Dos idénticos (uno por texto normalizado, otro por puntaje 1), un parecido, un distinto y uno sin par.
const DATOS: Emparejado = {
  bases: ["docentes", "estudiantes"],
  preguntas: [
    { base: "docentes", var: "p1", etiqueta: "Servicio de salud", tema: "Servicio de salud", estado: "sin_par", par: null,
      sugerencias: [S("q1", "Servicio de salud.", 0.9)] },
    { base: "docentes", var: "p2", etiqueta: "Calidad del servicio", tema: "Calidad del servicio", estado: "sin_par", par: null,
      sugerencias: [S("q2", "Servicio: calidad", 1)] },
    { base: "docentes", var: "p3", etiqueta: "Calidad de la biblioteca", tema: "Calidad de la biblioteca", estado: "sin_par", par: null,
      sugerencias: [S("q3", "Calidad de la biblioteca central", 0.667)] },
    { base: "docentes", var: "p4", etiqueta: "Los docentes se desempeñan eficazmente", tema: "Desempeño", estado: "sin_par", par: null,
      sugerencias: [S("q4", "Estoy satisfecho(a) con el liderazgo de los docentes", 0.25)] },
    { base: "docentes", var: "p5", etiqueta: "Texto p5", tema: "Texto p5", estado: "sin_par", par: null, sugerencias: [] },
  ],
};

vi.mock("./useEmparejado", () => ({
  useEmparejado: () => ({ fase: "lista", datos: DATOS, recargar: () => undefined }),
}));

vi.mock("../../../../api/equivalencias", () => ({
  getEquivalencias: async () => ({ ok: true, disponible: true, declarada: true, n_filas: 0, bases: [], cobertura: {}, desfasadas: [], filas: [] }),
  guardarEquivalencias: async () => ({ ok: true, estado: {}, aplicacion: {} }),
}));

vi.mock("../../../../components/toasterStore", () => ({ toast: { exito: () => undefined } }));

import { useEmparejadoUi } from "./emparejadoStore";
import { EntradaEmparejado } from "./EntradaEmparejado";

let host: HTMLDivElement;
let root: Root;
let ultimoPatch: Record<string, unknown> | null = null;

function Tarjeta() {
  const [args, setArgs] = useState<Record<string, unknown>>({ estilo: "resumen", cruce: null, vars: {} });
  return <EntradaEmparejado args={args} scope="active" onCambio={(patch) => { ultimoPatch = patch; setArgs((a) => ({ ...a, ...patch })); }} />;
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  ultimoPatch = null;
  useEmparejadoUi.setState({ filtro: "todas", coincidencia: "todas", descartadas: {}, buscando: null, activa: null, guardado: { fase: "inactivo" } });
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  document.body.innerHTML = "";
});

function abrir() {
  act(() => root.render(<MemoryRouter initialEntries={["/procesamiento?panel=emparejado"]}><Tarjeta /></MemoryRouter>));
}

const filas = () => [...document.querySelectorAll<HTMLTableRowElement>(".pulso-table tbody tr")];
const chipDe = (tr: HTMLTableRowElement) => tr.querySelector(".pulso-f6-emp-chip")?.textContent ?? null;
const estadoDe = (tr: HTMLTableRowElement) => tr.querySelector(".pulso-f6-emp-estado")?.getAttribute("data-estado");
const evidencia = () => document.querySelector<HTMLElement>(".pulso-f6-emp-evidencia");

const clic = async (el: Element | null | undefined) => {
  expect(el).toBeTruthy();
  await act(async () => { (el as HTMLElement).click(); await Promise.resolve(); });
};

describe("coincidencia por par", () => {
  it("cada par lleva su chip y la fila sin par ninguno", () => {
    abrir();
    expect(filas().map(chipDe)).toEqual(["Idéntico", "Idéntico", "Parecido", "Distinto", null]);
  });
});

describe("evidencia del par", () => {
  it("no hay evidencia hasta activar una fila", () => {
    abrir();
    expect(evidencia()).toBeNull();
  });

  it("un clic en la fila muestra los dos textos enteros con lo distinto marcado", async () => {
    abrir();
    await clic(filas()[3].querySelector("td"));
    const ev = evidencia();
    expect(ev).toBeTruthy();
    expect(filas()[3].getAttribute("data-selected")).toBe("true");
    const textos = [...(ev?.querySelectorAll(".pulso-f6-emp-evid-texto") ?? [])].map((t) => t.textContent);
    expect(textos).toEqual(["Los docentes se desempeñan eficazmente", "Estoy satisfecho(a) con el liderazgo de los docentes"]);
    expect([...(ev?.querySelectorAll("mark") ?? [])].map((m) => m.textContent))
      .toEqual(["se desempeñan eficazmente", "Estoy satisfecho(a) con el liderazgo de"]);
    expect(ev?.textContent).toContain("Distinto");
    expect(ev?.textContent).toContain("Palabras en común 25%");
  });

  it("el foco dentro de una fila también la activa; la fila sin par muestra «Sin par» al otro lado", async () => {
    abrir();
    const ancla = filas()[4].querySelector<HTMLElement>("[data-emp-fila]");
    await act(async () => { ancla?.focus(); await Promise.resolve(); });
    expect(useEmparejadoUi.getState().activa).toBe("docentes$p5");
    expect(evidencia()?.textContent).toContain("Sin par");
    expect(evidencia()?.querySelectorAll("mark")).toHaveLength(0);
  });
});

describe("filtro por coincidencia", () => {
  const radios = (grupo: string) =>
    [...document.querySelectorAll<HTMLButtonElement>(`[role='radiogroup'][aria-label='${grupo}'] [role='radio']`)];

  it("cuatro segmentos con su conteo", () => {
    abrir();
    expect(radios("Coincidencia del par").map((b) => b.textContent)).toEqual(["Todas (5)", "Idéntico (2)", "Parecido (1)", "Distinto (1)"]);
  });

  it("un segmento acota las filas y el filtro por estado recalcula los conteos", async () => {
    abrir();
    await clic(radios("Coincidencia del par").find((b) => b.textContent?.startsWith("Idéntico")));
    expect(filas().map(chipDe)).toEqual(["Idéntico", "Idéntico"]);
    await clic(radios("Coincidencia del par").find((b) => b.textContent?.startsWith("Distinto")));
    expect(filas().map((tr) => tr.textContent?.includes("eficazmente"))).toEqual([true]);
    await clic(radios("Qué preguntas mostrar").find((b) => b.textContent?.startsWith("Sin par")));
    expect(radios("Coincidencia del par").map((b) => b.textContent)).toEqual(["Todas (1)", "Idéntico (0)", "Parecido (0)", "Distinto (0)"]);
    expect(document.querySelector(".pulso-table-vacio")?.textContent).toBe("Ningún par distinto entre los sin par.");
  });
});

describe("Confirmar los idénticos", () => {
  const botonLote = () =>
    [...document.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent?.startsWith("Confirmar los idénticos"));

  it("confirma de una vez sólo los idénticos, quedan marcados y cada uno se deshace solo", async () => {
    abrir();
    expect(botonLote()?.textContent).toBe("Confirmar los idénticos (2)");
    await clic(botonLote());
    expect(ultimoPatch?.vars).toEqual({
      servicio_de_salud: ["docentes$p1", "estudiantes$q1"],
      calidad_del_servicio: ["docentes$p2", "estudiantes$q2"],
    });
    expect(filas().map(estadoDe)).toEqual(["confirmado", "confirmado", "sugerido", "sugerido", "sin_par"]);
    expect(filas().slice(0, 2).map(chipDe)).toEqual(["Idéntico", "Idéntico"]);
    expect(botonLote()?.textContent).toBe("Confirmar los idénticos (0)");
    expect(botonLote()?.disabled).toBe(true);
    expect(document.body.textContent).toContain("2 pares confirmados en esta lámina");
    await clic(filas()[0].querySelector<HTMLButtonElement>("[aria-label^='Quitar de la lámina']"));
    expect(filas().map(estadoDe)).toEqual(["sugerido", "confirmado", "sugerido", "sugerido", "sin_par"]);
    expect(botonLote()?.textContent).toBe("Confirmar los idénticos (1)");
  });
});

describe("teclado", () => {
  const pulsar = async (key: string, objetivo: Element | null = document.activeElement) => {
    await act(async () => {
      (objetivo ?? document.body).dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
      await new Promise((r) => setTimeout(r, 20));
    });
  };
  const activa = () => useEmparejadoUi.getState().activa;

  it("J y K recorren las filas, con el foco en la fila y su evidencia", async () => {
    abrir();
    const panel = document.querySelector("[data-pulso-panel='emparejado']");
    await pulsar("j", panel);
    expect(activa()).toBe("docentes$p1");
    expect(document.activeElement?.getAttribute("data-emp-fila")).toBe("docentes$p1");
    await pulsar("j");
    await pulsar("j");
    expect(activa()).toBe("docentes$p3");
    expect(evidencia()?.textContent).toContain("Calidad de la biblioteca central");
    await pulsar("k");
    expect(activa()).toBe("docentes$p2");
  });

  it("Enter confirma la fila activa y X la quita; la fila sigue activa", async () => {
    abrir();
    const panel = document.querySelector("[data-pulso-panel='emparejado']");
    await pulsar("j", panel);
    await pulsar("j");
    await pulsar("j");
    await pulsar("Enter");
    expect(ultimoPatch?.vars).toEqual({ calidad_de_la_biblioteca: ["docentes$p3", "estudiantes$q3"] });
    expect(estadoDe(filas()[2])).toBe("confirmado");
    expect(activa()).toBe("docentes$p3");
    await pulsar("x");
    expect(estadoDe(filas()[2])).toBe("sugerido");
    await pulsar("x");
    expect(estadoDe(filas()[2])).toBe("sin_par");
  });

  it("no interfiere con los campos ni con Enter sobre un botón, y con el panel cerrado no escucha", async () => {
    abrir();
    const panel = document.querySelector("[data-pulso-panel='emparejado']");
    const campo = document.createElement("input");
    panel?.appendChild(campo);
    await pulsar("j", campo);
    expect(activa()).toBeNull();
    await pulsar("j", panel);
    const cambiar = filas()[0].querySelector<HTMLButtonElement>("[aria-label^='Cambiar el par']");
    await pulsar("Enter", cambiar);
    expect(ultimoPatch).toBeNull();
    // MemoryRouter no relee initialEntries: se monta de nuevo sin `?panel=`.
    act(() => root.unmount());
    root = createRoot(host);
    act(() => root.render(<MemoryRouter initialEntries={["/procesamiento"]}><Tarjeta /></MemoryRouter>));
    expect(document.querySelector("[data-pulso-panel='emparejado'][data-state='open']")).toBeNull();
    useEmparejadoUi.setState({ activa: null });
    await pulsar("j", document.body);
    expect(activa()).toBeNull();
  });
});
