import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import type { BuilderNode } from "../../types";
import { ResumenPregunta } from "./ResumenPregunta";

const base: BuilderNode = {
  rowIndex: 3, depth: 1, kind: "question", label: "¿Quién responde?", name: "respondent", sectionId: "s1",
  typeInfo: { raw: "select_one ${nombres}", base: "select_one", listName: "${nombres}" }, required: true,
  relevant: "", constraint: "", calculation: "", choiceFilter: "", hint: "", appearance: "",
};
const scope = { variables: [{ rowIndex: 1, name: "nombres", label: "Nombre del miembro", baseType: "text" }], catalogsByListName: new Map(), allowCurrent: false };
const render = (n: BuilderNode, herencia: { sectionLabel: string; relevant: string }[] = []) =>
  renderToStaticMarkup(
    <ResumenPregunta node={n} section={null} choices={[]} catalogUsageCount={1} conditionalContext={{ selfRelevant: n.relevant, ancestorRelevants: herencia }} logicScope={scope} onEditar={() => {}} />,
  );

describe("resumen de la pregunta en el Constructor", () => {
  test("opciones dinámicas desde un repeat se nombran, no se ven como lista vacía", () => {
    const html = render(base);
    expect(html).toContain("Lo anotado en «Nombre del miembro»");
    expect(html).toContain("los nombres anotados en «Nombre del miembro»");
  });
  test("la regla heredada de la sección se muestra aparte de la propia", () => {
    const html = render(base, [{ sectionLabel: "Hogar", relevant: "${nombres} != ''" }]);
    expect(html).toContain("Hereda de la sección «Hogar»");
    expect(html).toContain("Sin condición propia");
    expect(html).toContain("Hereda la regla de 1 sección; no tiene condición propia.");
  });
  test("un campo automático no se imprime ni pide respuesta", () => {
    const html = render({ ...base, typeInfo: { raw: "start", base: "start", listName: "" }, name: "start" });
    expect(html).toContain("No se imprime");
    expect(html).toContain("Se completa sola");
  });
  test("cuatro contenedores, siempre", () => {
    expect(render(base).match(/class="xfk-card[ "]/g)?.length).toBe(4);
  });
  test("el aviso de comillas tipográficas se muestra (viaja en `aviso`, no en la frase)", () => {
    const html = render({ ...base, typeInfo: { raw: "integer", base: "integer", listName: "" }, constraint: ". > ‘5’", relevant: "${nombres} = ‘a’" });
    expect(html).toContain("Aviso");
    expect(html).toMatch(/comillas/i);
  });
});
