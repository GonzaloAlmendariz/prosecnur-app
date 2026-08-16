import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  aulasCheckLabel,
  aulasFieldLabel,
  aulasStatusLabel,
  presentAulasRow,
  summarizeAulasValidation,
} from "./aulasPresentation";

const featureDir = path.dirname(fileURLToPath(import.meta.url));

describe("aulasPresentation", () => {
  it("presenta los campos operativos principales en español de Perú", () => {
    expect(aulasFieldLabel("titular_operational_code")).toBe("Código titular");
    expect(aulasFieldLabel("wave")).toBe("Ola");
    expect(aulasFieldLabel("respuestas_validas")).toBe("Respuestas válidas");
  });

  it("presenta los seis controles técnicos con etiquetas operativas", () => {
    expect([
      "anonymous_responses",
      "student_id_required",
      "unmapped_valid_responses",
      "duplicate_responses",
      "effective_representativity",
      "sex_faculty_quota",
    ].map(aulasCheckLabel)).toEqual([
      "Respuestas anónimas",
      "Identificador estudiantil no requerido",
      "Respuestas válidas sin curso-horario",
      "Respuestas repetidas",
      "Representatividad efectiva",
      "Cuota por sexo y facultad",
    ]);
  });

  it("traduce los estados de validación sin exponer códigos técnicos", () => {
    expect(aulasStatusLabel("ok")).toBe("Correcto");
    expect(aulasStatusLabel("review")).toBe("Revisar");
    expect(aulasStatusLabel("warning")).toBe("Advertencia");
  });

  it("presenta valores de una fila sin mutar ni renombrar sus claves", () => {
    const row = Object.freeze({
      titular_operational_code: "AULA-07",
      wave: "M1",
      respuestas_validas: 14,
      anonymous_responses: true,
      check: "anonymous_responses",
      status: "review",
      detail: "El tablero agrega por aula/collector/link. Score efectivo 100.0.",
    });

    const presented = presentAulasRow(row);

    expect(presented).not.toBe(row);
    expect(presented).toEqual({
      titular_operational_code: "AULA-07",
      wave: "M1",
      respuestas_validas: 14,
      anonymous_responses: "Sí",
      check: "Respuestas anónimas",
      status: "Revisar",
      detail: "El tablero agrega por curso-horario, origen y enlace. Puntaje efectivo 100.0.",
    });
    expect(row).toEqual({
      titular_operational_code: "AULA-07",
      wave: "M1",
      respuestas_validas: 14,
      anonymous_responses: true,
      check: "anonymous_responses",
      status: "review",
      detail: "El tablero agrega por aula/collector/link. Score efectivo 100.0.",
    });
  });

  it("resume solo estados no correctos como alertas", () => {
    expect(summarizeAulasValidation([])).toEqual({
      label: "Sin controles disponibles",
      count: 0,
    });

    expect(summarizeAulasValidation([
      { check: "anonymous_responses", status: "ok" },
      { check: "student_id_required", status: "ok" },
    ])).toEqual({ label: "Sin alertas", count: 0 });

    expect(summarizeAulasValidation([
      { check: "anonymous_responses", status: "ok" },
      { check: "duplicate_responses", status: "review" },
      { check: "sex_faculty_quota", status: "warning" },
    ])).toEqual({ label: "2 alertas", count: 2 });

    expect(summarizeAulasValidation([
      { check: "anonymous_responses", status: "" },
      { check: "student_id_required", status: "estado_nuevo" },
    ])).toEqual({ label: "2 alertas", count: 2 });
    expect(aulasStatusLabel("")).toBe("Por revisar");
  });

  it("conecta la presentación pura con las tablas y el resumen de calidad", () => {
    const page = fs.readFileSync(path.join(featureDir, "AulasMonitoreoPage.tsx"), "utf8");

    expect(page).toContain("rows.map(presentAulasRow)");
    expect(page).toContain("aulasFieldLabel(column)");
    expect(page).toContain("const summary = summarizeAulasValidation(rows)");
    expect(page).toContain("<span>{summary.label}</span>");
    expect(page).not.toMatch(/\{fmt\(rows\.length\)\} alertas/);
  });
});
