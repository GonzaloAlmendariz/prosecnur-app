import { readFileSync } from "node:fs";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { MonitoreoVariable } from "../../../../api/monitoreo";
import { AulasFiltrosDeEfectiva, MAXIMO_DE_FILTROS } from "./AulasFiltrosDeEfectiva";

/**
 * Qué cuenta como encuesta efectiva: la frase tiene que corresponder al estado.
 *
 * Salió probando la vuelta atrás en pantalla —quitar los filtros y guardar—: con
 * CERO condiciones el panel seguía diciendo «si cumple la condición declarada», y
 * no había ninguna. Es el mismo molde que este perfil lleva corrigiendo, un
 * rótulo pegado a algo que no es lo suyo, y apareció en el panel nuevo.
 */

const VARS = [
  { name: "sexo", tipo: "chr", n_missing: 0, n_unique: 2, values: ["F", "M"] },
  { name: "p01", tipo: "chr", n_missing: 0, n_unique: 5, values: ["1", "2"] },
] as unknown as MonitoreoVariable[];

const pintar = (filtros: Array<{ var: string; values: string[] }>) =>
  renderToStaticMarkup(
    <AulasFiltrosDeEfectiva
      filtros={filtros} variables={VARS}
      onChange={() => {}} onGuardar={() => {}} />);

describe("qué cuenta como encuesta efectiva", () => {
  it("sin ninguna condición dice ESO, no que se cumpla una", () => {
    const html = pintar([]);
    expect(html).toContain("Sin condiciones declaradas cuentan todas las respuestas");
    expect(html).not.toContain("cumple la condición declarada");
  });

  it("con condiciones NO repite lo que ya dicen la cabecera y el motor", () => {
    // Decía «Una respuesta cuenta como efectiva si cumple las N condiciones a la
    // vez» y a continuación el motor decía «Una respuesta cuenta si su 'sexo'
    // está entre los valores declarados» —dos veces «una respuesta cuenta» en el
    // mismo renglón— mientras la cabecera del panel ya dice «hasta cuatro
    // condiciones, y se cumplen todas». **Tres veces la misma idea.**
    const html = pintar([{ var: "sexo", values: ["F"] }, { var: "p01", values: ["1"] }]);
    expect(html).not.toContain("condiciones a la vez");
    expect(html).not.toContain("Una respuesta cuenta como efectiva");
  });

  it("con condiciones enseña la cifra del motor, que es lo que la cabecera no dice", () => {
    const conCriterio = renderToStaticMarkup(
      <AulasFiltrosDeEfectiva
        filtros={[{ var: "sexo", values: ["F"] }]} variables={VARS}
        criterio="Una respuesta cuenta si su 'sexo' esta entre los valores declarados: 1850 de 3700."
        onChange={() => {}} onGuardar={() => {}} />);
    expect(conCriterio).toContain("1850 de 3700");
  });

  it("avisa de la variable que la base no trae, en vez de aplicarla en silencio", () => {
    // El motor NO la aplica —descartar por una columna ausente dejaría al
    // estudio sin avance por un error de tipeo— y aquí se dice, que es donde se
    // puede corregir.
    const html = pintar([{ var: "columna_que_se_fue", values: ["si"] }]);
    expect(html).toContain("La base no trae");
    expect(html).toContain("columna_que_se_fue");
    expect(html).toContain("no se aplica");
  });

  it("cuatro es el máximo, y se dice", () => {
    const cuatro = Array.from({ length: MAXIMO_DE_FILTROS }, () => ({ var: "sexo", values: ["F"] }));
    const html = pintar(cuatro);
    expect(html).toContain("Cuatro es el máximo");
    // El botón, por su elemento: React pone `disabled` ANTES del texto, así que
    // buscarlo «después de Añadir condición» no lo encuentra aunque esté.
    const boton = html.match(/<button[^>]*>(?:(?!<\/button>)[\s\S])*?Añadir condición/);
    expect(boton).not.toBeNull();
    expect(boton![0]).toContain("disabled");
  });
});

describe("la lista de valores se abre hacia el lado que cabe", () => {
  it("declara la clase que la abre hacia arriba", () => {
    // Con la CUARTA condición en un viewport de 600 px la lista se abría **251
    // px fuera de la ventana** —medido: `bottom: 851`—. Es el mismo molde que el
    // globo del gráfico: un elemento anclado sin mirar el borde.
    //
    // El render estático no tiene ventana, así que lo que este archivo sujeta es
    // que la clase EXISTA y que el componente la use; el comportamiento se
    // verificó en pantalla a 1024x600, con el botón a la vista como lo tendría
    // un usuario: la primera condición abre en 269–371 y la cuarta en 397–499,
    // las dos dentro.
    const fuente = readFileSync(
      new URL("./AulasFiltrosDeEfectiva.tsx", import.meta.url), "utf8");
    expect(fuente).toContain("es-arriba");
    expect(fuente).toMatch(/window\.innerHeight - r\.bottom/);
    const css = readFileSync(
      new URL("./aulasMonitoreo.css", import.meta.url), "utf8");
    expect(css).toMatch(/\.aulas-efectiva-opciones\.es-arriba[^}]*bottom:\s*100%/);
  });
});
