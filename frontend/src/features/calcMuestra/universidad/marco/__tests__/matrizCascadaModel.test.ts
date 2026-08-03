import { describe, expect, it } from "vitest";

import type { CalcMuestraCriteriosCascada } from "../../../../../api/calcMuestraCriteriosI18b";
import { construirMatrizCascada, cuadraConElMotor } from "../matrizCascadaModel";

/**
 * ADR 0058 · La matriz es la transposición de la cascada.
 *
 * Lo que estas pruebas vigilan es que no se calcule nada nuevo y que la última
 * fila **sume** — que es la diferencia con la matriz marginal, cuyo total se
 * recalcula sobre todo el marco.
 */
const fac = (key: string, label: string, before: number, after: number) => ({
  faculty_key: key, label, before_ch: before, after_ch: after, excluded_ch: before - after,
});

function cascada(over: Partial<CalcMuestraCriteriosCascada> = {}): CalcMuestraCriteriosCascada {
  return {
    schema: "calc_muestra_aulas_criterios_cascada_v1",
    owner: "calc_muestra_aulas_frame_v1.criterios_cascada",
    source_frame_hash: "h", criteria_hash: "c", momento: "marco_ejecutado",
    grain: "paso_x_facultad_efectiva", unit: "curso_horario_unico", order_source: "motor_r",
    steps: [
      { order: 1, criterion_id: "enrolled_total", card_id: "enrolled_total", label: "Matriculados",
        scope: "aula", gate: true, applies: true, status: "aplicado",
        faculties: [fac("ing", "Ingeniería", 281, 277), fac("gas", "Gastronomía", 45, 44)],
        total: { before_ch: 326, after_ch: 321, excluded_ch: 5 } },
      { order: 2, criterion_id: "minEligible", card_id: "minEligible", label: "Mínimo de elegibles",
        scope: "aula", gate: true, applies: true, status: "aplicado",
        faculties: [fac("ing", "Ingeniería", 277, 264), fac("gas", "Gastronomía", 44, 8)],
        total: { before_ch: 321, after_ch: 272, excluded_ch: 49 } },
    ],
    ...over,
  } as CalcMuestraCriteriosCascada;
}

describe("construirMatrizCascada", () => {
  it("transpone: facultades en filas, criterios en columnas", () => {
    const m = construirMatrizCascada(cascada())!;
    expect(m.criterios.map((c) => c.id)).toEqual(["enrolled_total", "minEligible"]);
    expect(m.filas.map((f) => f.facultadKey)).toEqual(["ing", "gas"]);
  });

  it("cada celda es lo que ese criterio QUITÓ, no lo que aportó", () => {
    const m = construirMatrizCascada(cascada())!;
    const gas = m.filas.find((f) => f.facultadKey === "gas")!;
    // El mínimo se lleva 36 de los 44 que quedaban: el caso que justifica la
    // matriz entera, y que ninguna tarjeta suelta enseña.
    expect(gas.celdas.map((c) => c.quita)).toEqual([1, 36]);
  });

  it("el universo es el before del primer paso, no una suma", () => {
    const m = construirMatrizCascada(cascada())!;
    expect(m.filas.find((f) => f.facultadKey === "ing")!.universo).toBe(281);
  });

  it("lo que queda sale del after del último paso, no de restar", () => {
    // Si un paso no publicara alguna facultad, `universo − Σquita` mentiría y
    // el `after` no.
    const m = construirMatrizCascada(cascada())!;
    expect(m.filas.find((f) => f.facultadKey === "gas")!.quedan).toBe(8);
  });

  it("la última fila SUMA las facultades", () => {
    // Es la diferencia con la matriz marginal, cuyo total se recalcula.
    const m = construirMatrizCascada(cascada())!;
    expect(m.total.universo).toBe(281 + 45);
    expect(m.total.quedan).toBe(264 + 8);
    // 4+1 en matriculados, 13+36 en el mínimo. El primero coincide con el
    // `excluded_ch` que el motor publica para ese paso (5): la suma de las
    // filas reproduce su total, que es justo lo que la matriz promete y lo que
    // la matriz marginal no puede prometer.
    expect(m.total.celdas.map((c) => c.quita)).toEqual([4 + 1, 13 + 36]);
  });

  it("publica la supervivencia de cada fila", () => {
    const m = construirMatrizCascada(cascada())!;
    expect(m.filas.find((f) => f.facultadKey === "gas")!.supervivencia).toBeCloseTo(8 / 45, 4);
  });

  it("un universo en cero no divide por cero", () => {
    const c = cascada();
    c.steps[0].faculties = [fac("x", "Vacía", 0, 0)];
    c.steps[1].faculties = [fac("x", "Vacía", 0, 0)];
    const m = construirMatrizCascada(c)!;
    expect(m.filas[0].supervivencia).toBeNull();
  });

  it("los pasos operativos ENTRAN, marcados: si no, la matriz no llega a los elegibles", () => {
    // Medido en la app: la matriz sumaba 2.806 y el KPI decía 2.799. No era el
    // motor — era el filtro. Las exclusiones manuales viajan con `gate = false`
    // porque no son un criterio metodológico, y descartarlas hacía que la
    // superficie aterrizara en un número que no eran los elegibles: prometía
    // contar de dónde salen y paraba un paso antes.
    const c = cascada();
    c.steps.push({
      ...c.steps[1], criterion_id: "manual_excluded", label: "Exclusiones manuales", gate: false,
      faculties: [fac("ing", "Ingeniería", 264, 260), fac("gas", "Gastronomía", 8, 5)],
      total: { before_ch: 272, after_ch: 265, excluded_ch: 7 },
    } as never);
    const m = construirMatrizCascada(c)!;
    const op = m.criterios.find((x) => x.id === "manual_excluded");
    expect(op).toBeDefined();
    expect(op!.operativo).toBe(true);
    // Y la matriz aterriza en los elegibles de verdad.
    expect(m.total.quedan).toBe(260 + 5);
  });

  it("un criterio metodológico no se marca como operativo", () => {
    const m = construirMatrizCascada(cascada())!;
    expect(m.criterios.every((c) => c.operativo === false)).toBe(true);
  });

  it("sin pasos no inventa una matriz vacía", () => {
    expect(construirMatrizCascada(cascada({ steps: [] }))).toBeNull();
    expect(construirMatrizCascada(null)).toBeNull();
  });
});

describe("construirMatrizCascada · el estado es de la celda (ADR 0057, regla 1)", () => {
  it("editar en una facultad no pone en espera a las demás", () => {
    const m = construirMatrizCascada(cascada(), { facultadKey: "ing", criterioId: "enrolled_total" })!;
    const ing = m.filas.find((f) => f.facultadKey === "ing")!;
    const gas = m.filas.find((f) => f.facultadKey === "gas")!;
    expect(ing.celdas.map((c) => c.estado)).toEqual(["editando", "espera"]);
    // El embudo de Gastronomía no se ha movido: sus cifras no están en duda.
    expect(gas.celdas.every((c) => c.estado === "confirmado")).toBe(true);
  });

  it("sólo hay una celda en edición en toda la matriz", () => {
    const m = construirMatrizCascada(cascada(), { facultadKey: "gas", criterioId: "minEligible" })!;
    const editando = m.filas.flatMap((f) => f.celdas).filter((c) => c.estado === "editando");
    expect(editando).toHaveLength(1);
  });

  it("una celda que apunta a un criterio inexistente no abre cascada", () => {
    const m = construirMatrizCascada(cascada(), { facultadKey: "ing", criterioId: "no-existe" })!;
    expect(m.filas.flatMap((f) => f.celdas).every((c) => c.estado === "confirmado")).toBe(true);
  });

  it("la fila total nunca está en edición", () => {
    const m = construirMatrizCascada(cascada(), { facultadKey: "ing", criterioId: "enrolled_total" })!;
    expect(m.total.celdas.every((c) => c.estado === "confirmado")).toBe(true);
  });
});

describe("cuadraConElMotor", () => {
  it("declara cuando la suma coincide con el total del motor", () => {
    const c = cascada();
    const m = construirMatrizCascada(c)!;
    expect(cuadraConElMotor(m, c)).toBe(true);
  });

  it("y cuando no, para poder decirlo en pantalla en vez de esconderlo", () => {
    // Un descuadre significa que algún paso no publicó todas sus facultades. No
    // es un fallo de la matriz, pero el usuario tiene derecho a saber que la
    // última fila no es exactamente la suma de lo que está viendo.
    const c = cascada();
    c.steps[1].total = { before_ch: 321, after_ch: 999, excluded_ch: 0 };
    const m = construirMatrizCascada(c)!;
    expect(cuadraConElMotor(m, c)).toBe(false);
  });
});
