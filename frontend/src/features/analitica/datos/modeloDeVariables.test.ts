import { describe, expect, it } from "vitest";

import type { SeccionConfig } from "../store";
import {
  baseComunDeCasos,
  coincideBusqueda,
  conteosDeFiltro,
  enFiltro,
  moverVariableDeSeccion,
  proporcionConDato,
  tipoDeVariable,
} from "./modeloDeVariables";

describe("tipo de la variable en castellano", () => {
  it("nombra los tipos del formulario y les da su color de tipo de pregunta", () => {
    expect(tipoDeVariable({ tipo_xlsform: "select_one yesno" })).toEqual({ nombre: "Única", tono: "unica" });
    expect(tipoDeVariable({ tipo_xlsform: "select_multiple servicios" })).toEqual({ nombre: "Múltiple", tono: "multiple" });
    expect(tipoDeVariable({ tipo_xlsform: "integer" })).toEqual({ nombre: "Numérica", tono: "numerica" });
    expect(tipoDeVariable({ tipo_xlsform: "text" })).toEqual({ nombre: "Texto", tono: "texto" });
  });

  it("no muestra el identificador del motor", () => {
    expect(tipoDeVariable({ tipo_xlsform: "start-geopoint" }).nombre).toBe("Ubicación");
    expect(tipoDeVariable({ tipo_xlsform: "" }).nombre).toBe("De la base");
    expect(tipoDeVariable({ tipo_xlsform: "data" }).nombre).toBe("De la base");
    expect(tipoDeVariable({ tipo_xlsform: "dummy_select_multiple" })).toEqual({ nombre: "Opción de múltiple", tono: "multiple" });
    expect(tipoDeVariable({ tipo_xlsform: "text", dummy_parent: "D1" }).nombre).toBe("Opción de múltiple");
    expect(tipoDeVariable({ tipo_xlsform: "algo_nuevo" }).nombre).toBe("Otro tipo");
  });
});

describe("filtros de la lista", () => {
  const estados = [
    { incluida: true, porConfirmar: false },
    { incluida: true, porConfirmar: true },
    { incluida: false, porConfirmar: false },
  ];

  it("cada conteo es lo que se ve al elegir el filtro", () => {
    const conteos = conteosDeFiltro(estados);
    expect(conteos).toEqual({ todas: 3, incluidas: 2, excluidas: 1, "por-confirmar": 1 });
    for (const filtro of ["todas", "incluidas", "excluidas", "por-confirmar"] as const) {
      expect(estados.filter((e) => enFiltro(e, filtro)).length).toBe(conteos[filtro]);
    }
  });

  it("busca por código o por etiqueta sin tildes ni mayúsculas", () => {
    expect(coincideBusqueda("p12", "Satisfacción con la formación", "satisfaccion")).toBe(true);
    expect(coincideBusqueda("p12", "Satisfacción", "P1")).toBe(true);
    expect(coincideBusqueda("p12", "Satisfacción", "docencia")).toBe(false);
    expect(coincideBusqueda("p12", "Satisfacción", "  ")).toBe(true);
  });
});

describe("con dato", () => {
  it("la base va en el encabezado solo si todas las variables que llegaron cuentan sobre los mismos casos", () => {
    expect(baseComunDeCasos([
      { n_non_missing: 112, n_missing: 3 },
      { n_non_missing: 0, n_missing: 0 },
      { n_non_missing: 115, n_missing: 0 },
    ])).toBe(115);
    expect(baseComunDeCasos([
      { n_non_missing: 112, n_missing: 3 },
      { n_non_missing: 400, n_missing: 20 },
    ])).toBeNull();
    expect(baseComunDeCasos([{ n_non_missing: 0, n_missing: 0 }])).toBeNull();
  });

  it("la barra mide la proporción con dato de sus propios casos", () => {
    expect(proporcionConDato({ n_non_missing: 87, n_missing: 28 })).toBe(76);
    expect(proporcionConDato({ n_non_missing: 0, n_missing: 0 })).toBe(0);
  });
});

describe("cambio de sección", () => {
  const secciones: SeccionConfig[] = [
    { id: "a", nombre: "A", variables: ["p1", "p2"], oculto: false, orden: 0 },
    { id: "b", nombre: "B", variables: ["p3"], oculto: false, orden: 1 },
  ];

  it("saca la variable de su sección y la pone al final de la de destino", () => {
    const movidas = moverVariableDeSeccion(secciones, "p1", "b");
    expect(movidas.map((s) => s.variables)).toEqual([["p2"], ["p3", "p1"]]);
    expect(movidas.every((s) => s.manual)).toBe(true);
  });

  it("con un destino que no existe deja las secciones igual", () => {
    expect(moverVariableDeSeccion(secciones, "p1", "zz")).toEqual(secciones);
  });

  it("una variable sin sección entra a la de destino", () => {
    const movidas = moverVariableDeSeccion(secciones, "p9", "a");
    expect(movidas[0].variables).toEqual(["p1", "p2", "p9"]);
    expect(movidas[1]).toBe(secciones[1]);
  });
});
