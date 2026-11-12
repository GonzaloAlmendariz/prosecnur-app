import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";
import { describe, expect, test } from "vitest";

// C1 de Analítica › Datos: la pestaña es una mesa del kit y la lista de
// variables declara su grupo de secciones. Con la forma del prototipo la lista
// vive en `datos/PanelDeVariables.tsx`.

const here = path.dirname(fileURLToPath(import.meta.url));

function fuente(rel: string): ts.SourceFile {
  const ruta = path.join(here, rel);
  return ts.createSourceFile(ruta, fs.readFileSync(ruta, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}

function literalAttribute(sf: ts.SourceFile, tag: ts.JsxOpeningLikeElement, name: string): string | undefined {
  const attribute = tag.attributes.properties.find(
    (property): property is ts.JsxAttribute => ts.isJsxAttribute(property) && property.name.getText(sf) === name,
  );
  return attribute?.initializer && ts.isStringLiteral(attribute.initializer) ? attribute.initializer.text : undefined;
}

function etiquetas(sf: ts.SourceFile, filtro: (tag: ts.JsxOpeningLikeElement) => boolean): ts.JsxOpeningLikeElement[] {
  const hallados: ts.JsxOpeningLikeElement[] = [];
  const visitar = (node: ts.Node) => {
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && filtro(node)) hallados.push(node);
    ts.forEachChild(node, visitar);
  };
  visitar(sf);
  return hallados;
}

describe("contrato geométrico de Analítica › Datos", () => {
  test("la pestaña es una mesa de dos columnas del kit con su grupo", () => {
    const sf = fuente("DataReviewPane.tsx");
    const mesas = etiquetas(sf, (t) => t.tagName.getText(sf) === "MesaDePestana");
    expect(mesas).toHaveLength(1);
    expect(literalAttribute(sf, mesas[0], "grupo")).toBe("analitica/datos");
  });

  test("la lista declara sus secciones como un grupo intrínseco", () => {
    const sf = fuente("../datos/PanelDeVariables.tsx");
    const listas = etiquetas(sf, (t) => literalAttribute(sf, t, "className") === "datos-secciones");
    expect(listas).toHaveLength(1);
    expect(literalAttribute(sf, listas[0], "data-qa-geometry-group")).toBe("analitica/datos-secciones");
    expect(literalAttribute(sf, listas[0], "data-qa-geometry-contract")).toBe("intrinsic");
  });

  test("la rejilla de variables es una tabla con nombre", () => {
    const sf = fuente("../datos/PanelDeVariables.tsx");
    const tablas = etiquetas(sf, (t) => literalAttribute(sf, t, "role") === "table");
    expect(tablas).toHaveLength(1);
    expect(literalAttribute(sf, tablas[0], "aria-label")).toBe("Variables de la base");
  });
});
