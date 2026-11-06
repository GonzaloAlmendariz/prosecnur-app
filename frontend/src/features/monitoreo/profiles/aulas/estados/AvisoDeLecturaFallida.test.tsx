import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { AvisoDeLecturaFallida, leerError } from "./AvisoDeLecturaFallida";

// S3: el error con su código, su error_id y el corte que sigue vigente.

describe("AvisoDeLecturaFallida", () => {
  it("separa el mensaje del código y del error_id", () => {
    expect(leerError("Kobo no respondió (error_id 7f3a9c21) · E_KOBO_API_FAILED")).toEqual({
      mensaje: "Kobo no respondió (error_id 7f3a9c21)", codigo: "E_KOBO_API_FAILED", errorId: "7f3a9c21",
    });
    expect(leerError("Failed to fetch")).toEqual({ mensaje: "Failed to fetch", codigo: "", errorId: "" });
  });

  it("dice que el corte anterior sigue vigente y ofrece reintentar", () => {
    const html = renderToStaticMarkup(
      <AvisoDeLecturaFallida error="Kobo no respondió · E_KOBO_API_FAILED" corte="2026-10-01T15:03:00Z" onReintentar={() => {}} />,
    );
    expect(html).toContain("E_KOBO_API_FAILED");
    expect(html).toContain("El corte del 1 oct a las 15:03 sigue vigente.");
    expect(html).toContain("Reintentar");
  });
});
