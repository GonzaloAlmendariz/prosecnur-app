import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AvanceCuotasEditorMetas } from "./AvanceCuotasEditorMetas";

const filas = [
  { categoria: "CONTRATADO", universo: 26, meta: "11" },
  { categoria: "AUXILIAR", universo: 24, meta: "2" },
  { categoria: "Sin dato", universo: 10, meta: "0" },
];

describe("editor de una cuota referencial (ADR 0126)", () => {
  it("dice «Referencia» y muestra el peso de cada categoría en el universo, sin «Sin dato»", () => {
    const html = renderToStaticMarkup(<AvanceCuotasEditorMetas filas={filas} deshabilitado={false} onMeta={() => undefined} referencial />);
    expect(html).toContain("Referencia");
    expect(html).toContain("Del universo");
    // 26 de los 50 conocidos: 52 %, no la referencia sobre su propio universo (42.3 %).
    expect(html).toMatch(/52(\.0)?\s?%/);
    expect(html).not.toContain("42.3");
  });

  it("como meta sigue igual", () => {
    const html = renderToStaticMarkup(<AvanceCuotasEditorMetas filas={filas} deshabilitado={false} onMeta={() => undefined} />);
    expect(html).toContain("De su universo");
    expect(html).toMatch(/42\.3\s?%/);
  });
});
