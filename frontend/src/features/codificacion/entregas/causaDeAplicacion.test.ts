// El error de un trabajo de Aplicar no llega crudo: se dice en castellano, con su causa y qué hacer.
import { describe, expect, it } from "vitest";
import { causaDeAplicacion } from "./causaDeAplicacion";

const CRUDO =
  "! in callr subprocess.\nCaused by error:\n! [Recodificación] En la plantilla (hoja 'comentario_open'), los códigos nuevos de 'comentario_open_recod' deben declararse en 'nuevo_codigo'/'nueva_etiqueta'.";

describe("causaDeAplicacion", () => {
  it("traduce el error de códigos nuevos sin declarar y dice qué hacer", () => {
    const t = causaDeAplicacion(CRUDO);
    expect(t).toContain("comentario_open");
    expect(t).toContain("Codificar");
    expect(t).toContain("La base no cambió");
    expect(t).not.toMatch(/callr|Caused by|nuevo_codigo|plantilla|\[Recodificación\]|^!/);
  });

  it("un error que no conoce no se muestra crudo: dice que la base no cambió y qué hacer", () => {
    const t = causaDeAplicacion("! in callr subprocess.\nCaused by error in `f()`:\n! object 'x' not found");
    expect(t).not.toMatch(/callr|Caused by|object 'x'/);
    expect(t).toContain("La base no cambió");
  });

  it("sin texto también da una causa", () => {
    expect(causaDeAplicacion("")).toContain("La base no cambió");
  });
});
