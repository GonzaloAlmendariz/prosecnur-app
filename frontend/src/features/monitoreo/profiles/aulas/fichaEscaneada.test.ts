import { describe, expect, it } from "vitest";

import { fichaEscaneadaDelParte } from "./fichaEscaneada";

/**
 * **La ficha escaneada se lee del PARTE, no del plan** (B6c, fase 2).
 *
 * `.PARTE_APP_AL_PLAN` no copia `scanned_sheet_link` a la fila del plan —
 * decisión cerrada en el backend (7e549c22)—, así que buscarlo en `row.link`
 * o en cualquier campo del plan daría un hueco eterno. Este resolvedor une
 * por `operational_code`, la misma clave con la que el parte se une al plan
 * en `parteDeCampo` y con la que el registro cuenta sus «con parte»: si cada
 * superficie uniera por su cuenta, el chip diría «con parte» y la ficha
 * «sin parte» sobre la misma aula.
 */
describe("fichaEscaneadaDelParte", () => {
  it("encuentra el enlace del parte por operational_code", () => {
    const ficha = fichaEscaneadaDelParte("CH 1", [
      { operational_code: "CH 2", scanned_sheet_link: "https://drive.google.com/file/d/otro" },
      { operational_code: "CH 1", scanned_sheet_link: "https://drive.google.com/file/d/abc" },
    ]);
    expect(ficha).toEqual({ estado: "enlace", url: "https://drive.google.com/file/d/abc" });
  });

  it("tolera el alias castellano enlace_ficha_escaneada", () => {
    // El publicador ya normaliza al nombre inglés, pero el lector del libro
    // acepta los dos y un parte que llegue por otro camino puede traer el
    // castellano: se lee el primero que tenga texto.
    const ficha = fichaEscaneadaDelParte("CH 1", [
      { operational_code: "CH 1", enlace_ficha_escaneada: "https://drive.google.com/file/d/abc" },
    ]);
    expect(ficha).toEqual({ estado: "enlace", url: "https://drive.google.com/file/d/abc" });
  });

  it("distingue «parte sin enlace» de «aula sin parte»", () => {
    const partes = [{ operational_code: "CH 1", scanned_sheet_link: "" }];
    expect(fichaEscaneadaDelParte("CH 1", partes)).toEqual({ estado: "parte-sin-enlace" });
    expect(fichaEscaneadaDelParte("CH 9", partes)).toEqual({ estado: "sin-parte" });
  });

  it("un nulo no se convierte en el texto «null»", () => {
    // `String(null)` es "null": el resolvedor no puede fabricar un enlace
    // abrible hacia esa palabra.
    const ficha = fichaEscaneadaDelParte("CH 1", [
      { operational_code: "CH 1", scanned_sheet_link: null },
    ]);
    expect(ficha).toEqual({ estado: "parte-sin-enlace" });
  });
});
