import { describe, expect, it } from "vitest";

import type { MonitoreoRow } from "../../../../api/monitoreo";
import { embudoDelAula } from "./embudoDelAula";

const parte = (a: number, r: number, d: number, e: number) => ({
  observed_students: a, refusals: r, duplicates: d, effective_surveys: e,
} as unknown as MonitoreoRow);

describe("embudoDelAula", () => {
  it("angosta paso a paso y dice cuánto se pierde en cada uno", () => {
    const e = embudoDelAula([parte(100, 10, 20, 70)]);
    expect(e.asistentes).toBe(100);
    expect(e.pasos.map((p) => p.quedan)).toEqual([100, 90, 70]);
    expect(e.pasos.map((p) => p.pierde)).toEqual([0, 10, 20]);
    expect(e.pasos.map((p) => p.pct)).toEqual([100, 90, 70]);
  });

  it("el descuadre es lo declarado menos lo que la cadena implica", () => {
    // La cadena implica 70 y el equipo escribió 68: faltan 2, y NO se corrige
    // ninguno de los dos.
    const e = embudoDelAula([parte(100, 10, 20, 68)]);
    expect(e.declaradas).toBe(68);
    expect(e.descuadre).toBe(-2);
  });

  it("suma los partes, que es donde se ve qué pesa más", () => {
    const e = embudoDelAula([parte(50, 1, 9, 40), parte(50, 9, 1, 40)]);
    expect(e.asistentes).toBe(100);
    // 10 rechazos y 10 duplicados: el conjunto los iguala aunque cada aula los
    // tenga al revés.
    expect(e.pasos[1].pierde).toBe(10);
    expect(e.pasos[2].pierde).toBe(10);
  });

  it("sin asistentes devuelve vacío en vez de dividir entre cero", () => {
    expect(embudoDelAula([parte(0, 0, 0, 0)]).pasos).toEqual([]);
  });
});
