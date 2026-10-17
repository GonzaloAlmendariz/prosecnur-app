// Las listas repetidas se avisan en la pestaña Listas de opciones del rail (el botón propio de la banda se quitó
// porque duplicaba la navegación). Mata: perder el aviso al quitar el botón.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EditorPestanas } from "./EditorPestanas";

describe("aviso de listas repetidas en el rail", () => {
  it("la pestaña Listas de opciones dice cuántas hay repetidas y las demás no", () => {
    const html = renderToStaticMarkup(<EditorPestanas pestana="constructor" onCambiar={() => {}} listasRepetidas={10}><div /></EditorPestanas>);
    expect(html).toContain("10 listas repetidas");
    expect(html.match(/listas repetidas/g)?.length ?? 0).toBeGreaterThan(0);
    const limpio = renderToStaticMarkup(<EditorPestanas pestana="constructor" onCambiar={() => {}}><div /></EditorPestanas>);
    expect(limpio).not.toContain("repetida");
  });
});
