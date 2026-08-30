import { describe, expect, it } from "vitest";

import { TRAMOS_DE_APLICACION } from "./estadoDeAplicacion";
import { aulasKpis } from "./kpisDeAulas";
import { FIELD_LABELS } from "./aulasPresentation";

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
    expect(etiquetasDeBanda.has("cursos-horario aplicado")).toBe(true);
  });

  /**
   * **Aviso de alcance, para que no pase inadvertido.**
   *
   * El KPI se llamaba «Aplicadas» a secas y la comparación de arriba es de
   * cadena completa, así que mientras duró ese rótulo el guard impedía además
   * que un tramo se llamase «Aplicada» —el defecto que lo hizo nacer—. Al
   * ponerle la unidad al KPI («Cursos-horario aplicados»), esa protección
   * concreta deja de venir sola.
   *
   * Se reafirma aquí, sobre el tramo que falló de verdad, en vez de intentar un
   * guard más listo que nadie ha necesitado todavía: `en_aplicacion` es «tiene
   * respuestas pero todavía NO es aplicada ni cerrada»
   * (`monitoreo_aulas_universitarias.R:1335`), o sea EN CURSO, y «Aplicada» es
   * el participio de terminado.
   */
  it("y el tramo en curso no se llama con el participio de terminado", () => {
    const enCurso = TRAMOS_DE_APLICACION.find((t) => t.clave === "en_aplicacion");
    expect(enCurso, "el tramo `en_aplicacion` desapareció: revisa este contrato").toBeDefined();
    expect(raiz(enCurso!.etiqueta)).not.toBe("aplicada");
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

/**
 * **Y dos columnas distintas tampoco pueden llamarse igual.**
 *
 * El guard de arriba compara los tramos de aplicación con la banda de KPIs.
 * `FIELD_LABELS` —el glosario que pone nombre a cada columna de tabla— no lo
 * vigilaba nadie, y ahí vivían `application_status` y `application_state`: la
 * primera es la columna «STATUS DE APLICACIÓN» que el equipo escribe en el
 * parte, la segunda el estado que el motor deriva del avance. Dos cosas
 * distintas que se distinguían **sólo porque una decía «Status» y la otra
 * «Estado»** — un anglicismo haciendo de distinción, que no le dice nada a
 * quien lee. Al traducir el anglicismo quedaron homónimas y nada se puso rojo.
 *
 * El censo del glosario en ese momento —153 entradas— no tenía ninguna otra
 * pareja, así que el contrato arranca sin deuda: cualquier repetido es nuevo.
 */
describe("el glosario de columnas no repite rótulos", () => {
  it("ninguna pareja de claves comparte etiqueta", () => {
    const porRotulo = new Map<string, string[]>();
    for (const [clave, rotulo] of Object.entries(FIELD_LABELS)) {
      const r = raiz(String(rotulo));
      porRotulo.set(r, [...(porRotulo.get(r) ?? []), clave]);
    }
    const repetidos = [...porRotulo.entries()]
      .filter(([, claves]) => claves.length > 1)
      .map(([r, claves]) => `«${r}» ← ${claves.join(", ")}`);
    expect(repetidos, repetidos.join("\n")).toEqual([]);
  });

  it("el glosario está poblado: si no, este contrato no prueba nada", () => {
    // El mismo control de fixture que el de la banda: un glosario vacío pasaría
    // sin comparar nada.
    expect(Object.keys(FIELD_LABELS).length).toBeGreaterThan(100);
  });
});
