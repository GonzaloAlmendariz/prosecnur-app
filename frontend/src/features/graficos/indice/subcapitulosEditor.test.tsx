import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SubcapitulosEditor } from "./SubcapitulosEditor";

describe("subcapítulos del índice como lista", () => {
  it("una fila numerada por subcapítulo, con sus acciones, y «Agregar subcapítulo»; sin textarea", () => {
    const html = renderToStaticMarkup(createElement(SubcapitulosEditor, {
      numeroCapitulo: 2, nombreCapitulo: "Gestión", subcapitulos: ["Planes", "Recursos"], onCambiar: () => undefined,
    }));
    expect(html).toContain(">2.1<"); expect(html).toContain(">2.2<");
    expect(html).toContain('aria-label="Quitar el subcapítulo 2.2"');
    expect(html).toContain("Agregar subcapítulo");
    expect(html).not.toContain("<textarea");
  });
});
