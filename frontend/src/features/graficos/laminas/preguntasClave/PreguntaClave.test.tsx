// @vitest-environment happy-dom
// «Pregunta clave del estudio» en la tarjeta del gráfico (H14): el interruptor lee y escribe `plan.preguntas_clave` con
// la referencia del gráfico; en la multiapilada, uno por pregunta con su enunciado.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../useVariables", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../useVariables")>()),
  useVariables: () => ({ sources: [], multi: false, loading: false, error: "", variables: [
    { name: "B8_1", label: "WhatsApp", source: "default" }, { name: "B8_2", label: "Instagram", source: "default" },
  ] }),
}));

const { usePlanStore } = await import("../../store");
const { PreguntaClave } = await import("./PreguntaClave");
const { EtiquetasCortasPreguntas } = await import("../EtiquetasCortas");

// Una lámina de un gráfico (cuenta para el resumen) y una de dos (no cuenta).
const LAMINAS = [{ id: "s1", tipo: "p_slide_1_grafico", payload: {} }, { id: "s2", tipo: "p_slide_2_graficos", payload: {} }] as never[];

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  usePlanStore.setState({ plan: { slides: LAMINAS }, presets: {} });
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const interruptores = () => [...host.querySelectorAll<HTMLButtonElement>('[role="switch"]')];

describe("PreguntaClave", () => {
  it("un gráfico de una pregunta: un interruptor con su ayuda que escribe la referencia tal cual", () => {
    act(() => root.render(<PreguntaClave slideId="s1" graficador="p_barras_agrupadas" args={{ var: "base$P1" }} />));
    const [sw] = interruptores();
    expect(interruptores()).toHaveLength(1);
    expect(host.textContent).toContain("Pregunta clave del estudio");
    expect(host.textContent).toContain("El resumen ejecutivo propone sus hallazgos a partir de las preguntas clave.");
    expect(sw.getAttribute("aria-checked")).toBe("false");
    act(() => sw.click());
    expect(usePlanStore.getState().plan.preguntas_clave).toEqual(["base$P1"]);
    expect(interruptores()[0].getAttribute("aria-checked")).toBe("true");
    act(() => interruptores()[0].click());
    expect("preguntas_clave" in usePlanStore.getState().plan).toBe(false);
  });

  it("una multiapilada de una barra por pregunta: el interruptor va en la fila del nombre corto, no se repite la lista", () => {
    usePlanStore.setState({ plan: { slides: LAMINAS, preguntas_clave: ["B8_1"] } });
    const args = { modo: "var", vars: ["B8_1", "B8_2"], top2box_labels: ["Todos los días"] };
    act(() => root.render(<><PreguntaClave slideId="s1" graficador="p_barras_multiapiladas" args={args} /><EtiquetasCortasPreguntas slideId="s1" args={args} onCambio={() => undefined} /></>));
    expect(host.querySelector('[data-qa="pregunta-clave"]')).toBeNull();
    expect(interruptores().map((s) => s.getAttribute("aria-label"))).toEqual(["Pregunta clave del estudio: WhatsApp", "Pregunta clave del estudio: Instagram"]);
    expect(interruptores().map((s) => s.getAttribute("aria-checked"))).toEqual(["true", "false"]);
    act(() => interruptores()[1].click());
    expect(usePlanStore.getState().plan.preguntas_clave).toEqual(["B8_1", "B8_2"]);
    expect(host.textContent).toContain("Clave: el resumen ejecutivo propone sus hallazgos a partir de las preguntas clave.");
  });

  it("una multiapilada en otro modo: su propia lista, uno por pregunta, con cuántas van marcadas", () => {
    usePlanStore.setState({ plan: { slides: LAMINAS, preguntas_clave: ["OTRA"] } });
    act(() => root.render(<PreguntaClave slideId="s1" graficador="p_barras_multiapiladas" args={{ modo: "grupo", vars: ["B8_1", "B8_2"], top2box_labels: ["Todos los días"] }} />));
    expect(interruptores().map((s) => s.getAttribute("aria-label"))).toEqual(["Pregunta clave: WhatsApp", "Pregunta clave: Instagram"]);
    expect(host.textContent).toContain("Ninguna");
    act(() => interruptores()[1].click());
    expect(usePlanStore.getState().plan.preguntas_clave).toEqual(["OTRA", "B8_2"]);
    expect(host.textContent).toContain("1 de 2");
  });

  it("sin pregunta (o en citas) no se muestra", () => {
    act(() => root.render(<PreguntaClave slideId="s1" graficador="p_citas" args={{ var: "abierta" }} />));
    expect(host.innerHTML).toBe("");
  });

  it("un gráfico que no entra al resumen: no ofrece el interruptor y dice por qué", () => {
    act(() => root.render(<PreguntaClave slideId="s1" graficador="p_barras_agrupadas" args={{ var: "P1", cruces: ["sexo"] }} />));
    expect(interruptores()).toHaveLength(0);
    expect(host.textContent).toContain("Esta pregunta no entra al resumen ejecutivo: solo cuentan los gráficos sin «Dividir por».");
    act(() => root.render(<PreguntaClave slideId="s2" graficador="p_barras_agrupadas" args={{ var: "P1" }} />));
    expect(host.textContent).toContain("solo cuentan las láminas de un gráfico.");
  });

  it("R6-14: en una lámina del resumen ejecutivo no ofrece «Pregunta clave» ni dice que no entra al resumen", () => {
    usePlanStore.setState({ plan: { slides: [...LAMINAS, { id: "s9", tipo: "p_slide_1_grafico", payload: {}, origen: "resumen" }] as never[] } });
    act(() => root.render(<PreguntaClave slideId="s9" graficador="p_barras_agrupadas" args={{ var: "P1" }} />));
    expect(host.innerHTML).toBe("");
    // Sin origen, la reconoce por lo que lee: las de escala de un público o una regla.
    act(() => root.render(<PreguntaClave slideId="s1" graficador="p_barras_divergentes" args={{ vars: ["docentes$*"] }} />));
    expect(host.textContent).not.toContain("no entra al resumen");
    act(() => root.render(<PreguntaClave slideId="s1" graficador="p_dumbbell" args={{ estilo: "resumen", var: "P1", regla: { tipo: "mayor_diferencia", n: 5 } }} />));
    expect(host.innerHTML).toBe("");
  });

  it("si ya estaba marcada en un gráfico que no cuenta, deja quitarla y dice por qué", () => {
    usePlanStore.setState({ plan: { slides: LAMINAS, preguntas_clave: ["P1"] } });
    act(() => root.render(<PreguntaClave slideId="s1" graficador="p_lineas_nivel" args={{ var: "P1" }} />));
    expect(interruptores()).toHaveLength(1);
    expect(host.textContent).toContain("solo cuentan los gráficos de barras. Apágalo para quitarla.");
    act(() => interruptores()[0].click());
    expect("preguntas_clave" in usePlanStore.getState().plan).toBe(false);
  });

  it("una batería sin Top Two Box no lleva columna «Clave» y lo dice", () => {
    const args = { modo: "var", vars: ["B8_1", "B8_2"] };
    act(() => root.render(<><PreguntaClave slideId="s1" graficador="p_barras_multiapiladas" args={args} /><EtiquetasCortasPreguntas slideId="s1" args={args} onCambio={() => undefined} /></>));
    expect(interruptores()).toHaveLength(0);
    expect(host.textContent).toContain("una batería cuenta solo con su Top Two Box.");
  });
});
