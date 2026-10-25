import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { MonitoreoAcreditacionReports, MonitoreoSource, MonitoreoState } from "../../../../../../api/client";
import { chipsDeReintentos, plataformaDeRespuestas, Reintentos } from "./Reintentos";

const FILAS = [
  { CodPulso: "1220", Responsable: "Responsable 1", "Sin asignar": false, Status: "No contesta", Intentos: "7", Fecha: "2026-06-15", "Observación": "no contesta", "Variable cuota": "Público", Cuota: "Egresados", efectiva_kobo: false, dias_sin_registro: "", "Criterio cola": "motor" },
  { CodPulso: "1305", Responsable: "Responsable 2", "Sin asignar": false, Status: "Apagado", Intentos: "5", Fecha: "2026-06-12", "Observación": "", "Variable cuota": "Público", Cuota: "Egresados", efectiva_kobo: "TRUE", dias_sin_registro: "", "Criterio cola": "motor" },
];

function corte(conCola: boolean): MonitoreoAcreditacionReports {
  return {
    schema: "test", generated_at: "2026-07-23T18:09:00", reference_tabs: [],
    sheets: [{
      id: "monitoreo_telefonico", title: "Telefónico",
      blocks: conCola
        ? [
          { id: "cola_insistencia", title: "Cola", columns: [], rows: FILAS },
          { id: "cola_insistencia_responsables", title: "Resp", columns: [], rows: [
            { Responsable: "Responsable 1", "Sin asignar": false, "Casos en cola": 1, "Ya efectivas en Kobo": 0, "Promedio intentos": 7, "Sin dato de intentos": 0, "Por llamar": 0 },
            { Responsable: "Responsable 2", "Sin asignar": false, "Casos en cola": 1, "Ya efectivas en Kobo": 1, "Promedio intentos": 5, "Sin dato de intentos": 0, "Por llamar": 0 },
          ] },
        ]
        : [{ id: "resumen_telefonico", title: "Resumen", columns: [], rows: [] }],
    }],
  } as unknown as MonitoreoAcreditacionReports;
}

const fuente = (kind: string, role = "respuestas") => ({ id: kind, kind, role, enabled: true }) as unknown as MonitoreoSource;

describe("Control › Reintentos de acreditación", () => {
  it("rotula la efectiva con la plataforma de las respuestas del estudio", () => {
    expect(plataformaDeRespuestas([fuente("surveymonkey"), fuente("google_sheets", "universo")])).toBe("SurveyMonkey");
    expect(plataformaDeRespuestas([fuente("surveymonkey"), fuente("kobo")])).toBe("la encuesta");
    expect(chipsDeReintentos(corte(true), "SurveyMonkey")).toEqual(["2 casos en la cola", "1 ya es efectiva en SurveyMonkey"]);
  });

  it("monta la cola común sin decir Kobo ni claves crudas", () => {
    const state = { synced_at: "2026-07-23T18:09:00", sources: [fuente("surveymonkey")] } as unknown as MonitoreoState;
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/monitoreo?modo=acreditacion&seccion=control&pestana=reintentos"]}>
        <Reintentos reports={corte(true)} state={state} />
      </MemoryRouter>,
    );
    expect(html).toContain("1220");
    expect(html).toContain("SurveyMonkey");
    expect(html).not.toContain("Kobo");
    expect(html).not.toMatch(/>[a-z0-9]+(_[a-z0-9]+)+</);
  });

  it("un corte sin la cola invita a actualizar con el vacío del sistema, dentro de su tarjeta", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter><Reintentos reports={corte(false)} state={null} /></MemoryRouter>,
    );
    expect(html).toContain("pulso-estado-vacio");
    expect(html).toContain("acr-av-panel");
  });
});
