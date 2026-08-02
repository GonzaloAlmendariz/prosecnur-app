import { describe, expect, it } from "vitest";

import { CRITERIO_RADIOGRAFIA_STATE_COPY } from "../CriteriosRadiografiaCardDetalle";

/**
 * ADR 0057 · Los estados de error se explican en palabras del estudio.
 *
 * Estos textos aparecen **cuando algo falta**, que es justo cuando el usuario
 * menos puede permitirse descifrar vocabulario. Decían «R publicó el gate»,
 * «contrato I11», «resumen legacy», «faltan denominadores o contrafactual».
 * Un aviso escrito en jerga deja a alguien bloqueado sin saber si el problema es
 * suyo, del dato o de la app.
 */
const JERGA = [
  "gate",
  "contrato",
  "legacy",
  "contrafactual",
  "denominador",
  "engine",
  "i11",
  "v1",
  "v2",
];

describe("estados de la radiografía", () => {
  it("ninguna etiqueta ni detalle usa vocabulario de implementación", () => {
    for (const [estado, copy] of Object.entries(CRITERIO_RADIOGRAFIA_STATE_COPY)) {
      const texto = `${copy.label} ${copy.detail}`.toLowerCase();
      for (const termino of JERGA) {
        expect(texto, `${estado} · ${termino}`).not.toContain(termino);
      }
    }
  });

  it("conserva la garantía de que no se rellenan ceros", () => {
    // Es lo que hace fiable la cifra de al lado: quitar la jerga no puede
    // llevarse la promesa.
    expect(CRITERIO_RADIOGRAFIA_STATE_COPY.invalido.detail).toContain("no se rellena con ceros");
  });

  it("cada estado dice algo distinto de su etiqueta", () => {
    for (const [estado, copy] of Object.entries(CRITERIO_RADIOGRAFIA_STATE_COPY)) {
      expect(copy.detail.length, `${estado}`).toBeGreaterThan(copy.label.length);
      expect(copy.detail.toLowerCase(), `${estado}`).not.toBe(copy.label.toLowerCase());
    }
  });
});
