import { describe, expect, it } from "vitest";

import { seleccionComparada } from "./seleccionComparadaModel";

/**
 * **El total de la tabla y el KPI de la cabecera cuentan cosas distintas.**
 *
 * Esta tabla suma los titulares SORTEADOS; «Aulas que pide el cálculo», a diez
 * centímetros en la misma pantalla, suma lo que el diseño EXIGE por facultad.
 * Medido en HSVG2026 el 2026-08-23: «190» arriba y «Total 193» aquí.
 *
 * Los dos son correctos y su diferencia es información —los adicionales que el
 * sorteo añade donde una facultad no llegaría a su cuota—, pero sin decirlo se
 * leen como una contradicción. El KPI lo explicaba en su código; en pantalla no
 * lo decía nadie.
 */
describe("la tabla comparada dice qué cuenta su total", () => {
  it("el total suma los titulares sorteados, no lo que pide el diseño", () => {
    const sel = {
      selection: [
        { sample_role: "titular", faculty: "DERECHO", eligible_n: 30 },
        { sample_role: "titular", faculty: "DERECHO", eligible_n: 28 },
        { sample_role: "chain_reserve", faculty: "DERECHO", eligible_n: 25 },
        { sample_role: "extra_reserve_pool", faculty: "DERECHO", eligible_n: 22 },
      ],
    } as unknown as Parameters<typeof seleccionComparada>[0];
    const comp = seleccionComparada(sel, null);
    // Dos: las reservas y el banco no se visitan y no entran en este total.
    expect(comp.totales.aulasNuevas).toBe(2);
  });
});
