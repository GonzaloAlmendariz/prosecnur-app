import { describe, expect, it } from "vitest";
import { normalizeEstiloCliente } from "../../../api/graficosEstilo";
import { conAntetituloSeccion, leerAntetituloSeccion } from "./SeccionAntetitulo";

describe("nombre de la sección sobre el título", () => {
  it("apagado por defecto y apagado no se guarda", () => {
    expect(leerAntetituloSeccion({})).toBe(false);
    const on = conAntetituloSeccion({ version: 1 }, true);
    expect(on).toEqual({ version: 1, antetitulo_seccion: true });
    expect(conAntetituloSeccion(on, false)).toEqual({ version: 1 });
  });
  it("sobrevive al normalizador, también como vector de largo 1", () => {
    expect(leerAntetituloSeccion(normalizeEstiloCliente({ antetitulo_seccion: true }))).toBe(true);
    expect(leerAntetituloSeccion(normalizeEstiloCliente({ antetitulo_seccion: [true] }))).toBe(true);
  });
});
