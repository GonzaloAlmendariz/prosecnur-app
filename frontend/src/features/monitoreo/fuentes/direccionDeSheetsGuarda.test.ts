import { describe, expect, it } from "vitest";

import { leerDireccionDeSheets } from "./direccionDeFuente";

/**
 * **La guarda del botón y el módulo que decide tienen que decir lo mismo.**
 *
 * El registro de fuentes del telefónico encendía «Leer pestañas» con
 * `!spreadsheetId.trim()` —o sea, «hay texto»— mientras `leerDireccionDeSheets`
 * ya sabía si eso era un Sheet y tenía escrito el motivo por el que no. Pegar
 * cualquier cosa dejaba el botón activo, la llamada salía y el error venía del
 * backend sin decir qué arreglar, con el mensaje bueno guardado en una variable
 * que sólo se usaba para construir un enlace.
 *
 * Es el mismo patrón que el 2026-09-09 dejó «pega su enlace una vez» con el
 * enlace ya pegado, en el perfil de aulas. Lo que se sujeta aquí es la
 * invariante: si el botón se enciende, hay identificador que mandar.
 */
describe("qué enciende el botón de leer un Sheet", () => {
  const CASOS = [
    "https://docs.google.com/spreadsheets/d/1V9Tjh_suREXNEyZ8Za/edit#gid=0",
    "1V9TjhsuREXNEyZ8ZaAAAAAAAAAAAAAAA",
    "hola",
    "https://ejemplo.com/algo",
    "https://docs.google.com/document/d/abc/edit",
    "   ",
    "",
  ];

  it("si la lectura dice que sí, hay identificador que mandar", () => {
    for (const texto of CASOS) {
      const l = leerDireccionDeSheets(texto);
      if (l.ok) {
        expect(l.servicio).toBe("google_sheets");
        expect(String((l as { spreadsheetId: string }).spreadsheetId)).not.toBe("");
      }
    }
  });

  it("un texto cualquiera NO es un destino, aunque no esté vacío", () => {
    // Ésta es la diferencia con `!texto.trim()`, que era la guarda vieja.
    expect(leerDireccionDeSheets("hola").ok).toBe(false);
    expect("hola".trim()).not.toBe("");
  });

  it("cada rechazo trae un motivo que se puede enseñar", () => {
    for (const texto of ["hola", "https://ejemplo.com/algo", "", "   "]) {
      const l = leerDireccionDeSheets(texto);
      expect(l.ok).toBe(false);
      if (!l.ok) {
        expect(l.mensaje.length).toBeGreaterThan(10);
        expect(l.motivo).toBeTruthy();
      }
    }
  });

  it("una dirección de Google que no es hoja lo dice con su propio motivo", () => {
    const l = leerDireccionDeSheets("https://docs.google.com/document/d/abc/edit");
    expect(l.ok).toBe(false);
    if (!l.ok) expect(l.motivo).toBe("sin_identificador");
  });
});
