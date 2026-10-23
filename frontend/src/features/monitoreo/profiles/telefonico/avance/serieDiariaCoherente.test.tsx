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
import { efectivasPorDia, notaDeLaSerie, notaDeValidasTelefonica, notaSinCategoria, resumenDeRitmo, serieDiariaDelCorte } from "./ritmoModel";
import { MonitoreoOutputsReadiness } from "../../../salidas/MonitoreoOutputsReadiness";
import { MemoryRouter } from "react-router-dom";
import { phoneQuotaCardsForDashboard } from "../TelefonicoMonitoreoPage";
import { fechaDeColumna } from "../control/barridoModel";

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

  it("las salidas explican por qué «Válidas» cuenta una más", () => {
    expect(notaDeValidasTelefonica(REPORTS)).toBe("30 con cuota y 1 sin actor");
    const sinDiferencia = reportes({ avance_efectivo_dia: [{ Fecha: "2026-08-04", "Efectivas Kobo": 3 }] });
    expect(notaDeValidasTelefonica(sinDiferencia)).toBeUndefined();
    const corte = { ingesta: 40, procesable: 35, oficial: 31, meta: 100, metaEtiqueta: "meta", saltos: [], hasSnapshot: true } as unknown as Parameters<typeof MonitoreoOutputsReadiness>[0]["corte"];
    const readiness = { estado: "listo", puedePublicarCliente: true, bloqueos: [] } as unknown as Parameters<typeof MonitoreoOutputsReadiness>[0]["readiness"];
    const con = renderToStaticMarkup(<MemoryRouter><MonitoreoOutputsReadiness corte={corte} readiness={readiness} notaDeValidas="30 con actor y 1 sin actor" /></MemoryRouter>);
    const sin = renderToStaticMarkup(<MemoryRouter><MonitoreoOutputsReadiness corte={corte} readiness={readiness} /></MemoryRouter>);
    expect(con).toContain("30 con actor y 1 sin actor");
    expect(sin).not.toContain("mon-outputs-readiness__nota");
  });

  it("un valor del eje sin cuota no entra a la serie y se declara aparte", () => {
    const conSinDato = reportes({
      cuotas_variable: [{ Variable: "Actor", Valor: "Homologación de Títulos" }, { Variable: "Actor", Valor: "Vinculación Laboral" }],
      avance_efectivo_variable_dia: [
        { Variable: "Actor", Valor: "Homologación de Títulos", Fecha: "2026-08-04", "Efectivas Kobo": 12 },
        { Variable: "Actor", Valor: "Vinculación Laboral", Fecha: "2026-08-04", "Efectivas Kobo": 4 },
        { Variable: "Actor", Valor: "Sin dato", Fecha: "2026-08-04", "Efectivas Kobo": 2 },
      ],
      avance_efectivo_dia: [{ Fecha: "2026-08-04", "Efectivas Kobo": 19 }],
    });
    const { serie, sinCategoria, fueraDeCuota } = serieDiariaDelCorte(conSinDato);
    expect(serie.total).toBe(16);
    expect(serie.categorias.map((categoria) => categoria.nombre)).not.toContain("Sin dato");
    expect(fueraDeCuota).toEqual([{ nombre: "Sin dato", casos: 2 }]);
    expect(sinCategoria).toBe(1);
    expect(efectivasPorDia(conSinDato)).toEqual([{ fecha: "2026-08-04", casos: 16 }]);
    expect(chipsDeRitmo(conSinDato, STATE)[0]).toBe("Pico de 16 el 04/08");
    expect(notaDeLaSerie(conSinDato)).toBe("No entran a la serie: 1 efectiva de Kobo sin actor y 2 en «Sin dato», que no tiene cuota");
    expect(notaDeValidasTelefonica(conSinDato)).toBe("16 con cuota, 2 en actor sin cuota y 1 sin actor");
  });

  it("con efectivas sin fecha y de valores sin cuota, los sumandos cuadran con «Válidas» y la serie es la del diario de Cuotas", () => {
    const corte = reportes({
      cuotas_variable: [
        { Variable: "Actor", Valor: "Homologación de Títulos", Universo: 156, Meta: 80, Efectivas: 23 },
        { Variable: "Actor", Valor: "Vinculación Laboral", Universo: 27, Meta: 20, Efectivas: 7 },
      ],
      avance_efectivo_variable_dia: [
        { Variable: "Actor", Valor: "Homologación de Títulos", Fecha: "2026-08-04", "Efectivas Kobo": 12 },
        { Variable: "Actor", Valor: "Vinculación Laboral", Fecha: "2026-08-04", "Efectivas Kobo": 4 },
        { Variable: "Actor", Valor: "Homologación de Títulos", Fecha: "2026-08-05", "Efectivas Kobo": 11 },
        { Variable: "Actor", Valor: "Vinculación Laboral", Fecha: "2026-08-05", "Efectivas Kobo": 3 },
        // Un valor sin cuota, con fecha y sin ella.
        { Variable: "Actor", Valor: "Sin dato", Fecha: "2026-08-05", "Efectivas Kobo": 2 },
        { Variable: "Actor", Valor: "Sin dato", Fecha: "Sin fecha", "Efectivas Kobo": 1 },
      ],
      avance_efectivo_dia: [
        { Fecha: "2026-08-04", "Efectivas Kobo": 17 },
        { Fecha: "2026-08-05", "Efectivas Kobo": 16 },
        { Fecha: "Sin fecha", "Efectivas Kobo": 4 },
      ],
    });
    const { serie, sinFecha, sinCategoria, fueraDeCuota, totalDeKobo } = serieDiariaDelCorte(corte);
    const fuera = fueraDeCuota.reduce((suma, item) => suma + item.casos, 0);
    expect(fueraDeCuota).toEqual([{ nombre: "Sin dato", casos: 3 }]);
    expect(serie.total + sinFecha + fuera + sinCategoria).toBe(totalDeKobo);
    expect(totalDeKobo).toBe(37);

    // La serie compartida es la del diario de Avance › Cuotas (phoneQuotaCardsForDashboard).
    const diarioDeCuotas = new Map<string, number>();
    phoneQuotaCardsForDashboard(corte).forEach((card) => card.dailyPoints.forEach((punto) => {
      const iso = fechaDeColumna(String(punto.date)) ?? String(punto.date);
      diarioDeCuotas.set(iso, (diarioDeCuotas.get(iso) ?? 0) + punto.effective);
    }));
    const deLaSerie = new Map(efectivasPorDia(corte).map((dia) => [dia.fecha, dia.casos]));
    expect(deLaSerie).toEqual(diarioDeCuotas);
  });
});
