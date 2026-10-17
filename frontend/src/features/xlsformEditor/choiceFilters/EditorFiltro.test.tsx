// Un filtro en cascada que ya existe abre el editor con todo cargado: la pregunta, de cuál depende y qué respuesta
// habilita cada opción, por etiqueta. Mata: abrir vacío un filtro existente o mostrar códigos en vez de etiquetas.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { XlsformEditorWorkbook } from "../../../api/multiIntegrado";
import { buildCatalogs, parseBuilderStructure } from "../parsing/buildIndex";
import { aplicarCascada } from "./cascada";
import { EditorFiltro } from "./EditorFiltro";

const base: XlsformEditorWorkbook = {
  survey: { columns: ["type", "name", "label"], rows: [["select_one dep", "departamento", "Departamento"], ["select_one prov", "provincia", "Provincia"]] },
  choices: { columns: ["list_name", "name", "label"], rows: [["dep", "15", "Lima"], ["dep", "04", "Arequipa"], ["prov", "1501", "Lima Metropolitana"], ["prov", "0401", "Arequipa ciudad"]] },
  settings: { columns: [], rows: [] },
};

describe("editor del filtro de opciones", () => {
  it("abre un filtro existente con la madre y las asignaciones cargadas", () => {
    const wb = aplicarCascada(base, 1, "prov", { madre: "departamento", columna: "filtro_departamento", asignaciones: { "1501": "15", "0401": "04" } });
    const html = renderToStaticMarkup(
      <EditorFiltro workbook={wb} structure={parseBuilderStructure(wb.survey)} catalogs={buildCatalogs(wb.choices)} filaInicial={1} onGuardar={() => {}} onCancelar={() => {}} />,
    );
    expect(html).toContain("Editar filtro de opciones");
    expect(html).toContain("Quitar filtro");
    expect(html).toMatch(/<option value="departamento" selected="">/);
    expect(html).toContain("Lima Metropolitana");
    expect(html).toMatch(/<option value="15" selected="">Lima<\/option>/);
    expect(html).toContain("2 de 2 asignadas");
  });
  it("uno nuevo empieza sin pregunta y con Guardar deshabilitado", () => {
    const html = renderToStaticMarkup(
      <EditorFiltro workbook={base} structure={parseBuilderStructure(base.survey)} catalogs={buildCatalogs(base.choices)} onGuardar={() => {}} onCancelar={() => {}} />,
    );
    expect(html).toContain("Nuevo filtro de opciones");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Guardar filtro<\/button>/);
  });
});
