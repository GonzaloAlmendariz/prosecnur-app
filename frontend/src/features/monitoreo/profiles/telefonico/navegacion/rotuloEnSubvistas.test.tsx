/**
 * §2a-bis, ronda 2 (2026-10-24): el rótulo de la pestaña entra también en las
 * sub-vistas (Respuestas › Salvedades, Cuotas y calendario › Calendario) y en
 * la barra de filtros de Insistencia, por el hueco que la cola común abre a su
 * izquierda (`antesDeLosFiltros`), sin superponerlo con un ancho fijo.
 */
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { MonitoreoAcreditacionReports, MonitoreoState } from "../../../../../api/client";
import { ColaDeInsistencia } from "../../../core/ColaDeInsistencia";
import { Insistencia } from "../control/Insistencia";
import { Salvedades } from "../control/Salvedades";
import { Calendario } from "../modelo/Calendario";
import { RotuloDePestanaProvider } from "./RotuloDePestana";

const VALOR = { antetitulo: "Control · Llamadas", titulo: "Insistencia", chips: [] as string[] };

function pintar(nodo: ReactNode, conRotulo = true, url = "/monitoreo?modo=telefonico") {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[url]}>
      {conRotulo ? <RotuloDePestanaProvider valor={VALOR}>{nodo}</RotuloDePestanaProvider> : nodo}
    </MemoryRouter>,
  ).replace(/<!-- -->/g, "");
}

function reportes(bloques: Record<string, Array<Record<string, unknown>>>): MonitoreoAcreditacionReports {
  return {
    schema: "test", generated_at: "2026-10-23T10:52:00", reference_tabs: [],
    sheets: [{ id: "monitoreo_telefonico", title: "Telefónico", blocks: Object.entries(bloques).map(([id, rows]) => ({ id, title: id, columns: [], rows })) }],
  } as unknown as MonitoreoAcreditacionReports;
}

const COLA = reportes({
  cola_insistencia: [
    { CodPulso: "PDM1698", Responsable: "Ana", "Sin asignar": false, Status: "No contesta", Intentos: 3, Fecha: "2026-07-02", "Observación": "", "Variable cuota": "Sede", Cuota: "SJL", efectiva_kobo: false, dias_sin_registro: 2, "Criterio cola": "Vocabulario del proyecto" },
  ],
  cola_insistencia_responsables: [
    { Responsable: "Ana", "Sin asignar": false, "Casos en cola": 1, "Ya efectivas en Kobo": 0, "Promedio intentos": 3, "Sin dato de intentos": 0, "Por llamar": 0 },
  ],
});

describe("rótulo en las sub-vistas y en Insistencia", () => {
  it("Insistencia pone el rótulo en la fila de la barra de filtros, antes de los filtros", () => {
    const html = pintar(<Insistencia reports={COLA} state={{ synced_at: "2026-07-27T09:04:00", config: { goals: [] } } as unknown as MonitoreoState} />);
    const barra = html.indexOf('class="mon-cola-barra"');
    expect(barra).toBeGreaterThan(-1);
    expect(html.indexOf("data-rotulo-de-pestana", barra)).toBeLessThan(html.indexOf("mon-cola-filtros-marco", barra));
  });

  it("la cola común sin el slot se monta igual que antes (Acreditación › Reintentos)", () => {
    const html = pintar(
      <ColaDeInsistencia casos={[]} responsables={[]} columnas={{ categoria: "Sede", telefono: false }} reparto={{ porLlamarAsignados: 0, repartidos: null, equipo: 0 }} corte="27/07" />,
      false,
    );
    expect(html).not.toContain("mon-cola-barra");
    expect(html).toMatch(/^<div class="mon-cola"[^>]*><div class="mon-cola-filtros-marco">/);
  });

  it("Salvedades encabeza su tarjeta con el rótulo, con filas y vacía (C3)", () => {
    const fila = { id: "1", fecha: "02/07", codigo: "PDM1218", responsable: "Ana", kobo: "Completa", fuente: "Kobo", hojaDice: "No barrido", queHacer: "Revisar" };
    const lleno = pintar(<Salvedades filas={[fila]} elegida="1" revisadas={424} onElegir={() => {}} detalle={null} />);
    expect(lleno.indexOf("data-rotulo-de-pestana")).toBeLessThan(lleno.indexOf("<b>Efectivas no identificables</b>"));
    expect(lleno).toContain(">PDM1218<");
    const vacio = pintar(<Salvedades filas={[]} elegida={null} revisadas={424} onElegir={() => {}} detalle={null} />);
    expect(vacio).toContain("data-rotulo-de-pestana");
    expect(vacio).toContain("Sin efectivas con salvedad");
    expect(vacio).toContain("Las 424 efectivas revisadas");
  });

  it("Calendario encabeza el cronograma con el rótulo y lee la serie compartida, sin un segundo «30 junio» de 2020", () => {
    const reports = reportes({
      cuotas_variable: [{ Variable: "Sede", Valor: "SJL", Meta: 10, "Efectivas Kobo": 5 }],
      avance_efectivo_variable_dia: [
        { Variable: "Sede", Valor: "SJL", Fecha: "2026-06-30", "Efectivas Kobo": 2 },
        { Variable: "Sede", Valor: "SJL", Fecha: "2026-07-01", "Efectivas Kobo": 3 },
      ],
      avance_efectivo_dia: [
        { Fecha: "2026-06-30", "Efectivas Kobo": 2 },
        { Fecha: "2026-07-01", "Efectivas Kobo": 3 },
      ],
      estatus_dia: [{ Estado: "No contesta", "30/06/2026": 4, "1/07/2026": 6, "30/06/2020": 3 }],
    });
    const state = { config: { strategy_phases: [], operational_model: { state_rules: [] } } } as unknown as MonitoreoState;
    const html = pintar(<Calendario state={state} reports={reports} />);
    expect(html.indexOf("data-rotulo-de-pestana")).toBeLessThan(html.indexOf("<b>Cronograma de campo</b>"));
    expect(html).toContain("Días de campo del corte");
    expect(html.match(/>30\/06</g)?.length).toBe(1);
    expect(html).toContain(">5<");
  });
});
