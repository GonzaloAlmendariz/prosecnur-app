import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import {
  GraficadorBlueprint,
  resolveGraficadorBlueprint,
  type GraficadorBlueprintKind,
} from "./GraficadorBlueprint";

describe("blueprint de puntos comparativos", () => {
  test("comunica puntos independientes sin conectores", () => {
    const kind = "comparison-dots" as GraficadorBlueprintKind;
    expect(resolveGraficadorBlueprint(kind)).toBe("comparison-dots");

    const markup = renderToStaticMarkup(createElement(GraficadorBlueprint, {
      blueprint: kind,
      label: "Puntos comparativos",
    }));
    expect(markup).toContain('data-blueprint="comparison-dots"');
    expect((markup.match(/<circle\b/g) ?? [])).toHaveLength(4);
    expect(markup).toMatch(/n\s*=/);
    expect(markup).not.toMatch(/<(?:line|polyline)\b/);
    expect(markup).not.toContain("blueprint-line");
  });

  test("mantiene la tinta de datos Pulso fuera del acento Processing", () => {
    const markup = renderToStaticMarkup(createElement(GraficadorBlueprint, {
      blueprint: "comparison-dots",
      label: "Puntos comparativos",
    }));

    expect({
      tintaPulsoEstable: markup.includes('fill="#002457"'),
      primaryContextual: markup.includes('fill="var(--pulso-primary)"'),
    }).toEqual({ tintaPulsoEstable: true, primaryContextual: false });
  });
});
