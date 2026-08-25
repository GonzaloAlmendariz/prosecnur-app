import { describe, expect, it } from "vitest";

import { marcoCorrespondeALasFuentes } from "./frame";

/**
 * El caso real: se subieron las bases 2026 por la UI y la cabecera siguió
 * mostrando el universo del marco 2025 rotulado «marco vigente».
 */
describe("el marco sabe si corresponde a las fuentes cargadas", () => {
  const firma2025 = { base_madre: { file_id: "f-2025", sheet: "MATRICULADO" } };

  it("con las mismas fuentes, corresponde", () => {
    expect(marcoCorrespondeALasFuentes(firma2025, [
      { role: "base_madre", file_id: "f-2025", sheet: "MATRICULADO" },
    ])).toBe(true);
  });

  it("con otro archivo, NO corresponde", () => {
    expect(marcoCorrespondeALasFuentes(firma2025, [
      { role: "base_madre", file_id: "f-2026", sheet: "Data" },
    ])).toBe(false);
  });

  it("mismo archivo y otra hoja tampoco corresponde", () => {
    // MATRICULADO y CURSO Y HORARIO viven en el mismo Excel y son insumos
    // distintos: si la hoja no contara, cambiarla pasaría inadvertida.
    expect(marcoCorrespondeALasFuentes(firma2025, [
      { role: "base_madre", file_id: "f-2025", sheet: "CURSO Y HORARIO" },
    ])).toBe(false);
  });

  it("añadir un catálogo que el marco no usó es desfase", () => {
    expect(marcoCorrespondeALasFuentes(firma2025, [
      { role: "base_madre", file_id: "f-2025", sheet: "MATRICULADO" },
      { role: "catalogo_curso_horario", file_id: "f-cat", sheet: "Data" },
    ])).toBe(false);
  });

  it("un rol que el marco usó y ya no está cargado es desfase", () => {
    expect(marcoCorrespondeALasFuentes(firma2025, [])).toBe(false);
  });

  it("sin firma devuelve null, que NO es «está al día»", () => {
    // Un marco de un proyecto anterior a este contrato no puede afirmar nada.
    // Devolver `false` lo marcaría desfasado sin motivo; devolver `true` sería
    // el verde por ausencia que este loop lleva persiguiendo.
    expect(marcoCorrespondeALasFuentes(null, [{ role: "base_madre", file_id: "f" }])).toBeNull();
    expect(marcoCorrespondeALasFuentes({}, [{ role: "base_madre", file_id: "f" }])).toBeNull();
  });
});
