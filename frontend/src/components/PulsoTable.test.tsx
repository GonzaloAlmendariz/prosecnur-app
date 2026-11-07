import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { PulsoTable, anchoDeclarado, type PulsoTableColumna } from "./PulsoTable";

type Ump = { id: string; distrito: string; validas: number };

const columnas: PulsoTableColumna<Ump>[] = [
  { id: "id", encabezado: "UMP", ancho: 90, celda: (f) => f.id, valor: (f) => f.id },
  { id: "distrito", encabezado: "Distrito", ancho: 180, celda: (f) => f.distrito, valor: (f) => f.distrito },
  { id: "validas", encabezado: "Válidas", ancho: 90, tipo: "cifra", celda: (f) => f.validas, valor: (f) => f.validas },
];

const filas: Ump[] = [
  { id: "ump-074", distrito: "San Juan de Miraflores con un nombre largo", validas: 11 },
  { id: "ump-075", distrito: "Ate", validas: 4 },
];

describe("PulsoTable (L28)", () => {
  test("la tabla mide lo que declaran sus columnas y no lo que traen sus datos", () => {
    const html = renderToStaticMarkup(<PulsoTable columnas={columnas} filas={filas} idDeFila={(f) => f.id} ariaLabel="UMP" />);
    expect(anchoDeclarado(columnas)).toBe(360);
    expect(html).toContain("width:360px");
    expect(html).toContain('<col style="width:180px"/>');
  });

  test("las cifras se marcan para ir a la derecha y el texto completo queda en title", () => {
    const html = renderToStaticMarkup(<PulsoTable columnas={columnas} filas={filas} idDeFila={(f) => f.id} ariaLabel="UMP" />);
    expect(html).toContain('data-tipo="cifra"');
    expect(html).toContain('title="San Juan de Miraflores con un nombre largo"');
  });

  test("la fila elegida la decide quien la usa, no la tabla", () => {
    const html = renderToStaticMarkup(
      <PulsoTable columnas={columnas} filas={filas} idDeFila={(f) => f.id} ariaLabel="UMP" seleccionada="ump-075" onSeleccionar={() => {}} />,
    );
    expect(html.match(/data-selected="true"/g)).toHaveLength(1);
    expect(html).toContain('aria-selected="true"');
  });

  test("sin filas, la tabla contiene su propio vacío", () => {
    const html = renderToStaticMarkup(
      <PulsoTable columnas={columnas} filas={[]} idDeFila={(f) => f.id} ariaLabel="UMP" vacio="Ninguna UMP con reporte" />,
    );
    expect(html).toContain("Ninguna UMP con reporte");
    expect(html).toContain('colSpan="3"');
  });
});
