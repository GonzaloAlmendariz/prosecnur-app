// @vitest-environment happy-dom
// "Revisar emparejado" montado de verdad (ADR 0135 §7): la entrada resume los estados, el panel abre por `?panel=`, la
// tabla es la del kit, los filtros acotan, confirmar escribe el par en el payload del contraste (y la fila pasa a
// "Confirmado en esta lámina"), descartar la deja sin par y guardar en la matriz confirma antes y funde sin quitar filas.
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EquivalenciaFila } from "../../../../api/equivalencias";
import type { Emparejado } from "../../../../api/graficosEmparejado";

const api = vi.hoisted(() => ({
  matriz: [] as EquivalenciaFila[],
  guardadas: [] as EquivalenciaFila[][],
}));

vi.mock("../../useVariables", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../useVariables")>()),
  useVariables: () => ({
    sources: [
      { name: "docentes", variables: [{ name: "p2", label: "Texto p2", tipo: "select_one", seccion: "", scale_signature: "e5" }] },
      { name: "estudiantes", variables: [
        { name: "q2", label: "Texto q2", tipo: "select_one", seccion: "", scale_signature: "e5" },
        { name: "q3", label: "Texto q3", tipo: "select_one", seccion: "", scale_signature: "e5" },
      ] },
    ],
  }),
}));

const DATOS: Emparejado = {
  bases: ["docentes", "estudiantes"],
  preguntas: [
    { base: "docentes", var: "p1", etiqueta: "Texto p1", tema: "Clima", estado: "matriz", par: { base: "estudiantes", var: "q1", etiqueta: "Texto q1" }, sugerencias: [] },
    { base: "docentes", var: "p2", etiqueta: "Texto p2", tema: "Texto p2", estado: "sin_par", par: null,
      sugerencias: [{ base: "estudiantes", var: "q2", etiqueta: "Texto q2", puntaje: 0.8 }] },
    { base: "docentes", var: "p3", etiqueta: "Texto p3", tema: "Texto p3", estado: "sin_par", par: null, sugerencias: [] },
  ],
};

vi.mock("./useEmparejado", () => ({
  useEmparejado: () => ({ fase: "lista", datos: DATOS, recargar: () => undefined }),
}));

vi.mock("../../../../api/equivalencias", () => ({
  getEquivalencias: async () => ({ ok: true, disponible: true, declarada: true, n_filas: api.matriz.length, bases: ["docentes", "estudiantes"],
    cobertura: {}, desfasadas: [], filas: api.matriz }),
  guardarEquivalencias: async (filas: EquivalenciaFila[]) => { api.guardadas.push(filas); return { ok: true, estado: {}, aplicacion: {} }; },
}));

const avisos = vi.hoisted(() => ({ exito: [] as string[] }));
vi.mock("../../../../components/toasterStore", () => ({ toast: { exito: (t: string) => { avisos.exito.push(t); } } }));

import { useEmparejadoUi } from "./emparejadoStore";
import { EntradaEmparejado } from "./EntradaEmparejado";

let host: HTMLDivElement;
let root: Root;
let ultimoPatch: Record<string, unknown> | null = null;

function Tarjeta() {
  const [args, setArgs] = useState<Record<string, unknown>>({ estilo: "resumen", cruce: null, vars: {} });
  return (
    <EntradaEmparejado args={args} scope="active" onCambio={(patch) => { ultimoPatch = patch; setArgs((a) => ({ ...a, ...patch })); }} />
  );
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  api.matriz = [{ seccion: "", etiqueta_estandar: "Clima", variables: { docentes: "p1", estudiantes: "q1" }, cantidad: 2 }];
  api.guardadas = [];
  avisos.exito = [];
  ultimoPatch = null;
  useEmparejadoUi.setState({ filtro: "todas", descartadas: {}, buscando: null, guardado: { fase: "inactivo" } });
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  document.body.innerHTML = "";
});

function montar(search: string) {
  act(() => root.render(<MemoryRouter initialEntries={[`/procesamiento${search}`]}><Tarjeta /></MemoryRouter>));
}

const botonPorTexto = (texto: string) =>
  [...document.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent?.trim() === texto);

const clic = async (el: HTMLElement | undefined) => {
  expect(el).toBeTruthy();
  await act(async () => { el?.click(); await Promise.resolve(); });
};

describe("Revisar emparejado", () => {
  it("la entrada resume los estados y abre el panel", () => {
    montar("");
    expect(host.textContent).toContain("1 en la matriz, 1 por confirmar, 1 sin par");
    expect(botonPorTexto("Revisar emparejado")).toBeTruthy();
    expect(document.querySelector("[data-pulso-panel='emparejado']")).toBeNull();
  });

  it("panel abierto: tabla del kit con un público por columna, cuatro estados y sin checkbox ni confirmación en bloque", () => {
    montar("?panel=emparejado");
    const panel = document.querySelector("[data-pulso-panel='emparejado']");
    expect(panel).toBeTruthy();
    expect(document.querySelector("[data-qa-surface='graficos/emparejado']")?.getAttribute("data-audit-ready")).toBe("graficos-emparejado");
    const encabezados = [...document.querySelectorAll(".pulso-table th")].map((th) => th.textContent?.trim());
    expect(encabezados).toEqual(["Docentes", "Estudiantes", "Cómo se emparejó", "Acciones"]);
    const texto = document.body.textContent ?? "";
    expect(texto).toContain("En la matriz");
    expect(texto).toContain("Sugerido por el texto");
    expect(texto).toContain("Sin par");
    expect(document.querySelector("input[type='checkbox']")).toBeNull();
    expect(texto).not.toMatch(/Confirmar todas|Confirmar todo/);
    expect(botonPorTexto("Guardar lo confirmado en la matriz")?.disabled).toBe(true);
  });

  it("los filtros acotan las filas", async () => {
    montar("?panel=emparejado");
    await clic([...document.querySelectorAll<HTMLButtonElement>("[role='radio']")].find((b) => b.textContent?.startsWith("Sin par")));
    const filas = document.querySelectorAll(".pulso-table tbody tr");
    expect(filas).toHaveLength(1);
    expect(filas[0].textContent).toContain("Texto p3");
  });

  it("confirmar escribe el par en el payload y la fila pasa a Confirmado en esta lámina", async () => {
    montar("?panel=emparejado");
    await clic(botonPorTexto("Confirmar"));
    expect(ultimoPatch).toEqual({ vars: { texto_p2: ["docentes$p2", "estudiantes$q2"] }, titulos_grupo: { texto_p2: "Texto p2" }, cruce: null, grupos: null });
    expect(document.body.textContent).toContain("Confirmado en esta lámina");
    expect(document.body.textContent).toContain("1 par confirmado en esta lámina");
  });

  it("descartar deja la fila sin par y no toca la lámina", async () => {
    montar("?panel=emparejado");
    await clic(botonPorTexto("Descartar"));
    expect(ultimoPatch).toBeNull();
    expect(document.body.textContent).not.toContain("Sugerido por el texto");
    expect(document.querySelectorAll(".pulso-f6-emp-estado[data-estado='sin_par']")).toHaveLength(2);
  });

  it("buscar par abre el buscador por texto con las preguntas de la otra base y elegir una la confirma", async () => {
    montar("?panel=emparejado");
    await clic(botonPorTexto("Buscar par"));
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    const opciones = [...document.querySelectorAll<HTMLLIElement>("[role='option']")];
    expect(opciones.map((o) => o.querySelector("code")?.textContent)).toEqual(["q2", "q3"]);
    await clic(opciones[1]);
    expect(ultimoPatch?.vars).toEqual({ texto_p3: ["docentes$p3", "estudiantes$q3"] });
    expect(document.querySelectorAll(".pulso-f6-emp-estado[data-estado='confirmado']")).toHaveLength(1);
  });

  it("guardar en la matriz avisa cuántas filas agrega y funde sin quitar las que estaban", async () => {
    montar("?panel=emparejado");
    await clic(botonPorTexto("Confirmar"));
    await clic(botonPorTexto("Guardar lo confirmado en la matriz"));
    await act(async () => { await Promise.resolve(); });
    expect(document.body.textContent).toContain("Se agrega 1 fila a la matriz.");
    expect(api.guardadas).toHaveLength(0);
    await clic(botonPorTexto("Guardar en la matriz"));
    await act(async () => { await Promise.resolve(); });
    expect(api.guardadas).toHaveLength(1);
    expect(api.guardadas[0]).toHaveLength(2);
    expect(api.guardadas[0][0]).toEqual(api.matriz[0]);
    expect(api.guardadas[0][1]).toMatchObject({ variables: { docentes: "p2", estudiantes: "q2" }, etiqueta_estandar: "Texto p2" });
    expect(api.guardadas[0][1].sugerida).toBeUndefined();
    expect(avisos.exito).toEqual(["Matriz de equivalencias actualizada"]);
  });
});
