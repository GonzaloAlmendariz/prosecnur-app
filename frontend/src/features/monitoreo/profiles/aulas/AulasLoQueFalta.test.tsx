import { describe, expect, it } from "vitest";

import { renderToStaticMarkup } from "react-dom/server";

import { AulasLoQueFalta } from "./AulasLoQueFalta";

/**
 * Los dos vacíos del panel, que el fixture no produce nunca.
 *
 * Este libro tiene 79 aulas cortas con todas sus cifras, así que ninguna
 * pasada visual llega a los estados de abajo. Se ejercitan aquí porque una de
 * las dos ramas es la mejor noticia posible del operativo y decirla como «sin
 * datos» la haría parecer un fallo.
 */

describe("AulasLoQueFalta · los vacíos", () => {
  it("ninguna corta se dice como buena noticia, no como ausencia de datos", () => {
    const html = renderToStaticMarkup(
      <AulasLoQueFalta filas={[{ operational_code: "CH 1", cumple_total: true, cumple_poblacion: true }]} />,
    );
    expect(html).toContain("Ninguna aula evaluada se quedó corta");
    expect(html).not.toContain("Sin datos");
  });

  it("cortas sin cifras dicen qué columna falta, no un cero", () => {
    const html = renderToStaticMarkup(
      <AulasLoQueFalta filas={[{ operational_code: "CH 1", cumple_total: false, cumple_poblacion: false }]} />,
    );
    expect(html).toContain("no trae con qué calcular cuánto les falta");
    expect(html).toContain("70T");
    // El control: si el panel tratara «sin cifras» como faltante cero, dibujaría
    // la escalera con un aula de coste cero en vez de decir qué le falta al libro.
    expect(html).not.toContain("aulas-falta-grafico");
  });

  it("con cifras dibuja la escalera y dice el precio", () => {
    const html = renderToStaticMarkup(
      <AulasLoQueFalta filas={[
        { operational_code: "CH 1", cumple_total: false, cumple_poblacion: true, sent_total: 8, threshold_total: 10 },
        { operational_code: "CH 2", cumple_total: false, cumple_poblacion: true, sent_total: 1, threshold_total: 11 },
      ]} />,
    );
    expect(html).toContain("aulas-falta-grafico");
    expect(html).toContain("<strong>12</strong> encuestas cierran las 2 aulas");
    // La más barata primero: es el orden en que se hace el trabajo.
    expect(html.indexOf("CH 1")).toBeLessThan(html.indexOf("CH 2"));
  });
});
