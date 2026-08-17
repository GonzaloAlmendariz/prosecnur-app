import { describe, expect, it } from "vitest";

import { controlesDeAulas } from "./AulasControles";

/**
 * Los controles de Validación se leen como avisos, no como filas de tabla.
 *
 * Lo que este guard fija: que lo que pide decisión va primero, que un estado
 * desconocido no desaparece, y que el texto pasa por la capa de presentación.
 * Ese último aserto vale porque ya falló: al pintar los controles fuera de la
 * tabla salieron a pantalla «field_report_reconciliation» y «El tablero agrega
 * por aula/collector/link», que es la jerga del motor que la traducción existe
 * para tapar.
 */

const filas = [
  { check: "anonymous_responses", status: "ok", detail: "El tablero agrega por aula/collector/link." },
  { check: "field_report_reconciliation", status: "review", detail: "CH 31 no cuadra." },
  { check: "sex_faculty_quota", status: "warning", detail: "10 celdas sexo x facultad con brecha." },
];

describe("los controles de Validación", () => {
  it("ponen delante lo que pide decisión", () => {
    const { controles } = controlesDeAulas(filas);
    expect(controles.map((c) => c.severidad)).toEqual(["revisar", "advertencia", "correcto"]);
  });

  it("cuentan cada severidad por separado", () => {
    const res = controlesDeAulas(filas);
    // Un correcto no desaparece: el gate es «verde por conformidad, no por
    // ausencia», así que se sigue viendo aunque en un renglón.
    expect([res.revisar, res.advertencias, res.correctos]).toEqual([1, 1, 1]);
  });

  it("un estado que el motor no declare no se pierde", () => {
    // Lista cerrada con salida declarada: si mañana el engine emite «bloqueante»
    // se ve como advertencia en vez de caer al grupo de los correctos.
    const { controles } = controlesDeAulas([{ check: "x", status: "bloqueante", detail: "" }]);
    expect(controles[0].severidad).toBe("advertencia");
  });

  it("el texto pasa por la capa de presentación", () => {
    const { controles } = controlesDeAulas(filas);
    const nombres = controles.map((c) => c.control);
    expect(nombres).toContain("Cuadre del parte de campo");
    expect(nombres).not.toContain("field_report_reconciliation");

    const anonimas = controles.find((c) => c.control === "Respuestas anónimas");
    expect(anonimas?.detalle).toContain("curso-horario, origen y enlace");
    expect(anonimas?.detalle).not.toContain("collector");

    const cuota = controles.find((c) => c.severidad === "advertencia");
    expect(cuota?.detalle).toContain("sexo por facultad");
    expect(cuota?.estado).toBe("Advertencia");
  });
});
