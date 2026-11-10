/**
 * Archivo armado en el front (ADR 0133, fase 5): el CSV que reemplaza a las
 * copias locales de `descargarCsv` / `downloadRowsAsCsv` y su lectura por el
 * contenedor.
 */
import { describe, expect, it } from "vitest";
import {
  ArchivoLocal, archivoCsv, archivoDesdeLocal, archivoJson, archivoTexto, celdaCsv, csvDeFilas, esArchivoLocal, fechaDelNombre,
} from "./archivoLocal";

describe("archivoCsv", () => {
  it("lleva la marca UTF-8 para que Excel lea las tildes y el tipo text/csv", async () => {
    const local = archivoCsv("Nombre\nMaría", "personas.csv");
    expect(local.nombre).toBe("personas.csv");
    expect(local.blob.type).toBe("text/csv;charset=utf-8");
    const bytes = new Uint8Array(await local.blob.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  });

  it("un nombre vacío no deja el archivo sin nombre", () => {
    expect(new ArchivoLocal(new Blob(["x"]), "  ").nombre).toBe("Entregable");
  });
});

describe("csvDeFilas", () => {
  it("columnas en el orden en que aparecen, sin las internas, y celdas entre comillas", () => {
    const csv = csvDeFilas([
      { Responsable: "Ana \"la jefa\"", Efectivas: 3, _interna: "x" },
      { Responsable: "Luis", Objetivo: 2 },
    ]);
    expect(csv.split("\n")).toEqual([
      "Responsable,Efectivas,Objetivo",
      "\"Ana \"\"la jefa\"\"\",\"3\",\"\"",
      "\"Luis\",\"\",\"2\"",
    ]);
  });

  it("respeta el tope de columnas", () => {
    expect(csvDeFilas([{ a: 1, b: 2, c: 3 }], 2).split("\n")[0]).toBe("a,b");
  });

  it("sin filas, sólo una cabecera vacía", () => {
    expect(csvDeFilas([])).toBe("");
  });

  it("celdaCsv: nulos como vacío", () => {
    expect(celdaCsv(null)).toBe("\"\"");
    expect(celdaCsv(undefined)).toBe("\"\"");
  });
});

describe("archivoDesdeLocal", () => {
  it("se lee como un archivo del contenedor, con id propio, peso y sin copia junto al proyecto", () => {
    const local = archivoCsv("a", "UMP.csv");
    const a = archivoDesdeLocal(local);
    const b = archivoDesdeLocal(local);
    expect(a).toMatchObject({ nombre: "UMP.csv", formato: "csv", guardadoEn: null, avisoGuardado: null, local: local.blob });
    expect(a.tamano).toBe(local.blob.size);
    expect(a.fileId).not.toBe(b.fileId);
  });

  it("esArchivoLocal no confunde la respuesta del backend", () => {
    expect(esArchivoLocal(archivoCsv("a", "x.csv"))).toBe(true);
    expect(esArchivoLocal({ blob: new Blob(["a"]), nombre: "x.csv" })).toBe(false);
    expect(esArchivoLocal({ file_id: "f1" })).toBe(false);
  });
});

describe("archivoJson y archivoTexto", () => {
  it("el JSON sale con sangría y tipo application/json", async () => {
    const local = archivoJson({ a: 1, b: ["x"] }, "plantilla.json");
    expect(local.blob.type).toBe("application/json");
    expect(await local.blob.text()).toBe('{\n  "a": 1,\n  "b": [\n    "x"\n  ]\n}');
    expect(archivoDesdeLocal(local).formato).toBe("json");
  });

  it("el texto conserva su contenido y el tipo que se le pasa", async () => {
    const local = archivoTexto("# Guía", "guia.md", "text/markdown;charset=utf-8");
    expect(local.blob.type).toBe("text/markdown;charset=utf-8");
    expect(await local.blob.text()).toBe("# Guía");
  });
});

describe("fechaDelNombre", () => {
  it("dd_mm_yy, como los nombres del motor", () => {
    expect(fechaDelNombre(new Date(2026, 10, 7))).toBe("07_11_26");
    expect(fechaDelNombre(new Date(2031, 0, 31))).toBe("31_01_31");
  });
});
