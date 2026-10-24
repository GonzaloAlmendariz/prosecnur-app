/**
 * Control › Insistencia con el RMS (2026-10-24). Gonzalo: «la pestaña de
 * insistencia estaba completamente rota». Con códigos proGres
 * («CGU268000420», 12 caracteres) la columna de 92 px cortaba el código por la
 * izquierda y lo montaba sobre los intentos, y la cuota larga salía con
 * elipsis («Post-pa…»). Y con el barrido sin empezar (RMS real: 800 «No
 * barrido») la cola vacía se explica, no se rompe.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { MonitoreoAcreditacionReports, MonitoreoState } from "../../../../../api/client";
import { anchoDeColumnaDeCodigo } from "../../../core/colaDeInsistencia/TablaDeCola";
import { Insistencia } from "./Insistencia";

function reportes(bloques: Record<string, Array<Record<string, unknown>>>): MonitoreoAcreditacionReports {
  return {
    schema: "test", generated_at: "2026-10-23T10:52:00", reference_tabs: [],
    sheets: [{ id: "monitoreo_telefonico", title: "Telefónico", blocks: Object.entries(bloques).map(([id, rows]) => ({ id, title: id, columns: [], rows })) }],
  } as unknown as MonitoreoAcreditacionReports;
}

const STATE = { synced_at: "2026-10-23T10:52:00", config: { goals: [] } } as unknown as MonitoreoState;

function pintar(reports: MonitoreoAcreditacionReports) {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={["/monitoreo?modo=telefonico&seccion=control&pestana=insistencia"]}>
      <Insistencia reports={reports} state={STATE} />
    </MemoryRouter>,
  ).replace(/<!-- -->/g, "");
}

const FICTICIO = reportes({
  cola_insistencia: [
    { CodPulso: "CGU268000420", Responsable: "Fabio Inventado", "Sin asignar": false, Status: "No contesta", Intentos: 5, Fecha: "2026-10-19", "Observación": "Se insistió en varias franjas", "Variable cuota": "dim_actor", Cuota: "Post-pandemia", efectiva_kobo: false, dias_sin_registro: 4, "Criterio cola": "Vocabulario del proyecto" },
    { CodPulso: "CGU268000647", Responsable: "Elena Simulada", "Sin asignar": false, Status: "No contesta", Intentos: 5, Fecha: "2026-10-18", "Observación": "", "Variable cuota": "dim_actor", Cuota: "Pre visa humanitaria", efectiva_kobo: false, dias_sin_registro: 5, "Criterio cola": "Vocabulario del proyecto" },
  ],
  cola_insistencia_responsables: [
    { Responsable: "Fabio Inventado", "Sin asignar": false, "Casos en cola": 1, "Ya efectivas en Kobo": 0, "Promedio intentos": 5, "Sin dato de intentos": 0, "Por llamar": 0 },
    { Responsable: "Elena Simulada", "Sin asignar": false, "Casos en cola": 1, "Ya efectivas en Kobo": 0, "Promedio intentos": 5, "Sin dato de intentos": 0, "Por llamar": 0 },
  ],
});

describe("Control › Insistencia con el RMS", () => {
  it("la columna del código mide lo que el código más largo", () => {
    expect(anchoDeColumnaDeCodigo([{ codigo: "PDM1698" }])).toBe("max(92px, calc(7ch + 40px))");
    expect(anchoDeColumnaDeCodigo([{ codigo: "PDM1698" }, { codigo: "CGU268000420" }])).toBe("max(92px, calc(12ch + 40px))");
    const html = pintar(FICTICIO);
    expect(html).toContain("width:max(92px, calc(12ch + 40px))");
    expect(html).toContain(">CGU268000420<");
  });

  it("la cuota sale entera, sin elipsis, y la cabecera no dice la clave del motor", () => {
    const html = pintar(FICTICIO);
    expect(html).toContain("Pre visa humanitaria");
    expect(html).not.toMatch(/>dim_actor</);
    expect(html).toContain(">Actor<");
  });

  it("con el barrido sin empezar (RMS real) la cola vacía se explica", () => {
    const html = pintar(reportes({
      cola_insistencia: [],
      cola_insistencia_responsables: [],
      no_barridos_responsable: [{ Responsable: "Sin responsable", "Casos asignados": 400, "No barridos": 400 }],
    }));
    expect(html).toContain("La cola está vacía");
    expect(html).toContain("Sin casos en la cola.");
    expect(html).not.toMatch(/undefined|NaN/);
  });
});
