import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { PanelCard, PropRow, QuestionToken, ReadsAs, Segmented, typeFamily, typeTone } from "./index";

describe("kit · tono por tipo", () => {
  test("cada familia conocida tiene un tono distinto de «otro» y siempre es un var()", () => {
    for (const t of ["select_one", "select_multiple", "integer", "text", "date", "calculate", "geopoint", "note"]) {
      expect(typeFamily(t)).not.toBe("otro");
      expect(typeTone(t)).toMatch(/^var\(--/);
    }
    expect(typeFamily("tipo_inventado")).toBe("otro");
  });
});

describe("kit · componentes", () => {
  test("PanelCard pinta cabecera, meta y pie; fill no encoge", () => {
    const html = renderToStaticMarkup(
      <PanelCard title="Cuándo aparece" meta="Abrir en Lógica" footer="Se lee: siempre" fill>
        cuerpo
      </PanelCard>,
    );
    expect(html).toContain("xfk-card--fill");
    expect(html).toContain("Cuándo aparece");
    expect(html).toContain("xfk-card__foot");
  });

  test("PanelCard sin pie no deja un pie vacío", () => {
    expect(renderToStaticMarkup(<PanelCard title="X">y</PanelCard>)).not.toContain("xfk-card__foot");
  });

  test("Segmented marca la opción activa como radio", () => {
    const html = renderToStaticMarkup(
      <Segmented aria-label="Alcance" value="b" onChange={() => {}} options={[{ value: "a", label: "Todas" }, { value: "b", label: "Sección", count: 3 }]} />,
    );
    expect(html).toContain('role="radiogroup"');
    expect(html.match(/aria-checked="true"/g)?.length).toBe(1);
    expect(html).toContain("xfk-seg__count");
  });

  test("PropRow es botón sólo con onClick", () => {
    expect(renderToStaticMarkup(<PropRow label="Tipo">x</PropRow>)).not.toContain("<button");
    expect(renderToStaticMarkup(<PropRow label="Tipo" onClick={() => {}}>x</PropRow>)).toContain("<button");
  });

  test("QuestionToken guarda el nombre XLSForm en el title, no en el texto", () => {
    const html = renderToStaticMarkup(<QuestionToken baseType="integer" label="P3" hint="Edad" variable="edad" />);
    expect(html).toContain('title="${edad}"');
    expect(html).not.toContain(">${edad}<");
  });

  test("ReadsAs en modo código usa <code>", () => {
    expect(renderToStaticMarkup(<ReadsAs label="XLSForm" code>a = b</ReadsAs>)).toContain("<code");
  });
});
