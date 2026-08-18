import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { estratosConAulaExtra } from "../certificacionAcciones";
import type { CalcMuestraEstrato } from "../../../../../api/calcMuestra";

// La decisión «darle un aula más» debe estar disponible en la UI y quedar
// REGISTRADA (Gonzalo: «nada puede ser manual»). El helper fija
// aulas_base_fijas = actuales + 1 en el estrato de la facultad, y el flujo
// existente (recalcular → seleccionar) la aplica.

const estrato = (label: string, extra: Partial<CalcMuestraEstrato> = {}) =>
  ({ id: label, label, N: 100, N_a: 50, N_b: 50, sub_a_label: "F", sub_b_label: "M", promedio_conglomerado: 20, tau: 0.5, ...extra }) as CalcMuestraEstrato;

describe("estratosConAulaExtra", () => {
  const estratos = [estrato("PSICOLOGÍA"), estrato("DERECHO", { aulas_base_fijas: 18 })];

  it("fija actuales+1 en la facultad objetivo y no toca las demás", () => {
    const out = estratosConAulaExtra(estratos, "PSICOLOGÍA", 7);
    expect(out?.[0].aulas_base_fijas).toBe(8);
    expect(out?.[1].aulas_base_fijas).toBe(18);
    // Inmutable: el arreglo original queda intacto.
    expect(estratos[0].aulas_base_fijas).toBeUndefined();
  });

  it("encuentra la facultad aunque la etiqueta venga con otra grafía", () => {
    const out = estratosConAulaExtra(estratos, "psicologia", 7);
    expect(out?.[0].aulas_base_fijas).toBe(8);
  });

  it("sin blanco no parchea a medias: facultad ausente o datos rotos → null", () => {
    expect(estratosConAulaExtra(estratos, "GESTIÓN", 5)).toBeNull();
    expect(estratosConAulaExtra(estratos, "PSICOLOGÍA", Number.NaN)).toBeNull();
    expect(estratosConAulaExtra([], "PSICOLOGÍA", 7)).toBeNull();
  });
});

describe("cableado de la acción", () => {
  const card = readFileSync(join(__dirname, "..", "CertificacionFacultadCard.tsx"), "utf8");
  const desk = readFileSync(join(__dirname, "..", "..", "UniversidadDesk.tsx"), "utf8");

  it("la tarjeta ofrece +1 aula en filas comprometidas y el Desk la registra", () => {
    expect(card).toMatch(/filaComprometida\(f\)/);
    expect(card).toMatch(/onAgregarAula\(f\.facultad, f\.aulas_titulares\)/);
    expect(desk).toMatch(/estratosConAulaExtra\(facultyComp\.marco\?\.estratos/);
    expect(desk).toMatch(/onComponente\(facultyComp\.id, \{ marco: \{ estratos: nuevos \} \}\)/);
    expect(desk).toMatch(/onAgregarAula=\{onAgregarAulaFacultad\}/);
  });

  it("nada queda apagado con un guard constante", () => {
    expect(card).not.toMatch(/\{\s*false\s*&&/);
  });
});
