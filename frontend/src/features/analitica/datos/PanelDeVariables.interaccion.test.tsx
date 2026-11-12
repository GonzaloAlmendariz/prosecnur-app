// @vitest-environment happy-dom
/**
 * "Variables de la base" de Analítica › Datos: los filtros cuentan y muestran
 * lo mismo, una sección oculta bloquea el interruptor de sus variables y las
 * acciones de la sección mandan los nombres de todas sus variables.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { DataReviewVariable } from "../../../api/analitica";
import type { DataReviewSectionGroup } from "./borradorDeEtiquetas";
import type { FiltroDeVariables } from "./modeloDeVariables";
import { PanelDeVariables, type PanelDeVariablesProps } from "./PanelDeVariables";

function variable(name: string, patch: Partial<DataReviewVariable> = {}): DataReviewVariable {
  return {
    name, tipo_xlsform: "select_one sexo", seccion: "", included: true, label_actual: `Etiqueta de ${name}`,
    label_original: `Etiqueta de ${name}`, n_non_missing: 110, n_missing: 5, opciones: [{ code: "1", label: "Sí", count: 110 }],
    ...patch,
  };
}

const GRUPOS: DataReviewSectionGroup[] = [
  { id: "a", name: "Satisfacción", hidden: false, synthetic: false, variables: [variable("p12"), variable("p13")] },
  { id: "b", name: "Datos de control", hidden: true, synthetic: false, variables: [variable("correo", { tipo_xlsform: "text", opciones: [] })] },
];

const llamadas: { tipo: string; args: unknown[] }[] = [];
let host: HTMLDivElement;
let root: Root;

async function montar(filtro: FiltroDeVariables, extra: Partial<PanelDeVariablesProps> = {}) {
  const props: PanelDeVariablesProps = {
    grupos: GRUPOS,
    total: 3,
    filtro,
    consulta: "",
    estadoDe: (v, g) => ({ incluida: v.name !== "p13" && !g.hidden, porConfirmar: v.name === "p12" }),
    etiquetaDe: (v) => v.label_actual,
    detallesDe: () => 0,
    repartidas: new Set(),
    baseComun: 115,
    elegida: null,
    cargando: false,
    pie: null,
    onFiltro: (...args) => llamadas.push({ tipo: "filtro", args }),
    onBuscar: () => {},
    onIncluir: (...args) => llamadas.push({ tipo: "incluir", args }),
    onIncluirSeccion: (...args) => llamadas.push({ tipo: "seccion", args }),
    onRenombrarSeccion: () => {},
    onOcultarSeccion: () => {},
    onElegir: (...args) => llamadas.push({ tipo: "elegir", args }),
    onRecargar: () => {},
    ...extra,
  };
  await act(async () => { root.render(<PanelDeVariables {...props} />); });
}

const filas = () => [...host.querySelectorAll(".datos-fila:not(.datos-fila--cabecera)")];
const codigos = () => filas().map((f) => f.querySelector("code")?.textContent);
const chip = (rotulo: string) => [...host.querySelectorAll<HTMLButtonElement>('[aria-label="Filtrar variables"] button')]
  .find((b) => b.textContent?.startsWith(rotulo));

beforeEach(() => {
  llamadas.length = 0;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => { root.unmount(); });
  host.remove();
});

describe("Variables de la base", () => {
  it("cada filtro muestra tantas filas como dice su chip", async () => {
    const esperado: Record<FiltroDeVariables, string[]> = {
      todas: ["p12", "p13", "correo"],
      incluidas: ["p12"],
      excluidas: ["p13", "correo"],
      "por-confirmar": ["p12"],
    };
    const rotulo: Record<FiltroDeVariables, string> = { todas: "Todas", incluidas: "Incluidas", excluidas: "Excluidas", "por-confirmar": "Por confirmar" };
    for (const filtro of Object.keys(esperado) as FiltroDeVariables[]) {
      await montar(filtro);
      expect(codigos()).toEqual(esperado[filtro]);
      expect(chip(rotulo[filtro])?.textContent).toContain(String(esperado[filtro].length));
      expect(chip(rotulo[filtro])?.getAttribute("aria-pressed")).toBe("true");
    }
  });

  it("la fila dice que su etiqueta falta confirmar y la base de Con dato va una vez en el encabezado", async () => {
    await montar("todas");
    expect(filas()[0].textContent).toContain("Etiqueta por confirmar");
    expect(filas()[1].textContent).not.toContain("Etiqueta por confirmar");
    expect(host.querySelector('[role="columnheader"]:nth-child(5)')?.textContent).toBe("Con dato, de 115");
    expect(filas()[0].querySelector(".datos-con-dato em")?.textContent).toBe("110");
  });

  it("una sección oculta bloquea el interruptor de sus variables", async () => {
    await montar("todas");
    const interruptores = filas().map((f) => f.querySelector<HTMLButtonElement>('[role="switch"]'));
    expect(interruptores[0]?.disabled).toBe(false);
    expect(interruptores[2]?.disabled).toBe(true);
  });

  it("las acciones de la sección y de la fila mandan sus nombres", async () => {
    await montar("todas");
    const incluirTodas = [...host.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent === "Incluir todas");
    await act(async () => { incluirTodas?.click(); });
    expect(llamadas).toContainEqual({ tipo: "seccion", args: [["p12", "p13"], true] });
    await act(async () => { filas()[1].querySelector<HTMLButtonElement>(".datos-codigo")?.click(); });
    expect(llamadas).toContainEqual({ tipo: "elegir", args: ["p13"] });
    await act(async () => { filas()[0].querySelector<HTMLButtonElement>('[role="switch"]')?.click(); });
    expect(llamadas).toContainEqual({ tipo: "incluir", args: ["p12"] });
  });

  it("sin coincidencias lo dice dentro del panel", async () => {
    await montar("todas", { consulta: "zzz" });
    expect(filas()).toHaveLength(0);
    expect(host.textContent).toContain("Ninguna variable coincide");
  });
});
