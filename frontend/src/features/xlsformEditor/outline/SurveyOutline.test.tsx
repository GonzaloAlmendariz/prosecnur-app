// La Estructura por render estático. Mata: el nombre cliché de vuelta, un cierre de sección pintado como fila, una
// pregunta fuera del contenedor de su sección, una cabecera de sección que no se puede elegir o que no marca su
// condición, el punto de aviso sin nombre accesible, filas sin «+» cuando la página sabe insertar y más de una línea
// en el recorrido con Tab.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { parseBuilderStructure } from "../parsing/buildIndex";
import type { XlsformEditorSheet } from "../types";
import { SurveyOutline } from "./SurveyOutline";

const survey: XlsformEditorSheet = {
  name: "survey",
  columns: ["type", "name", "label", "relevant"],
  rows: [
    ["text", "q0", "Antes", ""],
    ["begin_group", "A", "Educación", "${q0} = '1'"],
    ["integer", "a1", "Edad", ""],
    ["end_group", "", "", ""],
    ["text", "q9", "Después", ""],
  ],
};
const structure = parseBuilderStructure(survey);
const nada = () => undefined;

function pintar(extra: Partial<Parameters<typeof SurveyOutline>[0]> = {}) {
  return renderToStaticMarkup(
    <SurveyOutline
      structure={structure}
      selection={{ kind: "survey", rowIndex: 2 }}
      onSelect={nada}
      onMoveUp={nada}
      onMoveDown={nada}
      canMoveUp={false}
      canMoveDown={false}
      onApplyMove={nada}
      {...extra}
    />,
  );
}

describe("SurveyOutline", () => {
  const html = pintar({
    avisosPorFila: new Map([[2, [{ nivel: "error" as const, titulo: "Código repetido" }]]]),
    onInsertar: nada,
  });

  test("sin cierres como filas y con la pregunta dentro del contenedor de su sección", () => {
    expect(html).not.toContain("Cierre de");
    const seccion = html.slice(html.indexOf('data-seccion="1"'));
    const finSeccion = seccion.indexOf('data-linea="4"');
    expect(seccion.indexOf('data-outline-row="2"')).toBeGreaterThan(0);
    expect(seccion.indexOf('data-outline-row="2"')).toBeLessThan(finSeccion);
    expect(html).toMatch(/class="xfe-seccion__hijos"[^>]*role="group"/);
  });

  test("la cabecera de la sección se elige, el chevrón pliega y la condición se marca", () => {
    expect(html).toMatch(/data-nav="1"/);
    expect(html).toContain('aria-label="Plegar «Educación»"');
    // El estado plegado va en lo que recibe el foco, no en el chevrón fuera del recorrido con Tab.
    expect(html).toMatch(/aria-expanded="true"[^>]*data-nav="1"/);
    expect(html).not.toMatch(/class="xfe-chev"[^>]*aria-expanded/);
    expect(html).toContain('aria-label="La sección tiene condición"');
  });

  test("punto de aviso con nombre accesible", () => {
    expect(html).toContain('aria-label="1 aviso: Código repetido"');
    expect(html).toContain('data-aviso="error"');
  });

  test("«+» en cada línea cuando la página sabe insertar", () => {
    expect(html).toContain("Agregar debajo de «Antes»");
    expect(html).toContain("Agregar al inicio de «Educación»");
    expect(html).toContain("Agregar después de «Educación»");
    expect(html).toContain("Agregar al inicio del formulario");
    expect(pintar()).not.toContain("xfe-mas");
  });

  test("una sola línea en el recorrido con Tab: la elegida", () => {
    expect(html.match(/data-nav="[^"]+"[^>]*tabindex="0"|tabindex="0"[^>]*data-nav="[^"]+"/g)).toHaveLength(1);
    expect(html).toMatch(/tabindex="0"[^>]*data-nav="2"/);
  });

  test("atajos: Insert (no «+») y la lista con rol", () => {
    expect(html).toContain('aria-keyshortcuts="Enter Alt+ArrowUp Alt+ArrowDown Insert"');
    expect(html).not.toMatch(/aria-keyshortcuts="[^"]*\+"/);
    expect(html).toMatch(/role="group" aria-label="Estructura del formulario"/);
  });

  test("buscador, filtro y cabecera del riel con los glifos de las marcas (estilo A)", () => {
    expect(html).toContain('aria-label="Buscar por texto o código"');
    expect(html).toContain('aria-label="Filtrar por marca"');
    expect(html).toMatch(/data-columna="cond"[^>]*aria-label="Condición"/);
    expect(html).not.toContain(">CO<");
    expect(html).not.toContain("Outline maestro");
  });
});
