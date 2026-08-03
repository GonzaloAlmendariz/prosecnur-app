import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";

const logicDir = path.dirname(fileURLToPath(import.meta.url));
const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");

const logicCss = stripComments(
  fs.readFileSync(path.resolve(logicDir, "../../styles/xf-logic.css"), "utf8"),
);
const themeCss = stripComments(
  fs.readFileSync(path.resolve(logicDir, "../../../../app/theme.css"), "utf8"),
);

/**
 * La fila de condición se mide contra SU COLUMNA, no contra el viewport.
 *
 * La regla anterior vivía en theme.css bajo `@media (min-width: 1120px)` y
 * `:has(.pulso-focus-tabs button.is-active:nth-child(3))`. Fallaba por los
 * dos lados: pedía 440 px de tracks dentro de una fila de 337 px —desbordaba
 * ~103 px y cortaba el control de valor— y el `nth-child` contaba hijos, no
 * botones, así que se disparaba en la pestaña equivocada.
 */
describe("contrato geométrico del builder de lógica", () => {
  test("la fila de condición se mide con @container, no con el viewport", () => {
    expect(logicCss).toContain("container-name: pulso-logic-rows");
    expect(logicCss).toMatch(/@container\s+pulso-logic-rows\s*\(/);
  });

  test("theme.css ya no gobierna la fila según qué pestaña esté activa", () => {
    expect(themeCss).not.toMatch(/\.pulso-focus-tabs\s+button\.is-active:nth-child\(/);
  });

  test("ningún track de la fila es de ancho fijo", () => {
    const declaraciones = [
      ...logicCss.matchAll(
        /([^{}]*pulso-logic-condition-row[^{}]*)\{([^{}]*)\}/g,
      ),
    ]
      .map(([, selector, body]) => ({
        selector: selector.trim(),
        valor: body
          .split(";")
          .map((d) => d.trim())
          .find((d) => d.startsWith("grid-template-columns:")),
      }))
      .filter((d): d is { selector: string; valor: string } => Boolean(d.valor));

    expect(declaraciones.length).toBeGreaterThan(0);
    for (const { selector, valor } of declaraciones) {
      // `var(...)` resuelve a tracks `minmax(0, …fr)` declarados en el bloque.
      if (valor.includes("var(")) continue;
      expect(valor, `${selector} usa un track fijo`).not.toMatch(/\d+px/);
      expect(valor, `${selector} no acota su track a minmax(0, …)`).toContain(
        "minmax(0",
      );
    }
  });

  test("las filas de un grupo de una sola variable declaran su geometría", () => {
    const builder = fs.readFileSync(
      path.join(logicDir, "LogicTreeBuilder.tsx"),
      "utf8",
    );
    const tag = builder.match(
      /<div\b(?=[^>]*\bclassName="pulso-logic-samevar-rows")[^>]*>/,
    )?.[0];

    expect(tag).toBeDefined();
    expect(tag).toContain('data-qa-geometry-group="xlsform/logic-samevar-rows"');
    expect(tag).toContain('data-qa-geometry-contract="equal"');
  });
});
