// «Qué ve el encuestado» en una cascada (A3, 2026-11-07). Mata: avisar en rojo «se muestra sin opciones» antes de que
// se responda la pregunta de la que depende, y callar ese aviso cuando la respuesta dada de verdad deja la lista vacía.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { XlsformEditorWorkbook } from "../../../api/multiIntegrado";
import { parseBuilderStructure } from "../parsing/buildIndex";
import { analizarFiltro } from "./modeloFiltros";
import { VistaEncuestado } from "./VistaEncuestado";

const C = ["list_name", "name", "label", "province"];
const wb: XlsformEditorWorkbook = {
  survey: {
    columns: ["type", "name", "label", "choice_filter"],
    rows: [
      ["select_one prov", "Province", "Provincia", ""],
      ["select_one dist", "District", "Distrito", "province = ${Province}"],
    ],
  },
  choices: {
    columns: C,
    rows: [
      ["prov", "LIM", "Lima", ""], ["prov", "TAC", "Tacna", ""],
      ["dist", "MIR", "Miraflores", "LIM"], ["dist", "ATE", "Ate", "LIM"],
    ],
  },
  settings: { columns: [], rows: [] },
};
const structure = parseBuilderStructure(wb.survey);
const a = analizarFiltro({ structure, choices: wb.choices }, structure.outline.find((n) => n.name === "District")!.rowIndex)!;
const pintar = (respuestas: Record<string, string>) =>
  renderToStaticMarkup(<VistaEncuestado a={a} choices={wb.choices} respuestas={respuestas} onRespuesta={() => {}} destello={false} />);

describe("vista del encuestado en una cascada", () => {
  it("sin responder la pregunta de la que depende, invita a elegirla y no avisa en rojo", () => {
    const html = pintar({});
    expect(html).toContain("Elige una respuesta arriba para ver las opciones.");
    expect(html).not.toContain("xcf-vista__vacia");
  });
  it("con una respuesta que deja la lista vacía, sí avisa", () => {
    expect(pintar({ Province: "TAC" })).toContain("La pregunta se muestra sin opciones.");
  });
  it("con una respuesta que filtra, muestra las opciones", () => {
    const html = pintar({ Province: "LIM" });
    expect(html).toContain("Miraflores");
    expect(html).not.toContain("Elige una respuesta arriba");
  });
});
