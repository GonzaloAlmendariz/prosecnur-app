import { describe, expect, it } from "vitest";

import { evidenciaPorCategoria } from "../evidenciaPorCategoria";
import type { CriterioRadiografiaCard } from "../../marco/criteriosRadiografiaModel";

/**
 * ADR 0057 · La categoría se decide con su distribución delante.
 *
 * El join tiene una trampa con historia en este módulo: cruzar sólo por segmento
 * arrastra la distribución de otra facultad a la tarjeta abierta. Aquí se fija
 * que el par (facultad, segmento) manda.
 */
function card(): CriterioRadiografiaCard {
  return {
    cardId: "modality",
    entries: [
      {
        rows: [
          {
            faculty_key: "derecho",
            faculty_label: "Derecho",
            segment_key: "presencial",
            actual: { n_ch: 40, n_estudiantes_unicos: 900, distribution: { media: 22, p25: 15, p50: 20 } },
            contraste_total: { n_ch: 60 },
          },
          {
            faculty_key: "ing",
            faculty_label: "Ingeniería",
            segment_key: "presencial",
            actual: { n_ch: 5, n_estudiantes_unicos: 80, distribution: { media: 99, p25: 90, p50: 95 } },
            contraste_total: { n_ch: 9 },
          },
        ],
      },
    ],
  } as unknown as CriterioRadiografiaCard;
}

describe("evidenciaPorCategoria", () => {
  it("trae la fila de LA facultad abierta, no la de otra con el mismo segmento", () => {
    const buscar = evidenciaPorCategoria(card(), "derecho", 0.7);
    const dato = buscar("presencial");
    expect(dato?.ch).toBe(40);
    expect(dato?.elegibles).toBe(900);
    expect(dato?.distribucion?.media).toBe(22);
    // Si el join cruzara sólo por segmento, aquí vendría 99 —la media de
    // Ingeniería— dentro de la tarjeta de Derecho.
    expect(dato?.distribucion?.media).not.toBe(99);
  });

  it("acepta también la etiqueta de facultad como clave", () => {
    expect(evidenciaPorCategoria(card(), "Ingeniería")("presencial")?.ch).toBe(5);
  });

  it("propaga la tasa de asistencia recibida y no la inventa", () => {
    expect(evidenciaPorCategoria(card(), "derecho", 0.7)("presencial")?.tasaAsistencia).toBe(0.7);
    expect(evidenciaPorCategoria(card(), "derecho")("presencial")?.tasaAsistencia).toBeNull();
  });

  it("sin fila para la categoría devuelve null en vez de un dato vacío", () => {
    expect(evidenciaPorCategoria(card(), "derecho")("virtual")).toBeNull();
    expect(evidenciaPorCategoria(null, "derecho")("presencial")).toBeNull();
  });
});
