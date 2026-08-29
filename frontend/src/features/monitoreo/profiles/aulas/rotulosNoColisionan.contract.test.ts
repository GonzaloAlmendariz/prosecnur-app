import { describe, expect, it } from "vitest";

import { TRAMOS_DE_APLICACION } from "./estadoDeAplicacion";
import { aulasKpis } from "./kpisDeAulas";

/**
 * Dos superficies de la misma pantalla no pueden llamar igual a dos ejes
 * distintos.
 *
 * Medido el 2026-08-29 en `avance/resumen`: la leyenda de «Status de aplicación»
 * decía **«Aplicada 0»** y la banda de KPIs, dos centímetros más arriba,
 * **«APLICADAS 48»**. Las 48 estaban en el tramo de al lado, «En cierre». El
 * tramo mal rotulado tiene la clave `en_aplicacion` y el motor lo define como
 * «tiene respuestas pero todavía NO es aplicada ni cerrada»
 * (`monitoreo_aulas_universitarias.R:1335`), o sea EN CURSO. «Aplicada» es el
 * participio de terminado.
 *
 * No es la primera vez en ese mismo array: el tramo `cerrando` se llamaba
 * «Cumple», que chocaba con el KPI «Llegaron a su meta» y con «Meta cumplida»
 * del gráfico de cobertura —tres cosas distintas con la misma palabra— y ya se
 * renombró a mano. Nada lo vigilaba, así que volvió a pasar en el tramo vecino.
 */

/** Minúsculas, sin tildes y sin la `s` del plural: «APLICADAS» y «Aplicada» chocan. */
const raiz = (s: string) =>
  s.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/s$/, "");

describe("los rótulos de tramo no chocan con los de la banda", () => {
  const kpis = ["fuentes", "agenda", "validacion", "consultas", "avance"] as const;
  const etiquetasDeBanda = new Set(
    kpis.flatMap((s) => aulasKpis(null, s as never).map((k) => raiz(k.label))),
  );

  it("la banda declara etiquetas: si no, este contrato no prueba nada", () => {
    // El control de que el fixture sirve. Con `aulasKpis(null, …)` devolviendo
    // una lista vacía, el test pasaría sin comparar nada — verde por ausencia.
    expect(etiquetasDeBanda.size).toBeGreaterThan(3);
    expect(etiquetasDeBanda.has("aplicada")).toBe(true);
  });

  it("ningún tramo de aplicación usa una palabra de la banda", () => {
    const chocan = TRAMOS_DE_APLICACION
      .filter((t) => etiquetasDeBanda.has(raiz(t.etiqueta)))
      .map((t) => `${t.etiqueta} (${t.clave})`);
    expect(chocan).toEqual([]);
  });

  it("y los tramos no se repiten entre sí", () => {
    const vistas = TRAMOS_DE_APLICACION.map((t) => raiz(t.etiqueta));
    expect(new Set(vistas).size).toBe(vistas.length);
  });
});
