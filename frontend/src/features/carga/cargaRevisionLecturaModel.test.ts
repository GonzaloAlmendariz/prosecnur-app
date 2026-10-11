import { describe, expect, it } from "vitest";
import { cargaWorkspaceItems, type CargaWorkspaceContext } from "./CargaWorkspaceModel";
import {
  CARGA_REVISION_SIN_LEER,
  baseRevisadaElegida,
  cargaRevisionEstadoLectura,
  type CargaRevisionLecturaEntrada,
} from "./cargaRevisionLecturaModel";

const BASES = ["docentes", "administrativos", "estudiantes"];

function multibase(parcial: Partial<CargaRevisionLecturaEntrada>): CargaRevisionLecturaEntrada {
  return {
    isMultiBase: true,
    baseSeleccionada: "docentes",
    basesPrimarias: BASES,
    insumosListos: true,
    universoBase: "docentes",
    lectura: CARGA_REVISION_SIN_LEER,
    ...parcial,
  };
}

describe("cargaRevisionEstadoLectura", () => {
  it("multibase: no está lista hasta leer revisión, resumen y universo de la base elegida", () => {
    expect(cargaRevisionEstadoLectura(multibase({}))).toEqual({ datosLeidos: false, completa: false });
    // Solo la revisión: falta el resumen del estudio («Verificando todas las bases»).
    expect(cargaRevisionEstadoLectura(multibase({
      lectura: { revision: "docentes", resumen: false, universo: "docentes" },
    }))).toEqual({ datosLeidos: false, completa: false });
    // Revisión y resumen, pero el universo sigue «Leyendo configuración de la base…».
    expect(cargaRevisionEstadoLectura(multibase({
      lectura: { revision: "docentes", resumen: true, universo: null },
    }))).toEqual({ datosLeidos: true, completa: false });
    expect(cargaRevisionEstadoLectura(multibase({
      lectura: { revision: "docentes", resumen: true, universo: "docentes" },
    }))).toEqual({ datosLeidos: true, completa: true });
  });

  it("al cambiar de base, lo leído para la anterior no cuenta", () => {
    const leidoDocentes = { revision: "docentes", resumen: true, universo: "docentes" };
    expect(cargaRevisionEstadoLectura(multibase({
      baseSeleccionada: "estudiantes",
      universoBase: "estudiantes",
      lectura: leidoDocentes,
    }))).toEqual({ datosLeidos: false, completa: false });
  });

  it("una base fuera del selector nunca está lista; sin bases, el vacío es el resultado", () => {
    expect(cargaRevisionEstadoLectura(multibase({ baseSeleccionada: "", universoBase: null }))).toEqual({ datosLeidos: false, completa: false });
    expect(cargaRevisionEstadoLectura(multibase({ basesPrimarias: [], baseSeleccionada: "", universoBase: null })))
      .toEqual({ datosLeidos: true, completa: true });
  });

  it("base única: sin insumos no hay revisión que esperar; con insumos, la de la base heredada", () => {
    const unica: CargaRevisionLecturaEntrada = {
      isMultiBase: false,
      baseSeleccionada: "",
      basesPrimarias: [],
      insumosListos: false,
      universoBase: null,
      lectura: CARGA_REVISION_SIN_LEER,
    };
    expect(cargaRevisionEstadoLectura(unica)).toEqual({ datosLeidos: true, completa: true });
    const conInsumos = { ...unica, insumosListos: true, universoBase: "" };
    expect(cargaRevisionEstadoLectura(conInsumos)).toEqual({ datosLeidos: false, completa: false });
    // No necesita el resumen multibase.
    expect(cargaRevisionEstadoLectura({ ...conInsumos, lectura: { revision: "", resumen: false, universo: "" } }))
      .toEqual({ datosLeidos: true, completa: true });
  });
});

describe("baseRevisadaElegida", () => {
  it("la base del enlace manda, para que al recargar el selector y el panel coincidan", () => {
    expect(baseRevisadaElegida({ actual: "", basesPrimarias: BASES, baseDeLaDireccion: "estudiantes", baseActiva: "docentes" }))
      .toBe("estudiantes");
    expect(baseRevisadaElegida({ actual: "docentes", basesPrimarias: BASES, baseDeLaDireccion: "estudiantes", baseActiva: null }))
      .toBe("estudiantes");
  });

  it("sin enlace (o con una base que no existe) conserva la elección, luego la activa, luego la primera", () => {
    expect(baseRevisadaElegida({ actual: "administrativos", basesPrimarias: BASES, baseDeLaDireccion: "fantasma", baseActiva: "docentes" }))
      .toBe("administrativos");
    expect(baseRevisadaElegida({ actual: "", basesPrimarias: BASES, baseDeLaDireccion: null, baseActiva: "estudiantes" }))
      .toBe("estudiantes");
    expect(baseRevisadaElegida({ actual: "", basesPrimarias: BASES, baseDeLaDireccion: null, baseActiva: null }))
      .toBe("docentes");
    expect(baseRevisadaElegida({ actual: "x", basesPrimarias: [], baseDeLaDireccion: null, baseActiva: null })).toBe("");
  });
});

describe("pestaña Revisión mientras lee", () => {
  const contexto: CargaWorkspaceContext = {
    hasInstrument: true,
    hasData: true,
    hasBase: true,
    hasReviewIssues: false,
    isMultiBase: true,
    baseCount: 3,
    instrumentBaseCount: 3,
    dataBaseCount: 3,
  };
  const revision = (ctx: CargaWorkspaceContext) => cargaWorkspaceItems(ctx).find((item) => item.key === "revision");

  it("no afirma «Listo» ni «Sin incidencias» sin el resultado", () => {
    const leyendo = revision({ ...contexto, revisionLeyendo: true });
    expect(leyendo?.state).toBe("neutral");
    expect(leyendo?.statusLabel).toBe("Revisando…");
    expect(leyendo?.description).not.toMatch(/No hay incidencias/);
    // Aunque el estado viejo traiga incidencias, mientras lee no las atribuye a la base nueva.
    expect(revision({ ...contexto, revisionLeyendo: true, hasReviewIssues: true })?.state).toBe("neutral");
  });

  it("con el resultado leído vuelve a decir lo que sabe", () => {
    expect(revision({ ...contexto, revisionLeyendo: false })?.statusLabel).toBe("Listo");
    expect(revision({ ...contexto, hasReviewIssues: true })?.state).toBe("attention");
  });
});
