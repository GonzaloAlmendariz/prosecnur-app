import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { CalcMuestraCriteriosCascada } from "../../../../../api/calcMuestraCriteriosI18b";
import { MatrizCascadaCriterios } from "../MatrizCascadaCriterios";

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

const render = (c = cascada(), edicion = null as never) =>
  renderToStaticMarkup(<MatrizCascadaCriterios cascada={c} edicion={edicion} />);

describe("MatrizCascadaCriterios", () => {
  it("pone facultades en filas y criterios en columnas", () => {
    const html = render();
    expect(html).toContain("Ingeniería");
    expect(html).toContain("Gastronomía");
    expect(html).toContain("Matriculados");
    expect(html).toContain("Mínimo de elegibles");
  });

  it("cada celda muestra una RESTA, no un aporte", () => {
    // «Los criterios no hablan de cuántos casos agregamos, sino de cuántos
    // quitamos». Sin el signo, la cifra se lee como lo que aporta.
    const html = render();
    expect(html).toContain("−36");
    expect(html).toContain("−13");
  });

  it("la fila cierra con lo que queda y su supervivencia", () => {
    const html = render();
    // Gastronomía: 8 de 45 → 18%.
    expect(html).toContain("<b>8</b><span>18%</span>");
  });

  it("la última fila suma y es la respuesta", () => {
    const html = render();
    const tfoot = /<tfoot>([\s\S]*?)<\/tfoot>/.exec(html)?.[1] ?? "";
    expect(tfoot).toContain("Todas las facultades");
    expect(tfoot).toContain("<b>272</b>");
  });

  it("distingue «se aplicó y no quitó» de «no aplica aquí»", () => {
    // Son cosas distintas y sin marca se ven igual.
    const c = cascada();
    c.steps[0].faculties = [fac("ing", "Ingeniería", 281, 281), fac("gas", "Gastronomía", 45, 44)];
    c.steps.push({ ...c.steps[0], criterion_id: "sede", label: "Sede", applies: false,
      faculties: [fac("ing", "Ingeniería", 281, 281), fac("gas", "Gastronomía", 44, 44)] } as never);
    const html = render(c);
    expect(html).toContain("no quitó ningún curso-horario");
    expect(html).toContain("no aplica en esta facultad");
  });

  it("el estado en edición se pinta en la CELDA, no en la columna", () => {
    // ADR 0057 regla 1 · ADR 0058: pintar la columna pondría en duda filas que
    // nadie tocó.
    const html = render(cascada(), { facultadKey: "ing", criterioId: "minEligible" } as never);
    const editando = html.match(/data-estado="editando"/g) ?? [];
    expect(editando).toHaveLength(1);
    // Y Gastronomía no queda esperando nada: su embudo no se movió.
    const filas = html.split("<tr");
    const gas = filas.find((f) => f.includes("Gastronomía")) ?? "";
    expect(gas).not.toContain('data-estado="espera"');
  });

  it("la fila en edición se marca, para saber dónde estás", () => {
    const html = render(cascada(), { facultadKey: "gas", criterioId: "enrolled_total" } as never);
    expect(html).toContain("data-fila-edicion");
  });

  it("declara un descuadre en vez de esconderlo", () => {
    // Significa que algún paso no publicó todas sus facultades. Dejar al lector
    // sumando una columna que no cierra es peor que decirlo.
    const c = cascada();
    c.steps[1].total = { before_ch: 321, after_ch: 999, excluded_ch: 0 };
    expect(render(c)).toContain("no coincide con el total del motor");
  });

  it("sin cascada publicada dice qué hacer, no sólo que falta", () => {
    expect(render(null as never)).toContain("Reconstruye el marco");
  });

  it("el scroll vive en la tabla, no en la página", () => {
    expect(render()).toContain("cmv2-mtz-scroll");
  });
});

describe("MatrizCascadaCriterios · el realce del embudo vivo (G12)", () => {
  it("el primer render no marca nada como recalculado", () => {
    // Si lo hiciera, la matriz entera parpadearía al abrir y el realce dejaría
    // de significar «esto se movió».
    expect(render()).not.toContain('data-recalculado="true"');
  });

  it("estar en edición no marca recalculado", () => {
    // Confirmar un criterio no mueve ninguna cifra hasta que el marco se
    // reconstruye: marcar antes anunciaría un cambio que todavía no ocurrió.
    const html = render(cascada(), { facultadKey: "ing", criterioId: "minEligible" } as never);
    expect(html).toContain('data-estado="editando"');
    expect(html).not.toContain('data-recalculado="true"');
  });
});
