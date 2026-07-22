import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, test } from "vitest";
import {
  GraficosReportScopeProvider,
  parseGraficosReportScope,
  useGraficosReportScope,
} from "./reportScope";

function ScopeProbe() {
  const location = useLocation();
  return createElement("span", null, useGraficosReportScope(location.search));
}

describe("parseGraficosReportScope", () => {
  test("activa el catalogo consolidado con la query canonica", () => {
    expect(parseGraficosReportScope("?scope=consolidado")).toBe("consolidated");
    expect(parseGraficosReportScope("scope=consolidado&slide=portada")).toBe("consolidated");
  });

  test("mantiene el alcance de la base activa sin la query canonica", () => {
    expect(parseGraficosReportScope("")).toBe("active");
    expect(parseGraficosReportScope("?scope=docentes")).toBe("active");
  });

  test("el editor consolidado fija el alcance aunque un consumidor pierda la query", () => {
    const html = renderToStaticMarkup(createElement(
      MemoryRouter,
      { initialEntries: ["/graficos"] },
      createElement(
        GraficosReportScopeProvider,
        { scope: "consolidated", children: createElement(ScopeProbe) },
      ),
    ));

    expect(html).toContain("consolidated");
  });
});
