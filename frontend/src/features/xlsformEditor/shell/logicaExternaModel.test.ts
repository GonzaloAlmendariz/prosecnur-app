import { describe, expect, test } from "vitest";
import { ApiError } from "../../../api/core";
import {
  detalleLogicaExterna,
  mensajeDeRechazo,
  rotuloLogicaExterna,
  searchAbrirLogicaExterna,
  searchCerrarLogicaExterna,
  validarLogicaExterna,
} from "./logicaExternaModel";

describe("validarLogicaExterna", () => {
  test("el programa es obligatorio; la nota no", () => {
    expect(validarLogicaExterna({ herramienta: "  ", nota: "x" })).toEqual({
      ok: false,
      motivo: "Escribe el programa donde se hicieron.",
    });
    expect(validarLogicaExterna({ herramienta: "SPSS", nota: "" })).toEqual({ ok: true, herramienta: "SPSS", nota: "" });
  });

  test("una sugerencia escrita en otra caja vuelve a su forma canónica", () => {
    expect(validarLogicaExterna({ herramienta: " spss ", nota: " v3 " })).toEqual({ ok: true, herramienta: "SPSS", nota: "v3" });
    expect(validarLogicaExterna({ herramienta: "Python  pandas", nota: "" })).toEqual({ ok: true, herramienta: "Python pandas", nota: "" });
  });

  test("límites de longitud", () => {
    expect(validarLogicaExterna({ herramienta: "x".repeat(61), nota: "" }).ok).toBe(false);
    expect(validarLogicaExterna({ herramienta: "R", nota: "x".repeat(501) }).ok).toBe(false);
  });
});

describe("rótulos", () => {
  test("con y sin programa", () => {
    const info = { herramienta: "SPSS", nota: "", declaradaEn: "" };
    expect(rotuloLogicaExterna(info)).toBe("Lógica: fuera de Prosecnur · SPSS");
    expect(detalleLogicaExterna(info)).toBe("Fuera de Prosecnur · SPSS");
    expect(rotuloLogicaExterna({ ...info, herramienta: "" })).toBe("Lógica: fuera de Prosecnur");
  });
});

describe("dirección del diálogo", () => {
  test("abre con panel+foco y cierra quitando ambos", () => {
    const abierta = searchAbrirLogicaExterna("?seccion=formularios", "f-1");
    const params = new URLSearchParams(abierta);
    expect(params.get("panel")).toBe("logica-externa");
    expect(params.get("foco")).toBe("f-1");
    expect(params.get("seccion")).toBe("formularios");
    const cerrada = new URLSearchParams(searchCerrarLogicaExterna(abierta));
    expect(cerrada.get("panel")).toBeNull();
    expect(cerrada.get("foco")).toBeNull();
  });
});

test("mensajeDeRechazo quita el código E_* del final", () => {
  const err = new ApiError("E_LOGICA_EXTERNA_NO_DECLARADA", "Este formulario no tiene declarada la lógica hecha fuera de Prosecnur.");
  expect(mensajeDeRechazo(err, "x")).toBe("Este formulario no tiene declarada la lógica hecha fuera de Prosecnur.");
  expect(mensajeDeRechazo("raro", "por defecto")).toBe("por defecto");
});
