import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import type { ArgMetadata } from "../../api/client";
import { ArgField } from "./ArgField";

function render(meta: ArgMetadata, value: number) {
  return renderToStaticMarkup(createElement(ArgField, { meta, value, onChange: () => undefined, variables: [], argState: "custom" }));
}

describe("ArgField pinta el umbral en la escala que declara el catálogo", () => {
  test("Umbral verde del Top 2 Box en % (80) se ve 80, no 8000", () => {
    const html = render({
      name: "barra_extra_umbral_alto", label: "Umbral verde del Top 2 Box", tipo_input: "number", grupo: "estilo",
      default: 80, unidad: "%",
    }, 80);
    expect(html).toContain('value="80"');
    expect(html).not.toContain("8000");
  });

  test("un umbral declarado en proporción (0.05) se ve 5 %", () => {
    const html = render({
      name: "umbral_ocultar_etiqueta", label: "Ocultar porcentajes por debajo de", tipo_input: "number", grupo: "valores",
      default: 0, min: 0, max: 1, step: 0.01, unidad: "proporción",
    }, 0.05);
    expect(html).toContain('value="5"');
    expect(html).toContain("%");
  });
});
