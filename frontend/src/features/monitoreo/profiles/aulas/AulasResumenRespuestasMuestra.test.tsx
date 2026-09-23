import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AulasResumenRespuestas } from "./AulasResumenRespuestas";
import type { TotalDeAvanceCuota } from "./avanceCuota";

/**
 * Gonzalo, 2026-09-23: «la información es incoherente». La tarjeta decía 171 y
 * este bloque «228 efectivas», sin nada entre las dos. El bloque ahora cierra el
 * embudo: de las efectivas, cuántas cuentan y por qué no las demás.
 */
const cuenta = { observadas: 253, efectivas: 228, fuera_del_operativo: 19, no_pasan_criterio: 6 };
const total = {
  etiqueta: "Cuota del estudio", cuota: 400, validas: 171, brecha: 229, avance: 42.8,
  avanceTexto: "42.8 %", relleno: 42.8, aria: "", fueraDeCelda: 57, descuadre: "",
  notas: ["11 sin nivel", "45 de un nivel que el diseño no mide", "1 persona que respondió dos veces"],
} as unknown as TotalDeAvanceCuota;

describe("el bloque Respuestas cierra el embudo hasta la muestra", () => {
  it("dice cuántas de las efectivas cuentan y por qué no las demás", () => {
    const html = renderToStaticMarkup(<AulasResumenRespuestas cuenta={cuenta as never} enLaMuestra={total} />);
    expect(html).toContain("<strong>171</strong> de las 228 efectivas");
    expect(html).toContain("cuentan para la muestra");
    expect(html).toContain("45 de un nivel que el diseño no mide");
  });

  it("con una facultad en foco no lo pinta: las bolsas son del estudio entero", () => {
    const html = renderToStaticMarkup(
      <AulasResumenRespuestas cuenta={cuenta as never} rotulo="ECONOMÍA" enLaMuestra={total} />);
    expect(html).not.toContain("cuentan para la muestra");
  });
});
