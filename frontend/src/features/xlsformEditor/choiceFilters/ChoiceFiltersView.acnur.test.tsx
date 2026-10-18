// S2/S5 en la pestaña Filtros con filas reales del ACNUR. Mata: «0 respuestas previas» y «dependen de respuestas que
// la persona dio antes» para el subconjunto fijo REF02CO = 'kk', y una dependencia inventada para la fila rota.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { acnur } from "../reglas/acnurEs.fixture";
import { LECTURA_FILA_ROTA } from "../reglas/motor";
import { ChoiceFiltersView } from "./ChoiceFiltersView";

const A = acnur();
const pintar = (seleccionada: string) =>
  renderToStaticMarkup(
    <ChoiceFiltersView open structure={A.structure} choicesColumns={A.workbook.choices.columns} choicesRows={A.workbook.choices.rows}
      seleccionada={seleccionada} onSeleccionar={() => {}} onEditar={() => {}} />,
  );

describe("Filtros con el ACNUR", () => {
  it("REF02: subconjunto fijo, sin «respuestas previas»", () => {
    const html = pintar("REF02");
    expect(html).toContain("Muestra siempre las mismas 3 opciones: las marcadas con kk en la columna REF02CO de la lista Country.");
    expect(html).not.toContain("0 respuestas previas");
    expect(html).not.toContain("dependen de respuestas que la persona dio antes");
    expect(html).not.toContain("Depende de las respuestas a:");
    expect(html).toContain("siempre las mismas 3");
  });
  it("REG02_Other_recod: fila rota, sin dependencias", () => {
    const html = pintar("REG02_Other_recod");
    expect(html).toContain(LECTURA_FILA_ROTA);
    expect(html).not.toContain("Depende de las respuestas a:");
  });
});

describe("S15: todo filtro se puede editar", () => {
  it("REF16 (condición + opciones fijas) ofrece «Editar filtro»", () => {
    const html = renderToStaticMarkup(
      <ChoiceFiltersView open structure={A.structure} choicesColumns={A.workbook.choices.columns} choicesRows={A.workbook.choices.rows}
        seleccionada="REF16" onSeleccionar={() => {}} onEditar={() => {}} workbook={A.workbook} onWorkbookChange={() => {}} />,
    );
    expect(html).toContain("Editar filtro");
    expect(html).not.toContain("No hay un filtro en");
  });
});
