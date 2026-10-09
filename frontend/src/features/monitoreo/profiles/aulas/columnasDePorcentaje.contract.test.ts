import { describe, expect, it } from "vitest";

import { COLUMNAS_DE_PORCENTAJE, FIELD_LABELS } from "./aulasPresentation";

/**
 * Una lista cerrada se traga lo que no reconoce.
 *
 * `COLUMNAS_DE_PORCENTAJE` decide qué columna se pinta como porcentaje. Es un
 * `Set` escrito a mano, y `avance_aulas_pct` y `avance_respuestas_pct` no
 * estaban en él pese a acabar en `_pct` como todas las demás. Resultado, medido
 * con `HSVG2026_sem15_como_2025.pulso` en `avance/estratos`: la columna
 * enseñaba «88.2» y «85.7» junto a «17» y «100», sin símbolo y sin decimal,
 * porque un número que no se reconoce como porcentaje se pinta crudo.
 *
 * No es la primera vez en esa misma lista: el comentario de `progress_pct` dice
 * «sin ella, "Avance" enseñaba "62.3" a secas». Se arregló una entrada y las dos
 * hermanas se quedaron fuera, sin nada que lo vigilara.
 */

describe("toda columna `_pct` se pinta como porcentaje", () => {
  const claves = Object.keys(FIELD_LABELS).filter((k) => k.endsWith("_pct"));

  it("el mapa declara columnas `_pct`: si no, este contrato no prueba nada", () => {
    // El control de que el fixture sirve. Con cero claves el test de abajo
    // pasaría sin comparar nada, que es verde por ausencia.
    expect(claves.length).toBeGreaterThan(4);
  });

  it("ninguna se queda fuera de COLUMNAS_DE_PORCENTAJE", () => {
    const fuera = claves.filter((k) => !COLUMNAS_DE_PORCENTAJE.has(k));
    expect(fuera).toEqual([]);
  });
});
