import { describe, expect, it } from "vitest";

import { coberturaPorAula } from "./coberturaPorAula";
import { fuenteDelMotor } from "./fuenteDelMotor.testutil";

/**
 * **Las dos listas de etiquetas del mismo tramo, atadas.**
 *
 * El gráfico de cobertura usa la etiqueta que publica el motor cuando el payload
 * la trae, y la local como respaldo cuando calcula sin él. `AulasCoberturaChart`
 * ya lo advierte: «con dos redacciones vivas, la del gráfico y la del motor, la
 * pantalla acabaría diciendo dos cosas del mismo tramo **y ningún test lo
 * vería**».
 *
 * Eso era exacto: el respaldo se quedó en vocabulario técnico —«Crítico»,
 * «Insuficiente», «Satisfactorio»— mientras el motor ya publicaba el llano
 * —«Muy por debajo», «Se quedó a medias», «Casi llegó»—, así que la misma escala
 * se leía de dos maneras según el estado del proyecto.
 *
 * Este guard es el test que faltaba. Lee `monitoreo_aulas_etiquetas.R` porque la
 * lista canónica vive allí: copiarla aquí sería crear la tercera.
 */
const R = new URL("../../../../../../api/R/monitoreo_aulas_etiquetas.R", import.meta.url);

function etiquetasDelMotor(): Map<string, string> {
  const fuente = fuenteDelMotor(R);
  const bloque = fuente.slice(fuente.indexOf("monitoreo_aulas_etiqueta_tramo"));
  const mapa = new Map<string, string>();
  for (const m of bloque.matchAll(/^\s{4}(\w+)\s*=\s*"([^"]+)"/gm)) mapa.set(m[1], m[2]);
  return mapa;
}

describe("la etiqueta de cada tramo de cobertura es la misma en los dos lados", () => {
  it("el motor declara los seis tramos", () => {
    // Control de fixture: si el parseo fallara, el test de abajo pasaría con un
    // mapa vacío y no ataría nada.
    const motor = etiquetasDelMotor();
    expect([...motor.keys()].sort()).toEqual(
      ["critico", "insuficiente", "nulo", "parcial", "pleno", "satisfactorio"],
    );
  });

  it("y el respaldo del frontend dice exactamente lo mismo", () => {
    const motor = etiquetasDelMotor();
    const desajustes = coberturaPorAula([]).tramos
      .filter((t) => motor.has(t.clave) && motor.get(t.clave) !== t.etiqueta)
      .map((t) => `${t.clave}: motor «${motor.get(t.clave)}» vs frontend «${t.etiqueta}»`);
    expect(
      desajustes,
      `la misma escala se leería de dos maneras según el estado del proyecto:\n${desajustes.join("\n")}`,
    ).toEqual([]);
  });
});
