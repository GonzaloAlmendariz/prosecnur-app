/**
 * Archivo armado en el front (ADR 0133, fase 5): el CSV que reemplaza a las
 * copias locales de `descargarCsv` / `downloadRowsAsCsv` y su lectura por el
 * contenedor.
 */
import { describe, expect, it } from "vitest";
import {
  ArchivoLocal, archivoCsv, archivoDesdeLocal, archivoJson, archivoTexto, celdaCsv, csvDeFilas, esArchivoLocal, estudioDelNombre,
  fechaDelNombre, nombreDelEntregable, segmentoDelNombre,
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

describe("nombre de un archivo armado en el front (ADR 0133 §3)", () => {
  const fecha = new Date(2026, 10, 10);

  it("segmentoDelNombre translitera como el motor: tildes y ñ fuera, lo demás a _ sin repetir ni en los bordes", () => {
    expect(segmentoDelNombre("Plantilla de analítica")).toBe("Plantilla_de_analitica");
    expect(segmentoDelNombre("  Guía del plan de informe  ")).toBe("Guia_del_plan_de_informe");
    expect(segmentoDelNombre("Año Niño / Señal (2026)")).toBe("Ano_Nino_Senal_2026");
    expect(segmentoDelNombre("--__--")).toBe("");
    expect(segmentoDelNombre(null)).toBe("");
  });

  it("estudioDelNombre: el código de la Ficha; sin código, el nombre del .pulso; sin nada, Prosecnur", () => {
    expect(estudioDelNombre("acnur_acg", "/Users/ana/acnur.pulso")).toBe("acnur_acg");
    expect(estudioDelNombre("HSVG 2026", null)).toBe("HSVG_2026");
    expect(estudioDelNombre("", "C:\\Estudios\\Perfil CCSS.pulso")).toBe("Perfil_CCSS");
    expect(estudioDelNombre("  ", "/Users/ana/Estudios/ucsm_2026.pulso")).toBe("ucsm_2026");
    expect(estudioDelNombre(null, null)).toBe("Prosecnur");
  });

  it("nombreDelEntregable arma <Estudio>_<Entregable>_<dd_mm_yy>.<ext> con mayúscula inicial", () => {
    expect(nombreDelEntregable({ estudio: "acnur_acg", entregable: "Plantilla de analítica", extension: "json", fecha }))
      .toBe("acnur_acg_Plantilla_de_analitica_10_11_26.json");
    expect(nombreDelEntregable({ estudio: "acnur_acg", entregable: "guía del plan de informe", extension: ".md", fecha }))
      .toBe("acnur_acg_Guia_del_plan_de_informe_10_11_26.md");
    expect(nombreDelEntregable({ estudio: "acnur_acg", entregable: "Matriz poblacional", detalle: "por zona", extension: "csv", fecha }))
      .toBe("acnur_acg_Matriz_poblacional_por_zona_10_11_26.csv");
    expect(nombreDelEntregable({ estudio: "", entregable: "", extension: "", fecha })).toBe("Prosecnur_Archivo_10_11_26.bin");
  });

  it("el nombre sin extensión no pasa de 80: cede el detalle primero, luego el entregable; estudio y fecha quedan", () => {
    const largo = nombreDelEntregable({
      estudio: "acnur_acg", entregable: "Matriz poblacional", detalle: "x".repeat(120), extension: "csv", fecha,
    });
    const tronco = largo.replace(/\.csv$/, "");
    expect(tronco.length).toBeLessThanOrEqual(80);
    expect(tronco.startsWith("acnur_acg_Matriz_poblacional_x")).toBe(true);
    expect(tronco.endsWith("_10_11_26")).toBe(true);
    const sinDetalle = nombreDelEntregable({ estudio: "acnur_acg", entregable: "y".repeat(120), extension: "md", fecha });
    expect(sinDetalle.replace(/\.md$/, "").length).toBeLessThanOrEqual(80);
    expect(sinDetalle.startsWith("acnur_acg_Y")).toBe(true);
    expect(sinDetalle.endsWith("_10_11_26.md")).toBe(true);
  });
});
