import { describe, expect, it } from "vitest";
import {
  enlaceParaLeer,
  enlaceParaPublicar,
  enlaceRecordado,
  hayDestinoDelLibro,
  textoDelRecordado,
} from "./destinoDelLibro";

/**
 * El destino recordado del libro: qué enlace viaja en cada acción.
 *
 * La decisión de Gonzalo es «pegar el enlace una vez y recordarlo»; estas
 * funciones son ese contrato hecho código: el escrito manda, el recordado
 * respalda, y publicar sin escribir nada significa «usa el recordado» —el
 * backend lo resuelve, así que no viaja enlace—.
 *
 * OJO locale: los textos con fecha no asertan el formato de los números
 * (`toLocaleString` degrada sin ICU); se comprueba la frase, no los dígitos.
 */

const RECORDADO = {
  spreadsheet_id: "LIBRO123",
  url: "https://docs.google.com/spreadsheets/d/LIBRO123/edit",
  updated_at: "2026-08-27T14:03:00Z",
};

describe("enlaceRecordado", () => {
  it("prefiere la URL guardada", () => {
    expect(enlaceRecordado(RECORDADO)).toBe("https://docs.google.com/spreadsheets/d/LIBRO123/edit");
  });

  it("deriva la URL canónica cuando sólo hay id", () => {
    // El mandato lo pide textual: el recordado se muestra «de libro_sheets.url
    // o el id». Un .pulso guardado por un backend viejo puede traer sólo el id.
    expect(enlaceRecordado({ spreadsheet_id: "SOLOID" }))
      .toBe("https://docs.google.com/spreadsheets/d/SOLOID/edit");
  });

  it("sin nada guardado devuelve vacío", () => {
    expect(enlaceRecordado(null)).toBe("");
    expect(enlaceRecordado(undefined)).toBe("");
    expect(enlaceRecordado({})).toBe("");
  });
});

describe("textoDelRecordado", () => {
  it("dice que está guardado y para qué sirve", () => {
    expect(textoDelRecordado(RECORDADO)).toMatch(/Guardado el .+leer y publicar/);
  });

  it("sin fecha sigue diciendo que está guardado", () => {
    expect(textoDelRecordado({ spreadsheet_id: "SOLOID" })).toMatch(/^Guardado ·/);
  });

  it("sin recordado invita a pegarlo una vez", () => {
    expect(textoDelRecordado(null)).toMatch(/P[ée]galo una vez/);
  });
});

describe("enlaceParaPublicar", () => {
  it("manda el enlace escrito, limpio de espacios", () => {
    expect(enlaceParaPublicar("  https://docs.google.com/spreadsheets/d/NUEVO/edit "))
      .toBe("https://docs.google.com/spreadsheets/d/NUEVO/edit");
  });

  it("sin nada escrito no manda enlace: el recordado lo resuelve el que publica", () => {
    // `undefined` a propósito, no "": un body con url vacía olvidaría el
    // destino en vez de usarlo.
    expect(enlaceParaPublicar("")).toBeUndefined();
    expect(enlaceParaPublicar("   ")).toBeUndefined();
  });
});

describe("enlaceParaLeer", () => {
  it("el escrito manda sobre el recordado", () => {
    expect(enlaceParaLeer("https://docs.google.com/spreadsheets/d/OTRO/edit", RECORDADO))
      .toBe("https://docs.google.com/spreadsheets/d/OTRO/edit");
  });

  it("sin escrito cae al recordado", () => {
    expect(enlaceParaLeer("", RECORDADO))
      .toBe("https://docs.google.com/spreadsheets/d/LIBRO123/edit");
  });

  it("sin ninguno devuelve vacío: no hay de dónde leer", () => {
    expect(enlaceParaLeer("", null)).toBe("");
  });
});

/**
 * **La misma invariante, en el panel gemelo del libro.**
 *
 * Los dos paneles hacen lo mismo con dos Sheets distintos, y el 2026-09-09 uno
 * falló y el otro no. El que no falló estaba bien por suerte —su guarda se
 * calculaba aparte y coincidía—, así que ahora sale del mismo módulo que decide
 * el enlace y esto lo sujeta.
 */
describe("el destino del Sheets del libro", () => {
  it("si hay destino, leer tiene de dónde", () => {
    const casos: Array<[string, { url?: string } | null]> = [
      ["https://pegado", null],
      ["", { url: "https://recordado" }],
      ["https://pegado", { url: "https://recordado" }],
      ["", null],
      ["   ", null],
    ];
    for (const [escrito, libro] of casos) {
      expect(hayDestinoDelLibro(escrito, libro)).toBe(Boolean(enlaceParaLeer(escrito, libro)));
    }
  });

  it("lo pegado manda sobre lo recordado, igual que en la distribución", () => {
    expect(enlaceParaLeer("https://nuevo", { url: "https://viejo" })).toBe("https://nuevo");
  });

  it("publicar manda `undefined` y nunca cadena vacía: un body vacío OLVIDA el destino", () => {
    expect(enlaceParaPublicar("  ")).toBeUndefined();
    expect(enlaceParaPublicar("https://x")).toBe("https://x");
  });
});
