import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Todos los gráficos del perfil comparten la escala de eje.
 *
 * El perfil pinta con dos tecnologías —SVG a mano y Plotly— y sus ejes no
 * coincidían: los SVG usan `--aulas-min` (10 px) con `--pulso-text-faint`, que
 * es la escala declarada del perfil, y Plotly ponía 11 px con
 * `--pulso-text-soft` por su default compartido. Un punto de más y un tono más
 * oscuro en la mitad de los gráficos de la misma pantalla.
 *
 * Este guard existe porque el defecto vuelve solo: un gráfico Plotly nuevo se
 * escribe copiando a otro, y si el copiado no lleva la fuente, nace desalineado
 * y nadie lo ve —11 px contra 10 no se nota mirando, se nota midiendo—.
 */

const dir = __dirname;

/** Los componentes del perfil que dibujan con Plotly. */
function graficosPlotly(): string[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".tsx") && !f.includes(".test."))
    .filter((f) => readFileSync(path.join(dir, f), "utf8").includes("<PlotlyChart"));
}

describe("la escala de eje del perfil", () => {
  it("el perfil ya no dibuja con Plotly, y el único que queda está sin montar", () => {
    // **Este aserto cambió de premisa el 2026-09-08, y el guard hizo su trabajo
    // para que se notara.** Pedía `>= 3` gráficos Plotly y llevaba rojo desde
    // que el perfil se pasó entero a barras CSS y SVG a mano —decisión repetida
    // y dictada: «Barras en CSS y no Plotly» (E21, E22, 2026-09-03)—. Un rojo
    // permanente que nadie puede arreglar enseña a ignorar los rojos, que es
    // peor que no tener el test.
    //
    // Lo que se protege sigue siendo lo mismo: si alguien vuelve a meter un
    // Plotly, tiene que pasar la fuente del perfil (el `it` de abajo). Lo que
    // deja de afirmarse es un CONTEO que ya no es verdad.
    //
    // El único que queda, `AulasBrechaEstratoChart`, está SIN MONTAR desde el
    // 2026-08-29 y registrado en `componentesSinMontar.test.ts`. Si algún día
    // se borra, este aserto pasa a `toBe(0)` y el de abajo sigue cubriendo al
    // Plotly que llegue después.
    expect(graficosPlotly().length).toBeLessThanOrEqual(1);
  });

  it("todos pasan la fuente del perfil, ninguno se queda con el default", () => {
    const sinFuente = graficosPlotly().filter((f) => {
      const src = readFileSync(path.join(dir, f), "utf8");
      return !src.includes("fuenteDeEjeAulas()");
    });
    expect(sinFuente).toEqual([]);
  });

  it("la fuente sale de un token, no de un hex copiado", () => {
    const src = readFileSync(path.join(dir, "ejesDeAulas.ts"), "utf8");
    expect(src).toContain('token("--pulso-text-faint"');
    // El respaldo es lo único que puede llevar un literal, y sólo para el caso
    // sin documento; el valor real se lee del tema en cada render.
    expect(src.match(/#[0-9a-f]{6}/gi)?.length).toBe(1);
  });
});
