import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AulasResumenRespuestas } from "./AulasResumenRespuestas";

/**
 * **«Todavía nada» se dice; no se calla.**
 *
 * Visto el 2026-09-20 sobre el proyecto con el que arranca CCSS Perfil 2026-II:
 * con cero respuestas este bloque devolvía `null`, el panel de fuera se montaba
 * igual, y quedaba una caja con el título «Respuestas · cuáles cuentan, y por
 * qué no cuentan las demás» y absolutamente nada debajo —120 caracteres de HTML,
 * un solo hijo—. Es lo primero que ve el coordinador el martes por la mañana,
 * antes de la primera respuesta.
 *
 * Cláusula C3: una superficie contiene su propio vacío.
 */

const cuenta = (observadas: number) => ({
  observadas, efectivas: observadas, fuera_del_operativo: 0, no_pasan_criterio: 0,
}) as never;

describe("Respuestas: el vacío es del bloque", () => {
  it("sin ninguna respuesta lo dice, en vez de dejar el panel mudo", () => {
    const html = renderToStaticMarkup(<AulasResumenRespuestas cuenta={cuenta(0)} />);
    expect(html).toContain("Todavía no ha llegado ninguna respuesta");
    // Y no inventa barras ni porcentajes de la nada.
    expect(html).not.toContain("aulas-resp-barra");
  });

  it("sin bloque del motor no se monta: no es lo mismo que un cero", () => {
    // «No hay dato» y «hay dato y vale cero» se arreglan distinto, así que no
    // pueden decir lo mismo.
    expect(renderToStaticMarkup(<AulasResumenRespuestas cuenta={null} />)).toBe("");
  });

  it("con respuestas pinta lo de siempre", () => {
    const html = renderToStaticMarkup(<AulasResumenRespuestas cuenta={cuenta(64)} />);
    expect(html).not.toContain("Todavía no ha llegado");
    expect(html).toContain("64");
  });

  it("con una facultad en foco y cero, sigue pintando su cero", () => {
    // Ahí el cero ES la respuesta de esa facultad, y ya se pintaba antes.
    const html = renderToStaticMarkup(
      <AulasResumenRespuestas cuenta={cuenta(0)} rotulo="CIENCIAS SOCIALES" />);
    expect(html).not.toContain("Todavía no ha llegado");
  });
});
