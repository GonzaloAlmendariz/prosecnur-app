// La barra de fórmula muestra el aviso de una lectura (comillas tipográficas que ODK no reconoce). Mata: un aviso que
// viaja en `aviso` y se pierde porque la barra sólo leía `summary`.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { BarraFormula } from "./BarraFormula";

const scope = { variables: [{ rowIndex: 1, name: "edad", label: "Edad", baseType: "integer" }], catalogsByListName: new Map(), allowCurrent: false };

describe("BarraFormula", () => {
  test("relevant con comillas tipográficas: se lee y avisa", () => {
    const html = renderToStaticMarkup(
      <BarraFormula celda={{ hoja: "survey", fila: 2, columna: "relevant" }} valor="${edad} = ‘5’" nodo={null} scope={scope} onCambiar={() => {}} />,
    );
    expect(html).toContain("Se lee");
    expect(html).toContain('role="note"');
    expect(html).toMatch(/comillas/i);
  });
  test("sin comillas tipográficas, sin aviso", () => {
    const html = renderToStaticMarkup(
      <BarraFormula celda={{ hoja: "survey", fila: 2, columna: "relevant" }} valor="${edad} = '5'" nodo={null} scope={scope} onCambiar={() => {}} />,
    );
    expect(html).not.toContain('role="note"');
  });
});
