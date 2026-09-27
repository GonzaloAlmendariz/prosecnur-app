/**
 * L5 del loop de mejoras (2026-09-27): una unidad sin estrato se listaba bajo
 * «Ids con tamaño inválido» aunque su tamaño fuera válido.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ErrorDelMotor } from "../ErrorDelMotor";

describe("ErrorDelMotor", () => {
  it("rotula las unidades sin estrato como tales, no como tamaño inválido", () => {
    const html = renderToStaticMarkup(
      <ErrorDelMotor
        label="No se pudo declarar el marco"
        error={{
          texto: "1 unidades no tienen estrato: complétalo en el archivo o quita la columna de estrato.",
          codigo: "E_CALC_MUESTRA_GENERAL_MARCO",
          detalle: { ids_duplicados: [], filas_sin_id: [], ids: [], ids_sin_estrato: ["U9999"] },
        }}
      />,
    );
    expect(html).toContain("Ids sin estrato");
    expect(html).not.toContain("tamaño inválido");
    expect(html).toContain("U9999");
  });
});
