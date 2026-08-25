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

describe("la pregunta por la procedencia sólo aplica a un marco que existe", () => {
  it("sin marco no hay nada cuya procedencia constar", () => {
    // La regresión: en un proyecto recién creado, con la base subida y sin
    // marco todavía, la banda decía «no consta de qué bases salió» y tapaba la
    // nota correcta, que es «sin construir · calcula elegibles». Preguntar de
    // dónde salió algo que no existe no es honestidad, es ruido.
    // En blanco el marco llega como objeto VACIO, no como null: por eso la
    // prueba de «hay marco» son sus filas de entrada, no su existencia.
    const filasDeEntradaDelMarco = 0;
    const hayFuentes = [{ role: "base_madre", file_id: "f-2026", sheet: "Data" }];
    const corresponde = marcoCorrespondeALasFuentes(null, hayFuentes);
    expect(corresponde).toBeNull();
    // La condición que consume ese `null` tiene que exigir marco.
    const procedenciaDesconocida = filasDeEntradaDelMarco > 0 && corresponde === null && hayFuentes.length > 0;
    expect(procedenciaDesconocida).toBe(false);
  });

  it("con marco sin firma y fuentes cargadas, sí se declara", () => {
    const filasDeEntradaDelMarco = 136284;
    const hayFuentes = [{ role: "base_madre", file_id: "f-2026", sheet: "Data" }];
    const corresponde = marcoCorrespondeALasFuentes(null, hayFuentes);
    const procedenciaDesconocida = filasDeEntradaDelMarco > 0 && corresponde === null && hayFuentes.length > 0;
    expect(procedenciaDesconocida).toBe(true);
  });
});
