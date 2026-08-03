import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * G34 · El deslizador arranca donde arranca el eje.
 *
 * Medido en la app antes de esto: pista en x=131, gráfico en x=149 — 18 px de
 * desfase a cada lado, que son el relleno y el borde de la tarjeta que envuelve
 * al gráfico. La manija señalaba un punto de la escala desplazado, y una guía
 * desviada es peor que ninguna porque se lee con la misma confianza.
 *
 * El sangrado se publica como variable en la tarjeta y el control lo compensa.
 * Este caso impide el número mágico: si alguien cambia el relleno sin mover la
 * variable, la compensación deja de seguirlo.
 */
const leer = (rel: string) =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

describe("alineación del deslizador con el eje", () => {
  it("la tarjeta del gráfico PUBLICA su sangrado", () => {
    const css = leer("../../marco/criterioFacultadRadiografia.css");
    expect(css).toMatch(/\.cmv2-crc-compact-segment\s*\{[^}]*--cmv2-seg-sangrado:/);
  });

  it("el control alineado lo compensa en vez de inventar un número", () => {
    const css = leer("../controlUmbral.css");
    const bloque = /\.cmv2-umbral-control\[data-alineado\] \.cmv2-umbral-fila\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
    expect(bloque).toContain("--cmv2-seg-sangrado");
    // Un `padding-inline` con sólo píxeles sería el número mágico que esto evita.
    expect(bloque).toMatch(/padding-inline:\s*calc\(/);
  });

  it("el rango de dos manijas compensa el mismo sangrado", () => {
    // G35 · Con un rango la desviación pesa el doble: son dos manijas señalando
    // dos puntos desplazados, y la banda entre ellas dibuja un tramo que no
    // coincide con el que el eje muestra.
    const css = leer("../controlUmbral.css");
    const bloque = /\.cmv2-umbral-control\[data-alineado\] \.cmv2-rango-pistas\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
    expect(bloque).toContain("--cmv2-seg-sangrado");
    expect(bloque).toMatch(/margin-inline:\s*calc\(/);
  });

  it("el control alineado no impone un ancho propio", () => {
    // Si lo hiciera, dejaría de seguir al gráfico cuando la fila cambie.
    const css = leer("../controlUmbral.css");
    const bloque = /\.cmv2-umbral-control\[data-alineado\] \.cmv2-umbral-fila\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
    expect(bloque).toMatch(/width:\s*100%/);
    expect(bloque).not.toMatch(/width:\s*\d+px/);
  });

  it("la raíz alineada reclama la fila entera", () => {
    /*
     * G35 · Compensar el sangrado no basta si el ancho no es el del eje.
     *
     * Dentro de un contenedor flex la raíz se dimensionaba por su contenido:
     * medía 696 px contra los 1.091 del gráfico y los sangrados corregían un
     * desfase sobre una escala que ya no era la correcta. Medido en la app:
     * delta 0 por ambos lados solo después de esto.
     */
    const css = leer("../controlUmbral.css");
    const bloque = /\.cmv2-umbral-control\[data-alineado\]\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
    expect(bloque).toMatch(/width:\s*100%/);
  });

  it("el contenedor del rango no encoge a su contenido", () => {
    // Era `inline-flex` porque alojaba dos <select> chicos. Un contenedor
    // heredado de un control que ya no existe es una restricción sin dueño.
    const css = leer("../criterios.css");
    const bloque = /\.cmv2-crit-range-inputs\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
    expect(bloque).not.toMatch(/display:\s*inline-flex/);
    expect(bloque).toMatch(/width:\s*100%/);
  });
});

describe("el confirmador que pide cada tarjeta", () => {
  /*
   * G35 · La tarjeta de rango pedía el confirmador de su vecina.
   *
   * `confirmador={confirmadorDe?.(variable.id)}` en el montaje resolvía el nodo
   * con el id de `condicion_curso`: mover una manija marcaba pendiente el rango
   * y la tarjeta preguntaba por otro criterio, así que no aparecía confirmador
   * y el cambio se quedaba fuera de la cascada. Pasar la **función** hace que
   * cada tarjeta pregunte por su propio criterio y el error deje de ser
   * expresable — este guard fija esa forma.
   */
  it("la tarjeta de rango recibe la función, no un nodo ya resuelto", () => {
    const src = leer("../../marco/FacultadDecisionBloque.tsx");
    const montaje = /<NivelFacultadCard([\s\S]*?)\/>/.exec(src)?.[1] ?? "";
    expect(montaje).toContain("confirmadorDe={confirmadorDe}");
    expect(montaje).not.toMatch(/confirmador=\{confirmadorDe\?\.\(/);
  });
});
