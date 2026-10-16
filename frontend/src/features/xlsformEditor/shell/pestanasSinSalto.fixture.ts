// Formulario mínimo para los contratos de las pestañas del editor (ítem 50): una sección con una condición, una
// restricción, un filtro de opciones y una fila con ajuste de papel. Sólo lo usan los tests.

import type { XlsformEditorWorkbook } from "../types";
import { buildCatalogs, parseBuilderStructure } from "../parsing/buildIndex";

export const WORKBOOK_SIN_SALTO: XlsformEditorWorkbook = {
  survey: {
    columns: ["type", "name", "label", "required", "relevant", "constraint", "choice_filter", "paper_number"],
    rows: [
      ["begin_group", "s1", "Datos del hogar", "", "", "", "", ""],
      ["select_one sino", "p1", "¿Vive aquí?", "yes", "", "", "", ""],
      ["integer", "p2", "Edad", "yes", "${p1} = '1'", ". >= 18 and . <= 99", "", ""],
      ["select_one dep", "p3", "Departamento", "yes", "", "", "", ""],
      ["select_one prov", "p4", "Provincia", "yes", "", "", "dep=${p3}", ""],
      ["text", "p5", "Comentario", "", "", "", "", "108"],
      ["end_group", "", "", "", "", "", "", ""],
    ],
  },
  choices: {
    columns: ["list_name", "name", "label", "dep"],
    rows: [
      ["sino", "1", "Sí", ""],
      ["sino", "2", "No", ""],
      ["dep", "a", "Lima", ""],
      ["dep", "b", "Cusco", ""],
      ["prov", "x", "Lima provincia", "a"],
      ["prov", "y", "Cusco provincia", "b"],
    ],
  },
  settings: { columns: ["form_title"], rows: [["Encuesta de prueba"]] },
};

export const ESTRUCTURA_SIN_SALTO = parseBuilderStructure(WORKBOOK_SIN_SALTO.survey);
export const CATALOGOS_SIN_SALTO = buildCatalogs(WORKBOOK_SIN_SALTO.choices);
