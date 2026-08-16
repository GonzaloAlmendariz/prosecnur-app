/**
 * H1/ADR 0060 · Cuándo la asistencia del agregado se declara intervalo.
 *
 * El riesgo que cubren estos tests no es dejar de mostrar el rango: es
 * **afirmarlo donde no lo hay**. Un «62 %–87 %» dibujado sobre dos tasas que no
 * acotan la misma cantidad es peor que el techo suelto de antes, porque parece
 * más riguroso y no lo es.
 */
import { describe, expect, it } from "vitest";
import { asistenciaEsAcotada } from "../asistenciaAcotada";

const BASE = { asistencia: 0.87, rendimiento: 0.62, conGlosario: true };

describe("asistenciaEsAcotada", () => {
  it("con glosario y el suelo por debajo del techo, es un intervalo", () => {
    expect(asistenciaEsAcotada(BASE)).toBe(true);
  });

  it("sin glosario no hay intervalo aunque las dos cifras existan", () => {
    // El caso que más importa: sin glosario «Asistencia» es la bruta sobre
    // matriculados y «Rendimiento» no la acota. Son dos cantidades distintas, y
    // presentarlas como extremos de una sola sería inventar una relación.
    expect(asistenciaEsAcotada({ ...BASE, conGlosario: false })).toBe(false);
  });

  it("media cota no es un rango", () => {
    // ADR 0060: con el desborde la tasa viaja null y la marca lo divulga.
    expect(asistenciaEsAcotada({ ...BASE, asistencia: null })).toBe(false);
    expect(asistenciaEsAcotada({ ...BASE, rendimiento: null })).toBe(false);
  });

  it("cotas iguales significan que la cantidad se conoce", () => {
    // No se acota: se sabe. Dibujar «87 %–87 %» insinuaría una duda inexistente.
    expect(asistenciaEsAcotada({ ...BASE, rendimiento: 0.87 })).toBe(false);
  });

  it("un suelo por encima del techo no se dibuja invertido", () => {
    // Payload sucio. Degradar a punto es la única salida honesta: el rango
    // invertido se leería como un intervalo válido y ancho.
    expect(asistenciaEsAcotada({ ...BASE, rendimiento: 0.95 })).toBe(false);
  });

  it("valores no finitos se descartan", () => {
    expect(asistenciaEsAcotada({ ...BASE, asistencia: Number.NaN })).toBe(false);
    expect(asistenciaEsAcotada({ ...BASE, rendimiento: Number.POSITIVE_INFINITY })).toBe(false);
  });

  it("un intervalo pegado al cero sigue siendo intervalo", () => {
    // Guard contra un `if (!rendimiento)` en vez de una comparación con null:
    // un suelo de 0 % es una cota legítima (ninguna encuesta completa todavía).
    expect(asistenciaEsAcotada({ asistencia: 0.4, rendimiento: 0, conGlosario: true })).toBe(true);
  });
});
