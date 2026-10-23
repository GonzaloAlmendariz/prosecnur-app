/**
 * La serie diaria de efectivas dice lo mismo en todas las vistas.
 *
 * Medido en Medios de Vida el 2026-10-23: Ritmo daba 16 el 04/08 y 69 en
 * total, y el chip, el calendario de Cuotas y la vista del PDF daban 17 y 70,
 * porque leían bloques distintos y una efectiva no tenía actor. Ahora todas
 * leen `serieDiariaDelCorte` (la serie por categoría, la que suma Avance ›
 * Cuotas) y la efectiva sin categoría se declara aparte.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { MonitoreoAcreditacionReports, MonitoreoState } from "../../../../../api/client";
import { chipsDeRitmo } from "./chipsDeRitmo";
import { Entregas } from "./Entregas";
import { Ritmo } from "./Ritmo";
import { efectivasPorDia, notaSinCategoria, resumenDeRitmo, serieDiariaDelCorte } from "./ritmoModel";

function reportes(bloques: Record<string, Array<Record<string, unknown>>>): MonitoreoAcreditacionReports {
  return {
    schema: "test", generated_at: "", reference_tabs: [],
    sheets: [{ id: "monitoreo_telefonico", title: "Telefónico", blocks: Object.entries(bloques).map(([id, rows]) => ({ id, title: id, columns: [], rows })) }],
  } as unknown as MonitoreoAcreditacionReports;
}

// Como Medios de Vida: el 04/08 Kobo tiene 17 efectivas y sólo 16 tienen actor.
const REPORTS = reportes({
  cuotas_variable: [{ Variable: "Actor", Valor: "Homologación de Títulos" }, { Variable: "Actor", Valor: "Vinculación Laboral" }],
  avance_efectivo_variable_dia: [
    { Variable: "Actor", Valor: "Homologación de Títulos", Fecha: "2026-08-04", "Efectivas Kobo": 12 },
    { Variable: "Actor", Valor: "Vinculación Laboral", Fecha: "2026-08-04", "Efectivas Kobo": 4 },
    { Variable: "Actor", Valor: "Homologación de Títulos", Fecha: "2026-08-05", "Efectivas Kobo": 11 },
    { Variable: "Actor", Valor: "Vinculación Laboral", Fecha: "2026-08-05", "Efectivas Kobo": 3 },
  ],
  avance_efectivo_dia: [
    { Fecha: "2026-08-04", "Efectivas Kobo": 17 },
    { Fecha: "2026-08-05", "Efectivas Kobo": 14 },
  ],
});

const STATE = { config: { objetivo_total: 100, goals: [], operational_model: { state_rules: [] } } } as unknown as MonitoreoState;

describe("la serie diaria de efectivas es una sola", () => {
  it("chip, calendario, vista del PDF y acumulado de Ritmo dan el mismo día y el mismo total", () => {
    const { serie, sinCategoria, segmento } = serieDiariaDelCorte(REPORTS);
    const dias = efectivasPorDia(REPORTS);
    const resumen = resumenDeRitmo(serie, 100);

    expect(dias).toEqual([{ fecha: "2026-08-04", casos: 16 }, { fecha: "2026-08-05", casos: 14 }]);
    expect(serie.total).toBe(30);
    expect(resumen.acumulado["2026-08-05"]).toBe(30);
    expect(chipsDeRitmo(REPORTS, STATE)[0]).toBe("Pico de 16 el 04/08");
    expect(sinCategoria).toBe(1);
    expect(notaSinCategoria(sinCategoria, segmento)).toBe("1 efectiva de Kobo sin actor no entra a la serie");

    const entregas = renderToStaticMarkup(<Entregas modelo={null} corte="" dias={dias} nota={notaSinCategoria(sinCategoria, segmento)} salidas={null} />)
      .replace(/<!-- -->/g, "");
    expect(entregas).toContain(">04/08<");
    expect(entregas).toContain(">16<");
    expect(entregas).not.toContain(">17<");
    expect(entregas).toContain("sin actor");

    const ritmo = renderToStaticMarkup(<Ritmo reports={REPORTS} state={STATE} />).replace(/<!-- -->/g, "");
    expect(ritmo).toContain("30 de 100");
    expect(ritmo).not.toContain(">17<");
    expect(ritmo).toContain("sin actor");
  });
});
