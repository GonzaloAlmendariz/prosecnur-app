import { describe, expect, test } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SlideTypeIcon } from "./SlideTypeIcon";

const render = (props: Parameters<typeof SlideTypeIcon>[0]) => renderToStaticMarkup(createElement(SlideTypeIcon, props));

describe("SlideTypeIcon (envoltorio de IconoTipo)", () => {
  test.each([
    "p_slide_grafico_texto_izquierda",
    "p_slide_portada",
    "p_slide_indice",
    "p_slide_4_graficos_poblacion",
  ])("delega %s en el sistema de íconos, sin lucide", (tipo) => {
    const markup = render({ tipo, iconoUi: "FileText", size: 12 });
    expect(markup).toContain('class="pulso-icono-tipo"');
    expect(markup).toContain(`data-icono-tipo="${tipo}"`);
    expect(markup).toContain('width="12"');
    expect(markup).not.toContain("lucide-");
  });

  test("distingue el lado del texto", () => {
    const sinTipo = (m: string) => m.replace(/ data-icono-tipo="[^"]*"/, "");
    expect(sinTipo(render({ tipo: "p_slide_grafico_texto_izquierda" })))
      .not.toBe(sinTipo(render({ tipo: "p_slide_grafico_texto_derecha" })));
  });

  test("un tipo fuera del registro conserva el lucide de su icono_ui", () => {
    expect(render({ tipo: "p_slide_futuro", iconoUi: "FileText" })).toContain("lucide-");
  });
});
