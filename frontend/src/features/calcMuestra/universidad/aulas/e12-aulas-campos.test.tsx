/**
 * E12 · A7 — los campos numéricos de Parámetros del sorteo llevan su rótulo
 * visible asociado al input. Antes el `<span>` quedaba fuera del `<label>` de
 * NumberCell y el input no tenía nombre accesible: ocho campos anónimos para
 * un lector de pantalla (mínimo, reemplazos, techo, extra, semilla, corridas,
 * candidatas, repetidos).
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CampoNumeroAulas } from "./CampoNumeroAulas";

function atributo(html: string, tag: RegExp, nombre: string): string | null {
  const etiqueta = tag.exec(html)?.[0] ?? "";
  return new RegExp(`${nombre}="([^"]*)"`).exec(etiqueta)?.[1] ?? null;
}

describe("E12 A7 · CampoNumeroAulas asocia rótulo y ayuda al input", () => {
  it("el input apunta al rótulo visible y a su ayuda", () => {
    const html = renderToStaticMarkup(
      <CampoNumeroAulas rotulo="Semilla" value={42} onChange={() => undefined} ayuda="Permite reproducir." />,
    );
    const rotuloId = atributo(html, /<span id="[^"]*">Semilla<\/span>/, "id");
    const ayudaId = atributo(html, /<em id="[^"]*">/, "id");
    expect(rotuloId).toBeTruthy();
    expect(ayudaId).toBeTruthy();
    expect(atributo(html, /<input[^>]*>/, "aria-labelledby")).toBe(rotuloId);
    expect(atributo(html, /<input[^>]*>/, "aria-describedby")).toBe(ayudaId);
    // El marcado que pinta el CSS y mide el contrato geométrico no cambia.
    expect(html.startsWith('<div class="cmv2-compact-field"><span')).toBe(true);
    expect(html).toContain('<label class="cmv2-number-cell">');
  });

  it("sin ayuda no declara una descripción colgando", () => {
    const html = renderToStaticMarkup(
      <CampoNumeroAulas rotulo="Semilla" value={42} onChange={() => undefined} />,
    );
    expect(atributo(html, /<input[^>]*>/, "aria-describedby")).toBeNull();
    expect(html).not.toContain("<em");
  });
});
