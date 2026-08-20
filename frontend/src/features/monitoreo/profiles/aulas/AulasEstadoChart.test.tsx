import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AulasEstadoChart } from "./AulasEstadoChart";

/**
 * El pie de «Status de aplicación» contaba dos conjuntos distintos.
 *
 * Decía «5 de 269 cursos-horario todavía no salen a campo», y de esos 269, 70
 * eran reservas del banco que NO van a salir salvo que caiga su titular. El
 * numerador ya las excluía —sólo suma `pendiente` y `lista`— y el denominador
 * las metía: media fracción contaba una cosa y la otra media, otra. Leído de
 * corrido, decía que 264 cursos-horario ya salieron cuando fueron 194.
 */

const resumen = [
  { clave: "pendiente", aulas: 3 },
  { clave: "lista", aulas: 2 },
  { clave: "en_aplicacion", aulas: 16 },
  { clave: "cerrando", aulas: 152 },
  { clave: "reemplazada", aulas: 26 },
  { clave: "en_reserva", aulas: 70 },
];

const html = (r: typeof resumen) =>
  renderToStaticMarkup(<AulasEstadoChart filas={[]} resumen={r as never} desconocidasMotor={0} />);

describe("el pie de «Status de aplicación» usa el denominador de su numerador", () => {
  it("descuenta las reservas dormidas, que no salen a campo", () => {
    const out = html(resumen);
    // 269 - 70 = 199, no 269.
    expect(out).toContain("5 de 199");
    expect(out).not.toContain("5 de 269");
  });

  it("y dice dónde fueron a parar las que descontó", () => {
    // Si la cabecera dice 269 y el pie 199, la diferencia tiene que estar
    // nombrada o el lector la lee como aulas perdidas.
    expect(html(resumen)).toContain("70");
    expect(html(resumen)).toMatch(/reservas que esperan/);
  });

  it("sin banco, el denominador vuelve a ser el total y no sobra la frase", () => {
    const sinBanco = resumen.filter((e) => e.clave !== "en_reserva");
    const out = html(sinBanco);
    expect(out).toContain("5 de 199");
    expect(out).not.toMatch(/reservas que esperan/);
  });
});
