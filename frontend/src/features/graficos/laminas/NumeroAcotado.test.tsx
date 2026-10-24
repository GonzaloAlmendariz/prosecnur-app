import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import type { ArgMetadata } from "../../../api/graficos";
import { NumeroAcotado, tieneRango } from "./NumeroAcotado";

const arg = { name: "max_categorias", label: "Máximo de categorías", tipo_input: "number", grupo: "filtro", min: 2, max: 30, step: 1, default: 12 } as ArgMetadata;
const html = (valor: unknown) => renderToStaticMarkup(createElement(NumeroAcotado, {
  id: "x", rotulo: "Máximo de categorías", arg, valor, placeholder: "12", onCambio: () => undefined,
}));

describe("NumeroAcotado", () => {
  test("«−» queda deshabilitado en el mínimo y «+» en el máximo", () => {
    const enMin = html(2);
    expect(enMin).toMatch(/aria-label="Disminuir Máximo de categorías"[^>]*disabled/);
    expect(enMin).not.toMatch(/aria-label="Aumentar Máximo de categorías"[^>]*disabled/);
    expect(html(30)).toMatch(/aria-label="Aumentar Máximo de categorías"[^>]*disabled/);
  });
  test("un 1 guardado se muestra ya ajustado a 2, con nota", () => {
    const h = html(1);
    expect(h).toContain('value="2"');
    expect(h).toContain("Estaba en 1");
  });
  test("tieneRango exige min o max finitos", () => {
    expect(tieneRango(arg)).toBe(true);
    expect(tieneRango({ min: undefined, max: undefined })).toBe(false);
  });
});
