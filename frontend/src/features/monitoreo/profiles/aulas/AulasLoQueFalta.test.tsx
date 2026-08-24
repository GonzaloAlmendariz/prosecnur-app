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
    // **La columna que se nombra tiene que existir en el libro de hoy.** Decía
    // «(columnas 70T y 70P)», y la app dejó de escribirlas: el equipo iba a
    // buscarlas al Excel y no estaban. La meta ya viaja con cada curso-horario,
    // así que lo que falta es lo conseguido.
    expect(html).toContain("EFECTIVAS OBTENIDAS");
    expect(html).not.toContain("70T");
    // El control: si el panel tratara «sin cifras» como faltante cero, dibujaría
    // la escalera con un aula de coste cero en vez de decir qué le falta al libro.
    expect(html).not.toContain("aulas-falta-grafico");
  });

  it("un aula que falla los dos umbrales lo dice, y no lo contrario", () => {
    // La frase se lee detrás de «falla»: con «ninguno de los dos umbrales»
    // salía «falla ninguno de los dos umbrales», que es lo contrario de lo que
    // le pasa a esa aula.
    const html = renderToStaticMarkup(
      <AulasLoQueFalta filas={[
        { operational_code: "CH 1", cumple_total: false, cumple_poblacion: false, sent_total: 5, threshold_total: 10, threshold_population: 12 },
      ]} />,
    );
    expect(html).toContain("falla los dos umbrales");
    expect(html).not.toContain("falla ninguno");
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

describe("AulasLoQueFalta · el foco por facultad", () => {
  const filas = [
    { operational_code: "CH 1", faculty: "Derecho", cumple_total: false, cumple_poblacion: true, sent_total: 8, threshold_total: 10 },
    { operational_code: "CH 2", faculty: "Derecho", cumple_total: false, cumple_poblacion: true, sent_total: 7, threshold_total: 10 },
    { operational_code: "CH 3", faculty: "Letras", cumple_total: false, cumple_poblacion: true, sent_total: 1, threshold_total: 11 },
  ];

  it("sin onFoco la lista es texto, como las demás que no participan", () => {
    const html = renderToStaticMarkup(<AulasLoQueFalta filas={filas} />);
    expect(html).toContain("Derecho");
    expect(html).not.toContain("aulas-foco-boton");
  });

  it("la lista de aulas obedece el foco y dice de qué conjunto habla", () => {
    const html = renderToStaticMarkup(
      <AulasLoQueFalta filas={filas} facultadEnFoco="Letras" onFoco={() => {}} />,
    );
    // Sólo el aula de Letras en la lista; las dos de Derecho fuera.
    expect(html).toContain("CH 3");
    expect(html).not.toContain("CH 1");
    expect(html).toContain("1 aula de Letras, que es la facultad en foco");
    // El bloque de facultades NO se filtra: existe para comparar unas con
    // otras, y con una sola fila no compara nada.
    expect(html).toContain("Derecho");
    // Y el titular sigue hablando del total, que es el contexto.
    expect(html).toContain("encuestas cierran las 3 aulas");
  });

  it("con onFoco cada facultad es pulsable y la enfocada se marca", () => {
    const html = renderToStaticMarkup(
      <AulasLoQueFalta filas={filas} facultadEnFoco="Derecho" onFoco={() => {}} />,
    );
    expect(html).toContain("aulas-foco-boton");
    expect(html).toContain("es-en-foco");
    // `aria-pressed` y no `aria-selected`: es un interruptor, igual que en las
    // otras cinco listas. El control de que la marca no se pone en todas.
    expect(html.match(/aria-pressed="true"/g)?.length).toBe(1);
    expect(html.match(/aria-pressed="false"/g)?.length).toBe(1);
  });
});
