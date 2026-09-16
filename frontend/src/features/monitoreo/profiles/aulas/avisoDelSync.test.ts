import { describe, expect, it } from "vitest";
import { avisoDelSync } from "./avisoDelSync";

/**
 * Gonzalo, 2026-09-16: «el botón de traer respuestas actualiza la data de la
 * app pero ya no actualiza el Sheets» — y en pantalla, ningún error. La
 * conversación con el libro redacta su fallo con tono de atención desde
 * siempre; lo que pasaba es que la línea siguiente lo pisaba con el aviso de
 * las fuentes, que es la noticia más inocua de las dos.
 */

const FALLO = { texto: "La publicación al Sheets no terminó: 403", tono: "atencion" as const };
const OK_LIBRO = { texto: "Se publicó el libro.", tono: "ok" as const };

describe("cuál de los dos avisos del sync se enseña", () => {
  it("un fallo del libro NO lo tapa un «sin respuestas nuevas»", () => {
    const elegido = avisoDelSync(FALLO, {
      mensaje: "Kobo EU no trajo respuestas NUEVAS…", tono: "ok",
    });
    expect(elegido).toEqual(FALLO);
  });

  it("sin nada que reportar del libro, se enseña el de las fuentes", () => {
    const elegido = avisoDelSync(null, { mensaje: "Kobo EU no trajo nada…", tono: "ok" });
    expect(elegido?.texto).toContain("no trajo nada");
    expect(elegido?.tono).toBe("ok");
  });

  it("si los DOS piden atención gana el del libro: es el que dice que algo no se hizo", () => {
    // El de las fuentes, cuando es grave, dice que lo que se ve es de antes —y
    // eso sigue siendo cierto con el otro a la vista—.
    const elegido = avisoDelSync(FALLO, {
      mensaje: "Kobo EU no devolvió ningún registro…", tono: "atencion",
    });
    expect(elegido).toEqual(FALLO);
  });

  it("un aviso de fuentes grave sí manda sobre un libro que fue bien", () => {
    // La decisión original —«manda sobre el aviso del libro porque decide si
    // las cifras son de hoy»— sigue en pie para el caso que la motivó.
    const elegido = avisoDelSync(OK_LIBRO, {
      mensaje: "Kobo EU no devolvió ningún registro…", tono: "atencion",
    });
    expect(elegido?.texto).toContain("ningún registro");
  });

  it("sin `tono` en el payload, el de fuentes se lee como atención", () => {
    // Payload de una versión anterior: se comporta como antes de que el motor
    // declarara el tono, en vez de degradarse a «ok» y tapar un fallo.
    const elegido = avisoDelSync(OK_LIBRO, { mensaje: "vino vacía" });
    expect(elegido?.tono).toBe("atencion");
  });

  it("sin ninguno de los dos no se inventa un aviso", () => {
    expect(avisoDelSync(null, null)).toBeNull();
    expect(avisoDelSync(null, { mensaje: "" })).toBeNull();
  });
});
