import { describe, expect, it } from "vitest";

import { contadorDeLoQueReparte } from "./contadorDeLoQueReparte";

/**
 * Las cifras son las de HSVG2026 «como 2025», medidas contra el payload:
 * el plan tiene 1.424 cursos-horario, de los que 77 son de la reserva adicional y 174 tienen
 * meta; `course_status` viaja recortado a 500 filas.
 */
const CONTEXTO = { total: 1424, filasQueViajan: 500, deReservaAdicional: 77 };

const estado = [
  { clave: "pendiente", aulas: 0 }, { clave: "lista", aulas: 22 },
  { clave: "en_aplicacion", aulas: 0 }, { clave: "cerrando", aulas: 152 },
  { clave: "reemplazada", aulas: 18 }, { clave: "en_reserva", aulas: 1232 },
];
const cobertura = [
  { clave: "nulo", aulas: 22 }, { clave: "critico", aulas: 15 },
  { clave: "insuficiente", aulas: 26 }, { clave: "parcial", aulas: 20 },
  { clave: "satisfactorio", aulas: 15 }, { clave: "pleno", aulas: 76 },
];

describe("el contador del reparto", () => {
  it("con el reparto del plan entero dice el total, y nombra la reserva adicional", () => {
    // Los seis tramos suman 1.424, que es el universo que contiene a la reserva adicional.
    expect(contadorDeLoQueReparte(estado, CONTEXTO)).toBe("1,424 cursos-horario · 77 de la reserva adicional");
  });

  it("con un reparto de universo propio dice el suyo, no el del vecino", () => {
    // Cobertura reparte 174: los que tienen meta. Rotular 1.424 aquí era el
    // defecto; y «se ven 174 de 1,424» sería un aviso de recorte igual de
    // falso, porque a cobertura no le faltan 1.250 filas.
    expect(contadorDeLoQueReparte(cobertura, CONTEXTO)).toBe("174 cursos-horario");
  });

  it("sin reparto del motor el aviso de recorte SÍ corresponde", () => {
    // Ahí el gráfico pinta de verdad las 500 filas que viajan.
    expect(contadorDeLoQueReparte(null, CONTEXTO)).toBe("se ven 500 de 1,424 cursos-horario · 77 de la reserva adicional");
    expect(contadorDeLoQueReparte([], CONTEXTO)).toBe("se ven 500 de 1,424 cursos-horario · 77 de la reserva adicional");
  });

  it("un reparto con todo a cero se trata como ausente, no como universo de cero", () => {
    const vacio = [{ clave: "nulo", aulas: 0 }, { clave: "pleno", aulas: 0 }];
    expect(contadorDeLoQueReparte(vacio, CONTEXTO)).toBe("se ven 500 de 1,424 cursos-horario · 77 de la reserva adicional");
  });
});
