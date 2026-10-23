import { describe, expect, it } from "vitest";
import type { MonitoreoSource, MonitoreoState } from "../../../../../api/client";
import { buildAcreditacionPhoneSourceContract } from "../TelefonicoSourcesModel";
import { columnasQueSeLeen, filasDeFuentes } from "./fuentesModel";

const hoja = {
  id: "barrido", kind: "google_sheets", label: "11_ACNUR_PDM_Base de barrido", enabled: true, role: "barrido",
  sheet_binding: { spreadsheet_id: "abc", sheet_name: "Barrido", range: "Barrido!A1:Y2297", row_count: 2296, header_row: 1 },
  dimensions: { sede: "sede", origen: "origen" },
  last_sync_at: "2026-07-02T20:51:00",
} as unknown as MonitoreoSource;
const kobo = {
  id: "kobo", kind: "kobo", label: "PDM", enabled: true, role: "respuestas",
  survey_title: "Post-Distribution Monitoring", sync_cursor: { fetched_count: 430 },
} as unknown as MonitoreoSource;
const apagada = { id: "listado", kind: "google_sheets", label: "Listado", enabled: false } as unknown as MonitoreoSource;

describe("Insumos › Fuentes del telefónico", () => {
  it("lista las fuentes activas primero, con su papel, volumen y detalle", () => {
    const fuentes = [apagada, kobo, hoja];
    const filas = filasDeFuentes(fuentes, buildAcreditacionPhoneSourceContract(fuentes));
    expect(filas.map((fila) => fila.id)).toEqual(["barrido", "kobo", "listado"]);
    expect(filas[0]).toMatchObject({ volumen: 2296, unidad: "filas", detalle: "pestaña Barrido, rango A1:Y2297", activa: true });
    expect(filas[0].papel).toBe("Universo y barrido");
    expect(filas[1]).toMatchObject({ volumen: 430, unidad: "envíos", papel: "Respuestas", detalle: "Post-Distribution Monitoring" });
    expect(filas[2].activa).toBe(false);
  });

  it("dice la columna declarada y deja vacío lo que se busca por nombre", () => {
    const fuentes = [hoja, kobo];
    const state = { config: { monitoreo_profile: { key_rules: { universe_fields: ["CodPulso"], response_fields: [], use_name_fallback: false, automatic_detection: true } } } } as unknown as MonitoreoState;
    const columnas = columnasQueSeLeen(buildAcreditacionPhoneSourceContract(fuentes), state);
    expect(columnas[0]).toEqual({ pieza: "Universo y barrido", dato: "Llave del caso", columna: "CodPulso", declarada: true });
    const sede = columnas.find((fila) => fila.pieza === "Universo" && fila.dato === "sede");
    expect(sede).toMatchObject({ columna: "sede", declarada: true });
    const responsable = columnas.find((fila) => fila.pieza === "Barrido" && fila.dato === "responsable");
    expect(responsable).toMatchObject({ columna: "", declarada: false });
  });
});
