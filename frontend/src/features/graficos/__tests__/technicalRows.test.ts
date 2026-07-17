import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import type { ArgMetadata } from "../../../api/client";
import { ArgField } from "../ArgField";
import { normalizeTechnicalRows, serializeTechnicalRows } from "../technicalRows";

describe("technicalRows", () => {
  test("normaliza filas estructuradas y nombres heredados", () => {
    expect(normalizeTechnicalRows([
      { criterio: "Periodo", detalle: "30 jun. – 6 jul. 2026" },
      { label: "Metodología", value: "Selección aleatoria de manzanas" },
    ])).toEqual([
      { criterio: "Periodo", detalle: "30 jun. – 6 jul. 2026" },
      { criterio: "Metodología", detalle: "Selección aleatoria de manzanas" },
    ]);
  });

  test("convierte texto legacy separado por dos puntos o barra vertical", () => {
    expect(normalizeTechnicalRows([
      "Periodo: 30 jun. – 6 jul. 2026",
      "Ámbito | Lima Norte, Lima Este y Lima Sur",
      "Nota sin criterio",
    ].join("\n"))).toEqual([
      { criterio: "Periodo", detalle: "30 jun. – 6 jul. 2026" },
      { criterio: "Ámbito", detalle: "Lima Norte, Lima Este y Lima Sur" },
      { criterio: "", detalle: "Nota sin criterio" },
    ]);
  });

  test("limpia espacios y omite filas vacías al serializar", () => {
    expect(serializeTechnicalRows([
      { criterio: "  Base ", detalle: " 426 personas " },
      { criterio: "", detalle: "" },
    ])).toEqual([{ criterio: "Base", detalle: "426 personas" }]);
  });

  test("el tipo technical_rows abre el editor de criterio y detalle", () => {
    const meta: ArgMetadata = {
      name: "filas",
      label: "Filas",
      tipo_input: "technical_rows",
      grupo: "textos",
    };
    const html = renderToStaticMarkup(createElement(ArgField, {
      meta,
      value: [{ criterio: "Periodo", detalle: "30 jun. – 6 jul. 2026" }],
      onChange: () => undefined,
      variables: [],
    }));

    expect(html).toContain("pulso-gv2-technical-rows");
    expect(html).toContain("Periodo");
    expect(html).toContain("30 jun. – 6 jul. 2026");
    expect(html).not.toContain("Este ajuste usa una interfaz dedicada");
  });
});
