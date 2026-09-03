import { describe, expect, it } from "vitest";

import { renderToStaticMarkup } from "react-dom/server";

import { AccionEnCelda, COLUMNA_DE_ACCION } from "./AccionEnCelda";

/**
 * «Qué toca» con su urgencia a la vista: el color dice la familia de la
 * acción — rojo de marca = llamar hoy, ámbar = decisión que envejece,
 * verde = hecho, tenue = nada que hacer. Lo no reconocido va en texto plano:
 * la lista cerrada no traga.
 */
describe("AccionEnCelda", () => {
  it("la acción del día va en el chip de la casa con su tono de urgencia", () => {
    const llamar = renderToStaticMarkup(<AccionEnCelda valor="Llamar al docente" />);
    expect(llamar).toContain("aulas-estado-chip");
    expect(llamar).toContain("--pulso-module-monitoring");
    const cerrar = renderToStaticMarkup(<AccionEnCelda valor="Cerrar fecha" />);
    expect(cerrar).toContain("--pulso-warn-fg");
    const hecho = renderToStaticMarkup(<AccionEnCelda valor="Aplicado" />);
    expect(hecho).toContain("--pulso-success-fg");
    const espera = renderToStaticMarkup(<AccionEnCelda valor="Esperar al día" />);
    expect(espera).toContain("--pulso-text-faint");
  });

  it("una acción que el mapa no reconoce se pinta tal cual, sin chip ni invento", () => {
    const html = renderToStaticMarkup(<AccionEnCelda valor="Acción nueva del futuro" />);
    expect(html).not.toContain("aulas-estado-chip");
    expect(html).toContain("Acción nueva del futuro");
  });

  it("la columna declarada es la del carril de celdas", () => {
    expect(COLUMNA_DE_ACCION).toBe("que_toca");
  });
});
