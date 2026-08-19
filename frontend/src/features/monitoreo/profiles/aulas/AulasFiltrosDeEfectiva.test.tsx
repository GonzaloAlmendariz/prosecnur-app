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
  it("sin ninguna condición NO dice que cumple «la condición declarada»", () => {
    const html = pintar([]);
    expect(html).toContain("no declara ninguna condición");
    expect(html).toContain("cuentan todas las respuestas");
    expect(html).not.toContain("cumple la condición declarada");
  });

  it("con una lo dice en singular y con dos declara que son a la vez", () => {
    expect(pintar([{ var: "sexo", values: ["F"] }]))
      .toContain("cumple la condición declarada");
    const dos = pintar([{ var: "sexo", values: ["F"] }, { var: "p01", values: ["1"] }]);
    expect(dos).toContain("las 2 condiciones a la vez");
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
