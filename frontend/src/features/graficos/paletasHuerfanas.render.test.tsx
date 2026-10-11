import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PaletasHuerfanas } from "./PaletasEditor";

// ADR 0097: el grupo de paletas «sin lista en este instrumento» se ve, con sus colores, declara su superficie (C1) y
// contiene su propio vacío (C3). Render estático: sin pila ni DOM.

const LISTAS = [
  { list_name: "lst_p14", choices: [{ name: "1", label: "De acuerdo" }, { name: "2", label: "En desacuerdo" }] },
  { list_name: "lst_p20", choices: [{ name: "1", label: "Sí" }, { name: "2", label: "No" }] },
];

function render(props: Partial<Parameters<typeof PaletasHuerfanas>[0]> = {}) {
  return renderToStaticMarkup(createElement(PaletasHuerfanas, {
    claves: ["acuerdo_4"],
    total: 1,
    paletas: { acuerdo_4: { "de acuerdo": "#ADD493", "En desacuerdo": "#FFD965" } },
    vinculos: { lst_p20: "acuerdo_4" },
    listas: LISTAS,
    listNames: ["lst_p14", "lst_p20"],
    onVincular: vi.fn(),
    ...props,
  }));
}

describe("PaletasHuerfanas", () => {
  it("muestra la huérfana con sus colores, quién la usa y cómo vincularla", () => {
    const html = render();
    expect(html).toContain("Sin lista en este instrumento");
    expect(html).toContain("<code title=\"acuerdo_4\">acuerdo_4</code>");
    expect(html).toContain("background:#ADD493");
    expect(html).toContain("Por sus opciones: lst_p14");
    expect(html).toContain("Quitar vínculo de lst_p20 con acuerdo_4");
    expect(html).toContain("Vincular a…");
    // La lista ya vinculada a esta paleta no se vuelve a ofrecer.
    expect(html).toContain("<option value=\"lst_p14\">");
    expect(html).not.toContain("<option value=\"lst_p20\">");
  });

  it("declara grupo y miembros (C1)", () => {
    const html = render();
    expect(html).toContain("data-qa-geometry-group=\"graficos/paletas-huerfanas\"");
    expect(html).toContain("data-qa-geometry-contract=\"equal\"");
    expect(html).toContain("data-qa-geometry-member");
  });

  it("el vacío vive dentro del grupo (C3)", () => {
    const html = render({ claves: [], total: 0 });
    expect(html).toContain("data-qa-geometry-capacity=\"owned\"");
    expect(html).toContain("Todas las paletas guardadas son de listas de este instrumento.");
    expect(render({ claves: [], total: 2 })).toContain("Ninguna paleta sin lista coincide con la búsqueda.");
  });
});
