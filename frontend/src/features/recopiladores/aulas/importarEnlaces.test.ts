// El parser del pegado manual es donde el operador puede perder trabajo sin
// darse cuenta: pega 300 filas de una hoja ajena y entran 280. Estos tests fijan
// las decisiones que evitan eso.

import { describe, expect, it } from "vitest";
import type { MonitoreoAulasPlanRow } from "../../../api/client";
import { applyManualLinks, parseLinkClipboard, splitImportLine } from "./importarEnlaces";

const fila = (extra: Partial<MonitoreoAulasPlanRow> = {}): MonitoreoAulasPlanRow =>
  ({ classroom_id: "MAT146-0205", operational_code: "MAT146-0205", ...extra }) as MonitoreoAulasPlanRow;

describe("splitImportLine", () => {
  it("prefiere el tab sobre el punto y coma y la coma", () => {
    // Un nombre de curso con comas es normal; si la coma ganara, la fila se
    // partiría en pedazos donde el tab ya decía dónde estaban las columnas.
    expect(splitImportLine("a\tb, c\td")).toEqual(["a", "b, c", "d"]);
    expect(splitImportLine("a;b,c")).toEqual(["a", "b,c"]);
    expect(splitImportLine("a,b")).toEqual(["a", "b"]);
  });
});

describe("parseLinkClipboard", () => {
  it("no devuelve nada sobre un pegado vacío", () => {
    expect(parseLinkClipboard("   \n\n  ")).toEqual({ records: [], ignored: 0 });
  });

  it("con cabecera lee por nombre y no por posición", () => {
    const { records, ignored } = parseLinkClipboard(
      ["cursohorario\tpdflink\tqrlink", "MAT146-0205\thttps://d/pdf\thttps://d/qr"].join("\n"),
    );
    expect(ignored).toBe(0);
    // El orden pegado es pdf antes que qr: si se leyera por posición, el pdf
    // terminaría en el campo del qr.
    expect(records[0]).toMatchObject({ key: "MAT146-0205", pdf: "https://d/pdf", qr: "https://d/qr" });
    // Ninguna columna se adivina: `enlace` no venía en la cabecera.
    expect(records[0].surveyLink).toBe("");
  });

  it("sin cabecera toma la primera columna como clave y la primera URL como enlace", () => {
    const { records } = parseLinkClipboard("MAT146-0205\tsin url\thttps://encuesta/a");
    expect(records).toEqual([
      { key: "MAT146-0205", surveyLink: "https://encuesta/a", qr: "", word: "", pdf: "", sample: "" },
    ]);
  });

  it("cuenta como ignorada la fila sin clave y la que no trae ningún enlace", () => {
    const { records, ignored } = parseLinkClipboard(
      [
        "cursohorario\tenlace",
        "\thttps://encuesta/sin-clave",
        "MAT146-0205\t",
        "FIS100-0101\thttps://encuesta/ok",
      ].join("\n"),
    );
    expect(records).toHaveLength(1);
    expect(records[0].key).toBe("FIS100-0101");
    // Reportar el descarte es el punto: en silencio, el operador cree que entraron 3.
    expect(ignored).toBe(2);
  });

  it("reconoce la cabecera por cualquiera de sus alias", () => {
    const { records } = parseLinkClipboard(["documentid;url", "A-1;https://x/1"].join("\n"));
    expect(records[0]).toMatchObject({ key: "A-1", surveyLink: "https://x/1" });
  });
});

describe("applyManualLinks", () => {
  it("empareja ignorando tildes, mayúsculas y separadores", () => {
    const links = new Map([
      ["mat1460205", { key: "MAT146_0205", surveyLink: "https://x/1", qr: "", word: "", pdf: "", sample: "" }],
    ]);
    const [out] = applyManualLinks([fila()], links);
    expect(out.link).toBe("https://x/1");
  });

  it("una celda vacía no borra lo que la fila ya tenía", () => {
    const links = new Map([
      ["mat1460205", { key: "MAT146-0205", surveyLink: "", qr: "https://x/qr", word: "", pdf: "", sample: "" }],
    ]);
    const [out] = applyManualLinks([fila({ link: "https://previo" })], links);
    expect(out.link).toBe("https://previo");
    expect(out.qr).toBe("https://x/qr");
  });

  it("marca la procedencia del enlace pegado", () => {
    const links = new Map([
      ["mat1460205", { key: "MAT146-0205", surveyLink: "https://x/1", qr: "", word: "", pdf: "", sample: "" }],
    ]);
    const [out] = applyManualLinks([fila()], links);
    expect(out.manual_link_source).toBe("pegado");
  });

  it("devuelve las filas intactas si no hay nada pegado", () => {
    const filas = [fila()];
    expect(applyManualLinks(filas, new Map())).toBe(filas);
  });
});
