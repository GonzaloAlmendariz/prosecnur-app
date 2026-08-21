import { describe, expect, test } from "vitest";

import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { dondeSeSaca } from "./dondeSeSaca";
import { colchonPorFacultad } from "./consumoDeCadena";

const fila = (f: Partial<MonitoreoAulasPlanRow>) => f as MonitoreoAulasPlanRow;

const plan = [
  fila({ operational_code: "CH 1", faculty: "Derecho", sample_role: "titular" }),
  fila({ operational_code: "CH 1-R1", faculty: "Derecho", sample_role: "chain_reserve", titular_operational_code: "CH 1", sample_status: "en_reserva" }),
  fila({ operational_code: "CH 1-R2", faculty: "Derecho", sample_role: "chain_reserve", titular_operational_code: "CH 1", sample_status: "en_reserva" }),
  fila({ operational_code: "CH 7", faculty: "Letras", sample_role: "titular" }),
];

describe("de dónde se saca lo que faltó", () => {
  test("cuenta las reservas de SU facultad, no las del operativo", () => {
    // La cuota es por facultad: las dos reservas de Derecho no le sirven a
    // Letras por muchas que sean.
    const derecho = dondeSeSaca("Derecho", plan);
    const letras = dondeSeSaca("Letras", plan);
    expect(derecho.conocida).toBe(true);
    expect(derecho.reservasLibres).toBe(2);
    expect(letras.reservasLibres).toBe(0);
  });

  test("usa el mismo cálculo que el panel del colchón, no una copia", () => {
    // Si fueran dos cuentas, se separarían en la peor forma: la ficha diría que
    // hay de dónde sacar y el panel de al lado que no.
    const delPanel = colchonPorFacultad(plan).find((f) => f.facultad === "Derecho");
    // Con las dos en cero, este aserto pasaria sin comprobar nada: el caso
    // tiene que traer reservas de verdad.
    expect(delPanel?.libres).toBeGreaterThan(0);
    expect(dondeSeSaca("Derecho", plan).reservasLibres).toBe(delPanel?.libres);
  });

  test("una facultad que no está en el plan se declara desconocida", () => {
    const r = dondeSeSaca("Inventada", plan);
    expect(r.conocida).toBe(false);
    expect(r.reservasLibres).toBe(0);
  });

  test("sin facultad no se inventa un recuento", () => {
    expect(dondeSeSaca("", plan).conocida).toBe(false);
    expect(dondeSeSaca("   ", plan).conocida).toBe(false);
  });

  test("el nombre de la facultad se compara sin distinguir mayúsculas", () => {
    expect(dondeSeSaca("derecho", plan).reservasLibres).toBe(2);
  });
});
