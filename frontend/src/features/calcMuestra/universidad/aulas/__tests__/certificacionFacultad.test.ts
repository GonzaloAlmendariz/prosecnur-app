import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { normalizeCalcMuestraCertificacionFacultad } from "../../../../../api/calcMuestra";

// La certificación por facultad (Gonzalo: «la selección de aulas tiene que
// certificarse de esa forma») la deriva el motor al servir; la UI solo
// normaliza y muestra. Estos tests fijan el contrato del normalizador y el
// montaje de la tarjeta en Selección.

const CRUDO = {
  schema: "calc_muestra_aulas_certificacion_facultad_v1",
  tasa_esperada: [0.7038],
  certificadas: [14],
  evaluables: [15],
  total: [15],
  ok: [false],
  filas: [
    {
      faculty_key: ["derecho"], facultad: ["DERECHO"], cuota: [347],
      aulas_titulares: [18], elegibles_titulares: [664],
      efectivas_esperadas: [467], margen: [1.35], estado: ["certificada"],
      aviso: ["Sus 18 titulares cargan 664 elegibles…"],
    },
    {
      faculty_key: ["psicologia"], facultad: ["PSICOLOGÍA"], cuota: [79],
      aulas_titulares: [5], elegibles_titulares: [90],
      efectivas_esperadas: [63], margen: [0.8], estado: ["no_cubre"],
      aviso: ["NO CUBRE: faltan 16."],
      sexo: [
        { sexo: ["F"], cuota: [58], elegibles: [60], esperadas: [42], margen: [0.72], cubre: [false] },
        { sexo: ["M"], cuota: [21], elegibles: [30], esperadas: [21], margen: [1.0], cubre: [true] },
      ],
    },
  ],
};

describe("normalizeCalcMuestraCertificacionFacultad", () => {
  it("desenboxa los escalares de Plumber y conserva estados y avisos", () => {
    const c = normalizeCalcMuestraCertificacionFacultad(CRUDO);
    expect(c).not.toBeNull();
    expect(c?.tasa_esperada).toBe(0.7038);
    expect(c?.certificadas).toBe(14);
    expect(c?.ok).toBe(false);
    expect(c?.filas[1]).toMatchObject({ estado: "no_cubre", margen: 0.8 });
    expect(c?.filas[1].aviso).toContain("faltan 16");
    // Celdas de sexo: desenboxadas, con cubre booleano y sin degradar a 0.
    expect(c?.filas[1].sexo).toHaveLength(2);
    expect(c?.filas[1].sexo[0]).toMatchObject({ sexo: "F", cubre: false, margen: 0.72 });
    expect(c?.filas[0].sexo).toEqual([]);
  });

  it("un schema ajeno o sin filas degrada a null, no a una tarjeta vacía", () => {
    expect(normalizeCalcMuestraCertificacionFacultad({ schema: "otro" })).toBeNull();
    expect(normalizeCalcMuestraCertificacionFacultad({ ...CRUDO, filas: [] })).toBeNull();
    expect(normalizeCalcMuestraCertificacionFacultad(null)).toBeNull();
  });

  it("NA de R no degrada a 0: cuota ausente viaja null", () => {
    const c = normalizeCalcMuestraCertificacionFacultad({
      ...CRUDO,
      filas: [{ facultad: ["X"], estado: ["sin_cuota"], cuota: ["NA"], aulas_titulares: [2], aviso: [""] }],
    });
    expect(c?.filas[0].cuota).toBeNull();
  });
});

describe("montaje en Selección", () => {
  const tab = readFileSync(join(__dirname, "..", "AulasSeleccionTab.tsx"), "utf8");
  const desk = readFileSync(join(__dirname, "..", "..", "UniversidadDesk.tsx"), "utf8");

  it("la tarjeta se monta con la certificación normalizada del Desk", () => {
    expect(tab).toContain('from "./CertificacionFacultadCard"');
    expect(tab).toMatch(/<CertificacionFacultadCard certificacion=\{certificacion\}/);
    expect(desk).toMatch(/normalizeCalcMuestraCertificacionFacultad\(/);
    expect(desk).toMatch(/certificacion=\{certificacionFacultad\}/);
  });

  it("ningún montaje queda apagado con un guard constante", () => {
    expect(tab).not.toMatch(/\{\s*false\s*&&/);
  });
});
