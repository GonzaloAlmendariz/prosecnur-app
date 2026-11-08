// R5-1: sin imagen y con motivo, el hueco pinta el glifo y una línea visible con él (no sólo el `title`).
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { atributosHueco, HuecoMiniatura } from "./HuecoMiniatura";

const glifo = <svg data-glifo="" />;

describe("HuecoMiniatura", () => {
  it("con error: el glifo y la línea «Sin vista previa» visibles, y el title lo repite", () => {
    const html = renderToStaticMarkup(
      <HuecoMiniatura miniatura={{ src: null, error: "Sin vista previa: falta elegir preguntas." }} nombre="Divergentes">{glifo}</HuecoMiniatura>,
    );
    expect(html).toContain("data-glifo");
    expect(html).toMatch(/<p class="pulso-f6-hueco-nota"[^>]*>Sin vista previa: falta elegir preguntas\.<\/p>/);
    expect(atributosHueco({ src: null, error: "x" })).toEqual({ "data-miniatura": "error", title: "x" });
  });

  it("sin error, sólo el glifo; con imagen, sólo la imagen", () => {
    expect(renderToStaticMarkup(<HuecoMiniatura miniatura={undefined} nombre="A">{glifo}</HuecoMiniatura>)).not.toContain("hueco-nota");
    const conImagen = renderToStaticMarkup(<HuecoMiniatura miniatura={{ src: "/x.png", error: null }} nombre="A">{glifo}</HuecoMiniatura>);
    expect(conImagen).toContain("<img");
    expect(conImagen).not.toContain("data-glifo");
  });
});
