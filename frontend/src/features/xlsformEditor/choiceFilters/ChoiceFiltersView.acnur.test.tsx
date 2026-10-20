// La pestaña Filtros con filas reales del ACNUR. Mata: «respuestas previas» para el subconjunto fijo REF02CO = 'kk',
// REF02 abierto como expresión combinada, una dependencia inventada para la fila rota, `${x}` crudo en un título y
// un filtro sin «Editar filtro».
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { acnur } from "../reglas/acnurEs.fixture";
import { LECTURA_FILA_ROTA } from "../reglas/motor";
import { ChoiceFiltersView } from "./ChoiceFiltersView";

const A = acnur();
const pintar = (seleccionada: string, editable = false) =>
  renderToStaticMarkup(
    <MemoryRouter>
      <ChoiceFiltersView open structure={A.structure} choicesColumns={A.workbook.choices.columns} choicesRows={A.workbook.choices.rows}
        seleccionada={seleccionada} onSeleccionar={() => {}} onEditar={() => {}}
        {...(editable ? { workbook: A.workbook, onWorkbookChange: () => {} } : {})} />
    </MemoryRouter>,
  );

describe("Filtros con el ACNUR", () => {
  it("REF02: subconjunto fijo editable como lista, sin «respuestas previas»", () => {
    const html = pintar("REF02", true);
    expect(html).toContain("Muestra siempre las mismas 3 opciones: las marcadas con kk en la columna REF02CO de la lista Country.");
    expect(html).toContain("Opciones que se muestran");
    expect(html).toMatch(/type="checkbox"/);
    expect(html).not.toContain("Expresión (choice_filter)");
    expect(html).not.toMatch(/respuestas? previas?/);
  });
  it("REG02_Other_recod: fila rota, en conflicto y sin dependencias", () => {
    const html = pintar("REG02_Other_recod");
    expect(html).toContain(LECTURA_FILA_ROTA);
    expect(html).toContain("En conflicto");
  });
  it("lista: código, forma y estado de cada filtro", () => {
    const html = pintar("REF02");
    expect(html).toMatch(/xcf-item__codigo[^>]*>REF02</);
    expect(html).toContain(">Fijo<");
    expect(html).toContain('aria-current="true"');
    expect(html).not.toMatch(/\$\{[A-Za-z_]+\}/);
  });
});

describe("todo filtro se puede editar", () => {
  it("REF16 (condición + opciones nombradas) ofrece «Editar filtro» y una vista previa", () => {
    const html = pintar("REF16", true);
    expect(html).toContain("Editar filtro");
    expect(html).toContain("Qué ve el encuestado");
    expect(html).not.toContain("No hay un filtro en");
  });
});
