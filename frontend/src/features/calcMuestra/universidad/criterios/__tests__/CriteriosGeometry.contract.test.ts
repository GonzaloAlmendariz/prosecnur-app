import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import type {
  CriterioSeleccion,
  CriterioVariable,
} from "../../../../../api/client";
import { ControlFlat } from "../controles";

type ParsedSource = {
  file: ts.SourceFile;
};

const here = path.dirname(fileURLToPath(import.meta.url));

function parse(relativePath: string): ParsedSource {
  const sourcePath = path.resolve(here, relativePath);
  return {
    file: ts.createSourceFile(
      sourcePath,
      fs.readFileSync(sourcePath, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    ),
  };
}

function literalAttribute(
  source: ParsedSource,
  tag: ts.JsxOpeningLikeElement,
  name: string,
): string | undefined {
  const attribute = tag.attributes.properties.find(
    (property): property is ts.JsxAttribute =>
      ts.isJsxAttribute(property) && property.name.getText(source.file) === name,
  );
  return attribute?.initializer && ts.isStringLiteral(attribute.initializer)
    ? attribute.initializer.text
    : undefined;
}

function hasAttribute(source: ParsedSource, tag: ts.JsxOpeningLikeElement, name: string): boolean {
  return tag.attributes.properties.some(
    (property) => ts.isJsxAttribute(property) && property.name.getText(source.file) === name,
  );
}

function tagsWithClass(
  source: ParsedSource,
  className: string,
  root: ts.Node = source.file,
): ts.JsxOpeningLikeElement[] {
  const matches: ts.JsxOpeningLikeElement[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const classes = literalAttribute(source, node, "className")?.split(/\s+/) ?? [];
      if (classes.includes(className)) matches.push(node);
    }
    ts.forEachChild(node, visit);
  };
  visit(root);
  return matches;
}

const cifraSource = parse("../../ui/CifraMotor.tsx");
const controlesSource = parse("../controles.tsx");
const criteriosCss = fs.readFileSync(path.resolve(here, "../criterios.css"), "utf8");

function compactCss(value: string): string {
  return value.replace(/\s+/g, "");
}

function mediaTier(maxWidth: number): { start: number; body: string } | null {
  const marker = `@media (max-width: ${maxWidth}px)`;
  const start = criteriosCss.indexOf(marker);
  if (start < 0) return null;
  const open = criteriosCss.indexOf("{", start + marker.length);
  if (open < 0) return null;
  let depth = 1;
  for (let index = open + 1; index < criteriosCss.length; index += 1) {
    if (criteriosCss[index] === "{") depth += 1;
    if (criteriosCss[index] === "}") depth -= 1;
    if (depth === 0) return { start, body: criteriosCss.slice(open + 1, index) };
  }
  return null;
}

function selectorGroupForColumns(body: string, columns: string): string | null {
  for (const match of body.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (
      compactCss(match[2]).includes(
        `grid-template-columns:${compactCss(columns)}`,
      )
    ) {
      return match[1];
    }
  }
  return null;
}

describe("C1 geométrico de las colecciones de Criterios", () => {
  it("declara CifraFila como un grupo persistente de cifras iguales", () => {
    const filas = tagsWithClass(cifraSource, "cmv2-uni-cifra-fila");

    expect(filas).toHaveLength(1);
    expect({
      group: literalAttribute(cifraSource, filas[0], "data-qa-geometry-group"),
      contract: literalAttribute(cifraSource, filas[0], "data-qa-geometry-contract"),
    }).toEqual({
      group: "calc-muestra/cifra-fila",
      contract: "equal",
    });
  });

  it("declara las listas plana y anidada como colecciones intrínsecas propias", () => {
    const listas = tagsWithClass(controlesSource, "cmv2-crit-list");

    expect(listas).toHaveLength(2);
    expect(listas.map((tag) => ({
      group: literalAttribute(controlesSource, tag, "data-qa-geometry-group"),
      contract: literalAttribute(controlesSource, tag, "data-qa-geometry-contract"),
    }))).toEqual([
      { group: "calc-muestra/criterios-categorias", contract: "intrinsic" },
      { group: "calc-muestra/criterios-subcategorias", contract: "intrinsic" },
    ]);
  });

  it("declara cada ítem como miembro que posee su capacidad táctil", () => {
    const items = tagsWithClass(controlesSource, "cmv2-crit-item");

    expect(items).toHaveLength(2);
    expect(items.map((tag) => ({
      member: hasAttribute(controlesSource, tag, "data-qa-geometry-member"),
      capacity: literalAttribute(controlesSource, tag, "data-qa-geometry-capacity"),
    }))).toEqual([
      { member: true, capacity: "owned" },
      { member: true, capacity: "owned" },
    ]);
  });
});

describe("geometría CSS de las categorías planas", () => {
  it("reserva 240px mínimos por ítem antes de crear otra columna", () => {
    expect(criteriosCss).toMatch(
      /\.cmv2-crit-cats\s*>\s*\.cmv2-crit-list\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(240px,\s*1fr\)\)/,
    );
  });

  it("envuelve etiquetas directas solo entre palabras", () => {
    const selector = String.raw`\.cmv2-crit-cats\s*>\s*\.cmv2-crit-list\s*>\s*\.cmv2-crit-item\s+\.cmv2-crit-item-label`;
    const rule = criteriosCss.match(new RegExp(`${selector}\\s*\\{([^}]*)\\}`));

    expect(rule, "falta el selector directo de etiquetas planas").not.toBeNull();
    const declarations = rule?.[1] ?? "";
    expect(declarations).toMatch(/overflow-wrap:\s*normal\s*;/);
    expect(declarations).toMatch(/word-break:\s*normal\s*;/);
    expect(declarations).toMatch(/hyphens:\s*none\s*;/);
    expect(declarations).toMatch(/white-space:\s*normal\s*;/);
    expect(declarations).not.toMatch(/overflow-wrap:\s*anywhere/);
  });

  it("aplica 3→2→1 columnas a listas planas y largas en tiers ordenados", () => {
    const tier1350 = mediaTier(1350);
    const tier1100 = mediaTier(1100);
    const tier620 = mediaTier(620);

    expect(tier1350).not.toBeNull();
    expect(tier1100, "falta el tier max-width 1100px").not.toBeNull();
    expect(tier620).not.toBeNull();
    if (!tier1350 || !tier1100 || !tier620) return;
    expect(tier1350.start).toBeLessThan(tier1100.start);
    expect(tier1100.start).toBeLessThan(tier620.start);

    const twoColumns = selectorGroupForColumns(
      tier1100.body,
      "repeat(2, minmax(0, 1fr))",
    );
    expect(twoColumns).toContain(".cmv2-crit-cats > .cmv2-crit-list");
    expect(twoColumns).toContain('.cmv2-crit-list[data-long="true"]');

    const oneColumn = selectorGroupForColumns(tier620.body, "minmax(0, 1fr)");
    expect(oneColumn).toContain(".cmv2-crit-cats > .cmv2-crit-list");
    expect(oneColumn).toContain('.cmv2-crit-list[data-long="true"]');
  });
});

describe("oportunidades de corte de las etiquetas planas", () => {
  it("inserta wbr solo tras las comas sin alterar texto visible ni nombre accesible", () => {
    const labelLargo = "INGRESO(EV.TAL,1OP,CEPR,ITS,PAEE,BACH,EX.ING)";
    const labelSimple = "REGULAR";
    const variable: CriterioVariable = {
      id: "condition",
      scope: "aula",
      label: "Condición de ingreso",
      kind: "flat",
      categories: [
        { key: "ingreso", label: labelLargo, aulas: 7 },
        { key: "regular", label: labelSimple, aulas: 5 },
      ],
    };
    const sel: CriterioSeleccion = {
      mode: "include",
      categories: ["ingreso", "regular"],
    };
    const html = renderToStaticMarkup(
      createElement(ControlFlat, { variable, sel, onSel: () => undefined }),
    );
    const labels = Array.from(
      html.matchAll(/<span class="cmv2-crit-item-label">([\s\S]*?)<\/span>/g),
      ([, contenido]) => contenido,
    );
    const largo = labels.find((contenido) => contenido.includes("INGRESO"));

    // T1 (2026-08-02): la etiqueta agrupa siete valores y la pantalla lo
    // declara en vez de presentarlos como una categoría. El contrato que
    // sustituye al de `<wbr>` es el mismo en el fondo — no perder información —
    // pero ahora exige además que la agrupación sea legible.
    expect(largo).toContain("INGRESO");
    expect(largo).toContain("agrupa 8");
    // Ningún valor se pierde: los siete siguen en el DOM y en el `title`.
    for (const valor of ["EV.TAL", "1OP", "CEPR", "ITS", "PAEE", "BACH", "EX.ING"]) {
      expect(html).toContain(valor);
    }
    expect(html).toContain('class="cmv2-crit-item-agrupadas"');
    // El nombre accesible dice que agrupa, no finge una sola categoría.
    expect(html).toContain('aria-label="INGRESO, agrupa 8 valores"');
    // Una categoría que sí es una sola cosa no se toca.
    expect(labels).toContain(labelSimple);
  });

  it("S4: el conmutador publica lo que la categoría aporta al marco, no solo el catálogo", () => {
    const variable: CriterioVariable = {
      id: "formation",
      scope: "alumno",
      label: "Formación",
      kind: "flat",
      categories: [
        { key: "pregrado", label: "PREGRADO", aulas: 25155 },
        { key: "maestria", label: "MAESTRIA", aulas: 2819 },
      ],
    };
    const sel: CriterioSeleccion = { mode: "include", categories: ["pregrado"] };
    // R publica el aporte por segmento; React no lo suma ni lo deriva.
    const aporte = (segmentKey: string) => segmentKey === "pregrado"
      ? { elegibles: 20879, ch: 2799, chContraste: 4343 }
      : { elegibles: 0, ch: 0, chContraste: 699 };

    const html = renderToStaticMarkup(
      createElement(ControlFlat, { variable, sel, onSel: () => undefined, aporte }),
    );
    // El conteo del catálogo se rotula como lo que es, y no se queda solo.
    expect(html).toContain("en la base");
    expect(html).toContain("20,879");
    expect(html).toContain("2,799");
    expect(html).toContain("en el marco");
    // Una categoría con aporte nulo lo dice en vez de callarlo.
    expect(html).toContain('data-aporta="cero"');

    // Sin aporte publicado la superficie no inventa nada.
    const sinAporte = renderToStaticMarkup(
      createElement(ControlFlat, { variable, sel, onSel: () => undefined }),
    );
    expect(sinAporte).not.toContain("en el marco");
  });
});
