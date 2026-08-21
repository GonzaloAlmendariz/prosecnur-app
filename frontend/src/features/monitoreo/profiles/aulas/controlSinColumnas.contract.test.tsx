import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AulasControlDelLibro, columnasDelControl } from "./AulasControlDelLibro";
import { columnasDeLaTabla } from "./columnasDeLaTabla";

/**
 * El encabezado decia «190 filas de la hoja · sin columnas» y debajo habia una
 * tabla. Medido: **190 `td`, 2 `th` y uno de ellos vacio** — la vista entera
 * ocupada por una lista de codigos de curso-horario, con la banda de grupos
 * pintada sin un solo grupo.
 *
 * `columnasDeLaTabla` declara en su propia doc que cuenta «las que la tabla
 * acaba pintando»; contaba 0 mientras la tabla pintaba una. La reparacion no es
 * subir el numero —una columna de codigos no es la Base de control— sino no
 * pintar esa tabla: que aulas trae la hoja ya lo dice «190 filas en la hoja» y
 * que grupos faltan lo dice «Sin llenar en el libro».
 */

const filas = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ operational_code: `CH ${i + 1}` }));

const render = (grupos: unknown, n = 190) =>
  renderToStaticMarkup(
    <AulasControlDelLibro filas={filas(n)} resumen={{ aulas: n, grupos } as never} />,
  );

describe("la Base de control no pinta una tabla de una sola columna", () => {
  it("sin ninguna columna de control llena, no hay tabla", () => {
    const html = render([{ clave: "cuenta", aulas_con_dato: 0 }]);
    expect(html).not.toContain("<table");
    expect(html).toMatch(/ninguna columna de control llena/i);
  });

  it("sin grupos declarados tampoco", () => {
    expect(render([])).not.toContain("<table");
  });

  it("con una columna llena SI hay tabla — el control discrimina", () => {
    const html = render([{ clave: "cuenta", aulas_con_dato: 5 }]);
    expect(html).toContain("<table");
    // Y pinta mas de la columna del codigo: la tabla entrega lo que promete.
    expect([...html.matchAll(/<th[^>]*>/g)].length).toBeGreaterThan(3);
  });

  it("el rotulo dice de que son las columnas que faltan", () => {
    // «sin columnas» a secas se leia como que la HOJA no tiene columnas.
    const vacio = { aulas: 190, grupos: [{ clave: "cuenta", aulas_con_dato: 0 }] } as never;
    expect(columnasDelControl(vacio)).toBe(0);
    expect(columnasDeLaTabla(vacio)).toBe("sin columnas de control llenas");
  });

  it("el vacio declara su geometria igual que la rama con datos", () => {
    // La leccion de `bee55aa8`: sin `member`, el runner cae a los hijos del
    // `section` y mide el ENCABEZADO del panel como contenedor de datos.
    const html = render([{ clave: "cuenta", aulas_con_dato: 0 }]);
    expect(html).toContain('data-qa-geometry-capacity="owned"');
    expect(html).toContain("data-qa-geometry-member");
  });
});
