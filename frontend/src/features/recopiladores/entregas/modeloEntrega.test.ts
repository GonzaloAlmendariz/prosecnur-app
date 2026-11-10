import { describe, expect, it } from "vitest";

import { ApiError } from "../../../api/core";
import { archivoDesdeRespuesta } from "../../../components/entregables/archivoDesdeRespuesta";
import { archivoParaElKit, causaConPista } from "./modeloEntrega";

describe("archivoParaElKit", () => {
  it("lleva el peso de size_bytes a size, sin perder la copia junto al proyecto", () => {
    const r = archivoParaElKit({ file_id: "f1", filename: "Revision.html", size_bytes: 2048, guardado_en: "C:\\E\\Revision.html" });
    expect(r).toMatchObject({ size: 2048, size_bytes: 2048, guardado_en: "C:\\E\\Revision.html" });
    expect(archivoDesdeRespuesta(r)[0]).toMatchObject({ fileId: "f1", tamano: 2048, guardadoEn: "C:\\E\\Revision.html" });
  });

  it("no pisa un size que ya venía ni toca lo que no es un objeto", () => {
    expect(archivoParaElKit({ file_id: "f", size: 10, size_bytes: 99 })).toMatchObject({ size: 10 });
    expect(archivoParaElKit(null)).toBeNull();
    expect(archivoParaElKit({ job_id: "j" })).toEqual({ job_id: "j" });
  });
});

describe("causaConPista", () => {
  it("la falta de decisión de cobertura dice dónde se resuelve", () => {
    const e = new ApiError("E_COVERAGE_DECISION_REQUIRED", "Hay distritos sin decisión de cobertura");
    expect(causaConPista(e)).toEqual({
      causa: "Hay distritos sin decisión de cobertura. Resuélvelo en Hojas de ruta › Manzanas.",
      codigo: "E_COVERAGE_DECISION_REQUIRED",
    });
  });

  it("los demás errores pasan por el traductor común del kit", () => {
    expect(causaConPista(new ApiError("E_X", "Falla."))).toEqual({ causa: "Falla.", codigo: "E_X" });
  });
});
