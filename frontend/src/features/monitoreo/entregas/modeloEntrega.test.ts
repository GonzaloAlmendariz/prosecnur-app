/**
 * Lo que Monitoreo agrega al kit de entregables (ADR 0133, fase 5): el archivo
 * anidado del XLSForm de ocurrencias y los archivos que acompañan al principal.
 */
import { describe, expect, it } from "vitest";
import { archivoDesdeRespuesta } from "../../../components/entregables/archivoDesdeRespuesta";
import { archivoAnidado, archivosSueltos } from "./modeloEntrega";

describe("archivoAnidado", () => {
  it("sube el archivo de `file` a la raíz con su nombre y sus campos del entregable", () => {
    const respuesta = {
      ok: true,
      state: { x: 1 },
      file: { file_id: "x1", original_name: "ocurrencias.xlsx", size: 900, guardado_en: "C:\\E\\Entregables\\Monitoreo\\ocurrencias.xlsx" },
    };
    const [archivo] = archivoDesdeRespuesta(archivoAnidado(respuesta));
    expect(archivo).toMatchObject({ fileId: "x1", nombre: "ocurrencias.xlsx", formato: "xlsx", tamano: 900, guardadoEn: "C:\\E\\Entregables\\Monitoreo\\ocurrencias.xlsx" });
  });

  it("sin `file` con file_id, devuelve la respuesta tal cual", () => {
    const respuesta = { ok: true, file: { original_name: "x.xlsx" } };
    expect(archivoAnidado(respuesta)).toBe(respuesta);
    expect(archivoAnidado(null)).toBeNull();
  });
});

describe("archivosSueltos", () => {
  it("en el orden y con el rótulo pedidos, sólo los que llegaron con file_id", () => {
    const files = {
      b: { file_id: "fb", filename: "b.csv" },
      a: { file_id: "fa", original_name: "a.json" },
      c: { file_id: "", filename: "c.md" },
    };
    expect(archivosSueltos(files, [["a", "A"], ["b", "B"], ["c", "C"], ["d", "D"]])).toEqual([
      { clave: "a", rotulo: "A", fileId: "fa", nombre: "a.json" },
      { clave: "b", rotulo: "B", fileId: "fb", nombre: "b.csv" },
    ]);
    expect(archivosSueltos(undefined, [["a", "A"]])).toEqual([]);
  });
});
