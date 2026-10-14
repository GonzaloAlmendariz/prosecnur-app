import { describe, expect, it } from "vitest";
import type { FormularioPublicado, VistaPreviaFormularioPublicado } from "../../../api/cargaFormularioPublicado";
import {
  ESTADO_INICIAL,
  contadoresVistaPrevia,
  detallesFormulario,
  fuentesDisponibles,
  nombreBaseSugerido,
  puedeCrear,
  puedePrevisualizar,
  reducirFlujo,
  veredictoVistaPrevia,
  rotuloBaseDeclarada,
  vinculoFormularioDeBase,
} from "./formularioPublicadoModel";

const ARTE: FormularioPublicado = {
  form_id: "f1",
  form_name: "Estudiantes — Arte 2026",
  revision_id: "rev-3",
  revision_no: 3,
  published_at: "",
  survey_id: "5001",
  campanas: [{ survey_id: "5002", titulo: "Correo" }],
  logic_status: "external_declared",
  logic_external: true,
  logic_external_herramienta: "R",
  n_campos: 42,
};

const VP: VistaPreviaFormularioPublicado = {
  n_filas: 120,
  fuentes: [],
  n_emparejadas: 38,
  n_variables_instrumento: 42,
  cobertura: 38 / 42,
  cobertura_texto: "",
  sin_par_instrumento: [{ variable: "p40", etiqueta: "" }],
  sin_par_fuente: [],
  recodificaciones: [{ variable: "p10_1", etiqueta: "SIN INF", desde: "5", hacia: "99" }],
  opciones_sin_par: [{ variable: "p12", n: 3, etiquetas: [] }, { variable: "p13", n: 2, etiquetas: [] }],
  bloqueo: null,
};

describe("rótulos", () => {
  it("describe el formulario con campos, campañas y lógica externa", () => {
    expect(detallesFormulario(ARTE)).toEqual(["42 campos", "1 campaña", "Lógica: fuera de Prosecnur · SPSS"]);
  });

  it("SurveyMonkey sólo se ofrece si la revisión trae su encuesta", () => {
    expect(fuentesDisponibles(ARTE)).toEqual(["surveymonkey", "sav", "excel"]);
    expect(fuentesDisponibles({ ...ARTE, survey_id: "" })).toEqual(["sav", "excel"]);
    expect(fuentesDisponibles(null)).toEqual([]);
  });

  it("sugiere un nombre de base válido desde el formulario", () => {
    expect(nombreBaseSugerido("Estudiantes — Arte 2026")).toBe("estudiantes_arte_2026");
    expect(nombreBaseSugerido("Docentes $ TP")).toBe("docentes_tp");
  });
});

describe("veredicto", () => {
  it("sobre el 80 % está listo y cuenta lo que calza", () => {
    const v = veredictoVistaPrevia(VP);
    expect(v.nivel).toBe("listo");
    expect(v.porcentaje).toBe(90);
    expect(v.detalle).toContain("38 de 42 preguntas del formulario tienen datos");
  });

  it("bajo el 80 % bloquea aunque el backend no mande bloqueo", () => {
    const v = veredictoVistaPrevia({ ...VP, cobertura: 0.5 });
    expect(v.nivel).toBe("bloqueado");
    expect(v.detalle).toContain("80 %");
  });

  it("el mensaje del bloqueo del backend manda", () => {
    expect(veredictoVistaPrevia({ ...VP, bloqueo: { codigo: "E_FUENTE_NO_CALZA", mensaje: "Esa base no es de este formulario" } }).detalle)
      .toBe("Esa base no es de este formulario");
  });

  it("los contadores suman las opciones sin par por variable", () => {
    expect(contadoresVistaPrevia(VP).map((c) => c.valor)).toEqual([1, 0, 5]);
  });
});

describe("vínculo de la base", () => {
  it("nombra el formulario y la revisión desde el catálogo", () => {
    expect(vinculoFormularioDeBase({ instrument_revision_id: "rev-3" }, [ARTE]))
      .toEqual({ formulario: "Estudiantes — Arte 2026", revision: "revisión 3", logicaExterna: true, herramienta: "R" });
  });

  it("una revisión que ya no es la última no pierde el vínculo", () => {
    expect(vinculoFormularioDeBase({ instrument_revision_id: "rev-1" }, [ARTE]))
      .toEqual({ formulario: "Formulario publicado", revision: "revisión publicada", logicaExterna: false, herramienta: "" });
  });

  it("el rótulo nombra el programa declarado en la base, no uno fijo", () => {
    const v = vinculoFormularioDeBase({ instrument_revision_id: "rev-3", origen_externo: { herramienta: "Stata" } } as never, [ARTE]);
    expect(v && rotuloBaseDeclarada(v)).toBe("Base limpia declarada (Stata)");
    expect(rotuloBaseDeclarada({ herramienta: "" })).toBe("Base limpia declarada");
  });

  it("sin revisión no hay vínculo", () => {
    expect(vinculoFormularioDeBase({ instrument_revision_id: "" }, [ARTE])).toBeNull();
  });
});

describe("reductor del flujo", () => {
  it("elegir formulario propone el nombre; cambiar de fuente invalida la vista previa", () => {
    let e = reducirFlujo(ESTADO_INICIAL, { tipo: "formulario", revisionId: "rev-3", nombreSugerido: "arte" });
    expect(e.nombreBase).toBe("arte");
    e = reducirFlujo(e, { tipo: "fuente", fuente: "surveymonkey" });
    expect(puedePrevisualizar(e)).toBe(true);
    e = reducirFlujo(e, { tipo: "previsualizando" });
    expect(puedePrevisualizar(e)).toBe(false);
    e = reducirFlujo(e, { tipo: "vistaPrevia", vistaPrevia: VP });
    expect(puedeCrear(e, null)).toBe(true);
    e = reducirFlujo(e, { tipo: "fuente", fuente: "sav" });
    expect(e.vistaPrevia).toBeNull();
    expect(puedePrevisualizar(e)).toBe(false); // falta el archivo
    e = reducirFlujo(e, { tipo: "subido", archivo: { file_id: "f", nombre: "arte.sav" } });
    expect(puedePrevisualizar(e)).toBe(true);
  });

  it("un nombre tocado sobrevive al cambio de formulario", () => {
    let e = reducirFlujo(ESTADO_INICIAL, { tipo: "formulario", revisionId: "rev-3", nombreSugerido: "arte" });
    e = reducirFlujo(e, { tipo: "nombre", nombre: "mio" });
    e = reducirFlujo(e, { tipo: "formulario", revisionId: "rev-9", nombreSugerido: "docentes" });
    expect(e.nombreBase).toBe("mio");
  });

  it("no se crea con bloqueo ni con nombre inválido", () => {
    const base = reducirFlujo({ ...ESTADO_INICIAL, revisionId: "r", fuente: "excel" }, { tipo: "vistaPrevia", vistaPrevia: VP });
    expect(puedeCrear(base, "Ya hay una base con ese nombre.")).toBe(false);
    const bloq = reducirFlujo(base, { tipo: "vistaPrevia", vistaPrevia: { ...VP, cobertura: 0.4 } });
    expect(puedeCrear(bloq, null)).toBe(false);
  });

  it("un error permite reintentar la vista previa", () => {
    let e = reducirFlujo({ ...ESTADO_INICIAL, revisionId: "r", fuente: "surveymonkey" }, { tipo: "error", mensaje: "falló" });
    expect(e.error).toBe("falló");
    e = reducirFlujo(e, { tipo: "limpiarError" });
    expect(puedePrevisualizar(e)).toBe(true);
  });
});
