import { describe, expect, it } from "vitest";
import type { MonitoreoState, MonitoreoTerritorialDashboard } from "../../../../../api/client";
import { construirConexiones } from "./conexionesModel";

const STATE = {
  sources: [
    { id: "kobo-campo", kind: "kobo", label: "Campo", enabled: true, role: "respuestas" },
    { id: "kobo-piloto", kind: "kobo", label: "Piloto", enabled: true, role: "respuestas" },
    { id: "hoja", kind: "google_sheets", label: "Hoja de ruta", enabled: false, role: "hoja_ruta" },
  ],
  config: {
    territorial: {
      active_route_phase: "field",
      phase_sources: { field: { source_id: "kobo-campo" }, pilot: { source_id: "kobo-piloto" } },
      phase_windows: { field: { start_at: "2026-06-12T10:00:00Z" }, pilot: { start_at: "" } },
    },
  },
  territorial_phase_coherence: {
    phases: {
      field: { phase: "field", status: "source_synced_with_rows", source_applied: true, asset_name: "ACNUR Campo", local_rows: 1697, last_sync_at: "2026-07-09T12:24:00Z", source_id: "kobo-campo" },
      pilot: { phase: "pilot", status: "source_synced_with_rows", source_applied: true, asset_name: "ACNUR Piloto", local_rows: 35, last_sync_at: "2026-06-25T23:01:00Z", source_id: "kobo-piloto" },
    },
  },
  territorial_update_history: [
    { id: "1", type: "sync", source_id: "kobo-campo", response_count: 216, created_at: "2026-06-13T15:00:00Z" },
    { id: "2", type: "sync", source_id: "kobo-campo", response_count: 1697, created_at: "2026-07-09T12:24:00Z" },
    { id: "3", type: "inspect", source_id: "kobo-campo", response_count: 0, created_at: "2026-06-18T20:53:00Z" },
  ],
} as unknown as MonitoreoState;

const REPORTS = {
  source_coherence: { survey_count: 79, choices_count: 61 },
  advance: { meta: 1200 },
  route_overview: { district_count: 6, route_count: 150, replacement_count: 150 },
} as unknown as MonitoreoTerritorialDashboard;

describe("Insumos › Conexiones", () => {
  const modelo = construirConexiones(STATE, REPORTS, "field");

  it("la fuente de la fase activa dice cuántas filas trajo, cuándo y su ficha", () => {
    const campo = modelo.tarjetas[0];
    expect(campo).toMatchObject({ titulo: "Kobo · Campo", activa: true, estado: "Al día", tono: "ok", formulario: "ACNUR Campo", serie: [216, 1697] });
    expect(campo.cifras).toEqual([
      { rotulo: "Respuestas", valor: "1,697" },
      { rotulo: "Preguntas", valor: "79" },
      { rotulo: "Opciones", valor: "61" },
      { rotulo: "Última lectura", valor: "09/07 07:24" },
      { rotulo: "Ficha leída", valor: "18/06 15:53" },
      { rotulo: "Fase desde", valor: "12/06 05:00" },
    ]);
  });

  it("la fase no activa se atenúa y no muestra la ficha de la activa", () => {
    const piloto = modelo.tarjetas[1];
    expect(piloto).toMatchObject({ titulo: "Kobo · Piloto", activa: false, tono: "inactiva", estado: "Fase no activa · al día" });
    expect(piloto.cifras.map((cifra) => cifra.rotulo)).not.toContain("Preguntas");
  });

  it("la hoja de ruta de Sheets aparece si el proyecto la declara, y la muestra viene de Hojas de ruta", () => {
    expect(modelo.tarjetas.find((t) => t.clave === "hoja")).toMatchObject({ estado: "Sin conectar", tono: "inactiva" });
    expect(modelo.muestra).toEqual([
      { rotulo: "Meta", valor: "1,200" }, { rotulo: "Distritos", valor: "6" }, { rotulo: "UMP titulares", valor: "150" }, { rotulo: "Reemplazos", valor: "150" },
    ]);
    expect(modelo.ventanas).toEqual([{ fase: "Campo", desde: "12/06 05:00" }]);
    expect(modelo.conFuenteDeCampo).toBe(true);
  });

  it("con el corte de la fuente, la muestra sale del corte de avance", () => {
    const fuente = { source_coherence: { survey_count: 79 }, route_overview: {} } as unknown as MonitoreoTerritorialDashboard;
    const conAvance = construirConexiones(STATE, fuente, "field", { avance: REPORTS });
    expect(conAvance.muestra.map((cifra) => cifra.valor)).toEqual(["1,200", "6", "150", "150"]);
  });

  it("sin fuente de campo lo dice", () => {
    expect(construirConexiones(null, null, "field").conFuenteDeCampo).toBe(false);
  });
});
