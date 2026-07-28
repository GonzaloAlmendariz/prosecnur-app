import { describe, expect, test } from "vitest";
import type { MonitoreoSource } from "../../../api/client";
import { detalleTecnico, enlaceDeFuente, nombreDeFuente, servicioDeFuente } from "./enlacesDeFuente";

// Los casos vienen del ANTES medido en `acrconta` y `acnur_acg`
// (docs/plan-fuentes-legibles-2026-07.md §1): son las fuentes reales que hoy se
// muestran como identificador pelado.

function fuente(patch: Partial<MonitoreoSource>): MonitoreoSource {
  return {
    id: "src_1",
    kind: "google_sheets",
    label: "",
    enabled: true,
    ...patch,
  };
}

describe("nombreDeFuente (R1)", () => {
  test("prefiere el título de la encuesta sobre cualquier identificador", () => {
    const source = fuente({
      kind: "surveymonkey",
      survey_id: "527327742",
      survey_title: "Acreditación Contabilidad PUCP Estudiantes",
      label: "src-sm-1",
    });
    expect(nombreDeFuente(source)).toBe("Acreditación Contabilidad PUCP Estudiantes");
  });

  test("sin nombre humano no devuelve el identificador, devuelve el tipo de fuente", () => {
    // El ANTES caía al `survey_id` y pintaba `527327742` como título.
    expect(nombreDeFuente(fuente({ kind: "surveymonkey", survey_id: "527327742" })))
      .toBe("Encuesta sin nombre");
    expect(nombreDeFuente(fuente({ kind: "kobo", asset_uid: "aXbYcZ" })))
      .toBe("Formulario Kobo sin nombre");
    expect(nombreDeFuente(fuente({ kind: "google_sheets" })))
      .toBe("Google Sheet sin nombre");
  });

  test("usa el nombre de la pestaña cuando la hoja no trae etiqueta", () => {
    const source = fuente({
      sheet_binding: {
        spreadsheet_id: "1UMlN7xVAzQOrglhMkVNSj2KQ2RgJntOh2mNbDQm5mbQ",
        sheet_name: "Estudiantes",
        header_row: 1,
        range: "",
        last_read_at: "",
        snapshot_hash: "",
      },
    });
    expect(nombreDeFuente(source)).toBe("Estudiantes");
  });
});

describe("enlaceDeFuente (R2)", () => {
  test("arma el enlace del Google Sheet desde el id pelado", () => {
    const source = fuente({
      sheet_binding: {
        spreadsheet_id: "1UMlN7xVAzQOrglhMkVNSj2KQ2RgJntOh2mNbDQm5mbQ",
        sheet_name: "Estudiantes",
        header_row: 1,
        range: "",
        last_read_at: "",
        snapshot_hash: "",
      },
    });
    const enlace = enlaceDeFuente(source);
    expect(enlace.estado).toBe("enlace");
    if (enlace.estado !== "enlace") return;
    expect(enlace.href).toBe(
      "https://docs.google.com/spreadsheets/d/1UMlN7xVAzQOrglhMkVNSj2KQ2RgJntOh2mNbDQm5mbQ/edit",
    );
    // El texto del enlace nunca es el identificador: ese es el defecto A3.
    expect(enlace.texto).toBe("Estudiantes");
    expect(enlace.texto).not.toContain("1UMlN7");
  });

  test("acepta una URL completa pegada por el usuario sin volver a envolverla", () => {
    const source = fuente({
      sheet_binding: {
        spreadsheet_id: "https://docs.google.com/spreadsheets/d/ABC123/edit#gid=0",
        sheet_name: "Barrido",
        header_row: 6,
        range: "",
        last_read_at: "",
        snapshot_hash: "",
      },
    });
    const enlace = enlaceDeFuente(source);
    expect(enlace.estado).toBe("enlace");
    if (enlace.estado !== "enlace") return;
    expect(enlace.href).toBe("https://docs.google.com/spreadsheets/d/ABC123/edit#gid=0");
  });

  test("sin spreadsheet dice qué hacer, no solo que falta", () => {
    const enlace = enlaceDeFuente(fuente({}));
    expect(enlace.estado).toBe("falta-dato");
    if (enlace.estado === "enlace") return;
    expect(enlace.mensaje).toContain("Falta el enlace del Google Sheet");
  });

  test("Kobo abre el proyecto y avisa que no es la URL de captura", () => {
    const source = fuente({
      kind: "kobo",
      asset_uid: "aXbYcZ",
      base_url: "https://kf.kobotoolbox.org/",
    });
    const enlace = enlaceDeFuente(source);
    expect(enlace.estado).toBe("enlace");
    if (enlace.estado !== "enlace") return;
    expect(enlace.href).toBe("https://kf.kobotoolbox.org/#/forms/aXbYcZ");
    expect(enlace.titulo).toContain("No es la dirección de captura");
  });

  test("SurveyMonkey no inventa una URL a partir del survey_id", () => {
    // La app solo guarda el base_url de la API, que no es navegable. Un enlace
    // adivinado que abre un 404 es peor que no ofrecer ninguno.
    const enlace = enlaceDeFuente(fuente({ kind: "surveymonkey", survey_id: "527327742" }));
    expect(enlace.estado).toBe("sin-enlace");
  });

  test("SurveyMonkey sin encuesta elegida sí es algo que el usuario resuelve", () => {
    const enlace = enlaceDeFuente(fuente({ kind: "surveymonkey" }));
    expect(enlace.estado).toBe("falta-dato");
  });
});

describe("detalleTecnico (R1)", () => {
  test("recoge los identificadores que antes ocupaban el subtítulo", () => {
    const source = fuente({
      kind: "surveymonkey",
      id: "src_sm_1",
      survey_id: "527327742",
      survey_title: "Acreditación Contabilidad PUCP Estudiantes",
    });
    const filas = detalleTecnico(source);
    expect(filas).toContainEqual({ etiqueta: "Encuesta en SurveyMonkey", valor: "527327742" });
    expect(filas).toContainEqual({ etiqueta: "Identificador interno", valor: "src_sm_1" });
  });
});

describe("servicioDeFuente", () => {
  test("nombra el servicio sin jerga de API", () => {
    expect(servicioDeFuente(fuente({ kind: "google_sheets" }))).toBe("Google Sheets");
    expect(servicioDeFuente(fuente({ kind: "kobo" }))).toBe("Kobo");
    expect(servicioDeFuente(fuente({ kind: "surveymonkey" }))).toBe("SurveyMonkey");
  });
});
