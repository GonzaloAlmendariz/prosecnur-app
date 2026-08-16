/**
 * H1/ADR 0060 · Una tasa que sólo se conoce por intervalo no se dibuja como un punto.
 *
 * La asistencia de elegibles no se observa: se acota. El techo sale de
 * `asistentes − no_elegibles`, y `no_elegibles` son los DETECTADOS —si el
 * screening fue parcial, sobran ajenos en el numerador—; el suelo son las
 * efectivas, gente que seguro estuvo, era del estudio y respondió.
 *
 * El motor publica las dos cotas desde el ADR 0060. La barra pintaba sólo el
 * techo, con la misma forma que una tasa observada, así que un rango ancho y
 * una medición exacta se leían igual.
 *
 * Lo que estos tests fijan es cuándo la barra CAMBIA de forma y cuándo no: el
 * riesgo real es que un intervalo degenerado o ausente dibuje un tramado que
 * insinúe incertidumbre donde no la hay.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BarraTasa } from "../PrimitivasGrafico";

function pintar(props: Partial<Parameters<typeof BarraTasa>[0]> = {}) {
  return renderToStaticMarkup(
    <BarraTasa label="Asistencia" valor={0.87} tono="asistencia" {...props} />,
  );
}

describe("BarraTasa · cantidad conocida por intervalo", () => {
  it("con las dos cotas escribe un rango y marca el tramo cierto", () => {
    const html = pintar({ cotaInferior: 0.62 });

    expect(html).toContain('data-intervalo="true"');
    // La cifra es el rango, no el techo suelto.
    expect(html).toContain("62%–87%");
    // Y el tramo sólido llega a la cota inferior, no al valor.
    expect(html).toContain("cmv2-graf-tasa-cierto");
    expect(html).toMatch(/cmv2-graf-tasa-cierto[^>]*width:\s*62%/);
  });

  it("sin cota es exactamente la barra de siempre", () => {
    // Contrato aditivo: el resto de las barras del módulo no cambian.
    const html = pintar();
    expect(html).not.toContain("data-intervalo");
    expect(html).not.toContain("cmv2-graf-tasa-cierto");
    expect(html).toContain("87%");
  });

  it("una cota nula no convierte la barra en intervalo", () => {
    // Sin glosario la asistencia es bruta y el intervalo no es computable: el
    // motor manda null y la barra no puede insinuar incertidumbre.
    expect(pintar({ cotaInferior: null })).not.toContain("data-intervalo");
  });

  it("un intervalo degenerado se dibuja como punto", () => {
    // min == max: la cantidad SÍ se conoce. Un tramado de ancho cero sería
    // ruido visual que sugiere una duda inexistente.
    expect(pintar({ cotaInferior: 0.87 })).not.toContain("data-intervalo");
  });

  it("una cota mayor que el valor no invierte la barra", () => {
    // Payload imposible (el suelo por encima del techo). La barra degrada a
    // punto en vez de dibujar un tramo cierto que desborda su propio track.
    const html = pintar({ cotaInferior: 0.95 });
    expect(html).not.toContain("data-intervalo");
    expect(html).not.toContain("cmv2-graf-tasa-cierto");
  });

  it("con valor nulo no hay intervalo que dibujar", () => {
    // ADR 0060: la tasa viaja null en el desborde (residual negativo). No hay
    // techo, así que tampoco hay rango.
    const html = pintar({ valor: null, cotaInferior: 0.62 });
    expect(html).not.toContain("data-intervalo");
  });
});
