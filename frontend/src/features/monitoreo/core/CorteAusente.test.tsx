import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { CorteAusente } from "./CorteAusente";

// El vacío de una sección sin corte tiene que decir dos cosas que el panel
// genérico anterior no decía: en qué punto está este proyecto y por dónde se
// sale. Lo primero es una cifra —no una frase—; lo segundo, una puerta.

describe("CorteAusente", () => {
  it("cuenta las fuentes que faltan y ofrece la puerta", () => {
    const html = renderToStaticMarkup(
      <CorteAusente fuentesActivas={0} fuentesRequeridas={3} onIrAFuentes={vi.fn()} />,
    );

    expect(html).toContain("Faltan fuentes por conectar");
    expect(html).toContain("0 de 3 fuentes conectadas");
    expect(html).toContain("Ir a Fuentes");
  });

  it("con el paquete completo el pendiente es sincronizar, no conectar", () => {
    const html = renderToStaticMarkup(
      <CorteAusente fuentesActivas={3} fuentesRequeridas={3} onIrAFuentes={vi.fn()} />,
    );

    expect(html).toContain("Falta sincronizar");
    expect(html).toContain("3 de 3 fuentes conectadas");
  });

  // El modo que no declara cardinalidad —acreditación no exige tres— no puede
  // dar por completo un paquete vacío: cero conectadas es «faltan», no «listo».
  it("sin cardinalidad declarada, cero conectadas sigue siendo faltar", () => {
    const html = renderToStaticMarkup(
      <CorteAusente fuentesActivas={0} fuentesRequeridas={0} />,
    );

    expect(html).toContain("Faltan fuentes por conectar");
    expect(html).toContain("Sin fuentes conectadas");
  });

  it("sin destino no pinta una puerta que no lleva a ninguna parte", () => {
    const html = renderToStaticMarkup(
      <CorteAusente fuentesActivas={1} fuentesRequeridas={3} />,
    );

    expect(html).not.toContain("<button");
  });
});
