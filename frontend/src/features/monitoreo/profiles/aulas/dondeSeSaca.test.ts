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

describe("la reserva adicional de esa facultad, que la ficha necesita para no mandar al vacío", () => {
  // El bloque enumera TODAS las facultades del plan con su cero. Que una no
  // aparezca es que el estudio no publica reserva adicional, que no es lo
  // mismo que tenerla vacía, y la ficha dice una cosa distinta en cada caso.
  const banco = [
    { faculty: "Derecho", disponibles: 42 },
    { faculty: "Letras", disponibles: 0 },
  ];

  test("con extras sin usar, dice cuántos", () => {
    expect(dondeSeSaca("Derecho", plan, banco).reservaAdicionalLibre).toBe(42);
  });

  test("con la reserva adicional vacía dice cero, que NO es lo mismo que no saber", () => {
    // Es el caso de 12 de las 15 facultades de HSVG 2026. Antes la ficha
    // mandaba igual «a la reserva adicional», que ahí no tiene nada.
    expect(dondeSeSaca("Letras", plan, banco).reservaAdicionalLibre).toBe(0);
  });

  test("si el estudio no publica reserva adicional, es null y no cero", () => {
    // Sin este caso, la ficha diría «su reserva adicional está vacía» en un
    // estudio que todavía no ha llegado a tener reserva adicional: acusar de
    // escasez sin haber medido.
    expect(dondeSeSaca("Derecho", plan, []).reservaAdicionalLibre).toBeNull();
    expect(dondeSeSaca("Derecho", plan).reservaAdicionalLibre).toBeNull();
    // Y una facultad que la reserva adicional no enumera tampoco se lee como cero.
    expect(dondeSeSaca("Derecho", plan, [{ faculty: "Otra", disponibles: 5 }]).reservaAdicionalLibre).toBeNull();
  });

  test("la reserva adicional no se suma a las reservas de cadena", () => {
    // Son dos recursos con procedimiento distinto: la cadena sigue el orden del
    // sorteo y la reserva adicional se elige. Sumarlos aquí escondería cuál se
    // está gastando.
    const r = dondeSeSaca("Derecho", plan, banco);
    expect(r.reservasLibres).toBe(2);
    expect(r.reservaAdicionalLibre).toBe(42);
  });

  test("una facultad desconocida conserva su reserva adicional medida", () => {
    // La facultad puede no estar en la AGENDA y sí en la reserva adicional: la
    // agenda recorta y la reserva adicional enumera el plan entero.
    const r = dondeSeSaca("Derecho", [], banco);
    expect(r.conocida).toBe(false);
    expect(r.reservaAdicionalLibre).toBe(42);
  });
});
