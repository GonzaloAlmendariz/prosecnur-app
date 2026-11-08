// La franja plegable: la línea de resumen con los públicos, el indicador y la referencia, y «Ajustar» con aria-expanded
// que controla la franja completa (que siempre se pinta: el pliegue es del CSS bajo 700 px de alto).
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ResumenFranja } from "./ResumenFranja";

const pintar = (abierta: boolean) => renderToStaticMarkup(
  <ResumenFranja abierta={abierta} onAlternar={() => undefined} bases={["docentes", "estudiantes"]} publicos={["docentes"]}
    indicadores={[]} indicador={{ id: "top2box", etiqueta: "Top Two Box", rotulo: "x", codigos: ["4", "5"] }} referencia={60}
    onPublico={() => undefined} onMoverPublico={() => undefined} onIndicador={() => undefined} onReferencia={() => undefined} />,
);

describe("ResumenFranja", () => {
  it("plegada: resumen en una línea y «Ajustar» con aria-expanded=false que controla la franja", () => {
    const html = pintar(false);
    expect(html).toContain(">Docentes<");
    expect(html).toContain("Top Two Box");
    expect(html).toContain("Referencia 60%");
    expect(html).toMatch(/aria-expanded="false" aria-controls="([^"]+)-franja"/);
    const id = /aria-controls="([^"]+)"/.exec(html)?.[1];
    expect(html).toContain(`id="${id}"`);
    expect(html).toContain("Ajustar");
  });

  it("abierta: «Plegar» con aria-expanded=true", () => {
    const html = pintar(true);
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain("Plegar");
    expect(html).toContain("is-abierta");
  });
});
