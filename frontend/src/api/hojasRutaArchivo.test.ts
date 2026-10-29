import { expect, test } from "vitest";
import { normalizarArchivo } from "./hojasRuta";

test("el archivo generado de la hoja se normaliza aunque falten campos (U15)", () => {
  expect(normalizarArchivo({ file_id: "f1", filename: "hoja.png", formato: "png", id_manzana: "m" }, "png")).toMatchObject({ file_id: "f1", formato: "png", id_manzana: "m" });
  expect(normalizarArchivo({ file_id: "f2", formato: "docx" }, "pdf")).toMatchObject({ file_id: "f2", filename: "", formato: "pdf" });
  expect(normalizarArchivo(null, "pdf")).toMatchObject({ file_id: "", formato: "pdf" });
});
