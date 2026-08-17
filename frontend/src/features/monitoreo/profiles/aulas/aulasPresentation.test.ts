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

describe("los vocabularios cerrados no derivan entre R y la UI", () => {
  // El motor declara vocabularios CERRADOS —los `check` de validación y los
  // estados operativos— y la UI los traduce con diccionarios a mano que nadie
  // ataba a ellos. Al añadir `valid_response_criterion` en R, la pantalla habría
  // mostrado la clave cruda sin que nada fallara; y los estados estaban
  // completos por suerte, no por construcción. Es el patrón de lista cerrada del
  // GOAL de campo, aquí entre capas.
  //
  // Se comparan las LISTAS de los dos lados, no la salida de la función: mi
  // primer intento infería «no hay entrada» de que la etiqueta coincidiera con
  // el fallback, y marcaba como ausentes los once estados cuya etiqueta correcta
  // ES la clave capitalizada. El instrumento producía el hallazgo.
  const aqui = path.dirname(fileURLToPath(import.meta.url));
  const raiz = path.join(aqui, "..", "..", "..", "..", "..", "..");
  const motor = fs.readFileSync(path.join(raiz, "api", "R", "monitoreo_aulas_universitarias.R"), "utf8");
  const fuente = fs.readFileSync(path.join(aqui, "aulasPresentation.ts"), "utf8");

  /** Claves declaradas en un diccionario `const NOMBRE: Record<...> = { ... }`. */
  function clavesDelDiccionario(nombre: string) {
    const bloque = fuente.match(new RegExp(`const ${nombre}: Record<string, string> = \\{([\\s\\S]*?)\\n\\};`));
    expect(bloque, `no se encontró el diccionario ${nombre}`).toBeTruthy();
    return new Set([...(bloque?.[1] ?? "").matchAll(/^\s{2}([a-z_]+):/gm)].map((m) => m[1]));
  }

  function literalesDe(texto: string | undefined) {
    return [...(texto ?? "").matchAll(/"([a-z_]+)"/g)].map((m) => m[1]);
  }

  it("traduce todos los checks de validación que el motor declara", () => {
    const bloque = motor.match(/check = c\(([^)]*)\)/);
    expect(bloque, "no se encontró el vector `check = c(...)` en el motor").toBeTruthy();
    const claves = literalesDe(bloque?.[1]);
    expect(claves.length).toBeGreaterThan(5);
    const etiquetadas = clavesDelDiccionario("CHECK_LABELS");
    const faltan = claves.filter((c) => !etiquetadas.has(c));
    expect(faltan, `checks del motor sin etiqueta: ${faltan.join(", ")}`).toEqual([]);
  });

  it("traduce todos los estados operativos que el motor declara", () => {
    const bloque = motor.match(/monitoreo_aulas_estados <- function\(\) \{\s*c\(([^)]*)\)/);
    expect(bloque, "no se encontró `monitoreo_aulas_estados()` en el motor").toBeTruthy();
    const estados = literalesDe(bloque?.[1]);
    expect(estados.length).toBeGreaterThan(8);
    const etiquetados = clavesDelDiccionario("STATUS_LABELS");
    const faltan = estados.filter((e) => !etiquetados.has(e));
    expect(faltan, `estados del motor sin etiqueta: ${faltan.join(", ")}`).toEqual([]);
  });
});
