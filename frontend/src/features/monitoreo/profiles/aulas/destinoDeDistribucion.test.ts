import { describe, expect, it } from "vitest";

import { destinoDeDistribucion } from "./destinoDeDistribucion";

/**
 * El rojo que existe por la pantalla del 2026-09-09: enlace pegado, botón
 * activo, y «No hay Sheets de la distribución que sincronizar: pega su enlace
 * una vez» debajo. La guarda contaba el enlace pegado y la llamada no lo
 * mandaba.
 */
describe("el destino del Sheets de los aplicadores", () => {
  it("con el enlace recién pegado y nada recordado, hay destino Y se manda", () => {
    const d = destinoDeDistribucion("https://docs.google.com/spreadsheets/d/ABC/edit", "");
    expect(d.hay).toBe(true);
    expect(d.enviar).toBe("https://docs.google.com/spreadsheets/d/ABC/edit");
  });

  it("con sólo el recordado, hay destino y NO se manda enlace: lo busca el backend", () => {
    const d = destinoDeDistribucion("", "https://docs.google.com/spreadsheets/d/REC/edit");
    expect(d.hay).toBe(true);
    expect(d.enviar).toBeUndefined();
  });

  it("lo pegado manda sobre lo recordado: es la corrección que se acaba de teclear", () => {
    const d = destinoDeDistribucion("https://nuevo", "https://viejo");
    expect(d.enviar).toBe("https://nuevo");
  });

  it("sin nada de los dos no hay destino", () => {
    expect(destinoDeDistribucion("", "").hay).toBe(false);
    expect(destinoDeDistribucion(null, undefined).hay).toBe(false);
  });

  it("espacios sueltos no son un enlace", () => {
    const d = destinoDeDistribucion("   ", "  ");
    expect(d.hay).toBe(false);
    expect(d.enviar).toBeUndefined();
  });

  it("si hay destino, o se manda algo o hay algo recordado que buscar", () => {
    // La invariante que hace imposible el rojo: guarda y argumento salen de
    // la misma expresión, así que no pueden contradecirse.
    for (const [e, r] of [["a", ""], ["", "b"], ["a", "b"], ["", ""]] as const) {
      const d = destinoDeDistribucion(e, r);
      expect(d.hay).toBe(Boolean(d.enviar) || Boolean(r.trim()));
    }
  });
});
