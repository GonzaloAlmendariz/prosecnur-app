import { describe, expect, it } from "vitest";
import type { MonitoreoAssistedReviewCandidate, MonitoreoInternalQueryCase, MonitoreoInternalQueryIssue } from "../../../../../../api/client";
import { avisoSinExplicacion, filasDeCola, filtrarCola, modeloDeDecision, payloadDeDecision, tipoInicial } from "./porResolverModelo";

function candidato(parcial: Partial<MonitoreoAssistedReviewCandidate>): MonitoreoAssistedReviewCandidate {
  return {
    candidate_id: "", person_label: "", case_key: "", base_record: "", base_source: "Universo · Docentes", base_row: 1,
    base_status: "Pendiente", match_type: "", match_label: "", current_status: "Pendiente", already_effective: false,
    ...parcial,
  };
}

function caso(parcial: Partial<MonitoreoInternalQueryCase>): MonitoreoInternalQueryCase {
  return {
    actor: "Docentes", person_label: "", case_key: "cód. ••••29", response_id: "115118926233", date: "2026-06-12",
    source_id: "", source_label: "SurveyMonkey · Docentes", channel: "Enlace personalizado", collector_id: "", collector_name: "",
    platform_state: "Completa", base_result: "Sin cruce", base_record: "", base_source: "", base_status: "", decision: "",
    decision_reason: "", advancement: "excluded", issue_type: "fuera_base", rule: "", pending_exit: false, recovery_collector: false,
    response_row: 1, duplicate_count: 1,
    ...parcial,
  };
}

function issue(parcial: Partial<MonitoreoInternalQueryIssue>): MonitoreoInternalQueryIssue {
  return { issue_type: "fuera_base", label: "Llave fuera de base", severity: "alta", actor: "Docentes", case_key: "", response_id: "", count: 1, detail: "", ...parcial };
}

const PERSONAS = [
  candidato({ candidate_id: "c-82", person_label: "Persona ••••82", case_key: "cód. ••••82", evidence_level: "manual" }),
  candidato({ candidate_id: "c-17", person_label: "Persona ••••17", case_key: "cód. ••••17", evidence_level: "exact" }),
  candidato({ candidate_id: "c-05", person_label: "Persona ••••05", already_effective: true, evidence_level: "exact" }),
];

describe("cola de Por resolver", () => {
  const casos = [caso({}), caso({ response_id: "2", issue_type: "duplicado_caso", date: "2026-06-20" })];
  const filas = filasDeCola([
    issue({ response_id: "115118926233" }),
    issue({ response_id: "2", issue_type: "duplicado_caso", label: "Caso duplicado", count: 3 }),
    issue({ response_id: "", issue_type: "sin_llave", label: "" }),
  ], casos);

  it("une cada caso marcado con su respuesta y abre por lo que espera decisión", () => {
    expect(filas.map((fila) => [fila.tipo, fila.grupo, fila.completitud])).toEqual([
      ["fuera_base", "espera", "100 %"],
      ["duplicado_caso", "regla", "100 %"],
      ["sin_llave", "espera", "—"],
    ]);
    expect(filas[2].etiquetaDeTipo).toBe("Respuesta sin llave");
    expect(tipoInicial(filas)).toBe("fuera_base");
    expect(filtrarCola(filas, { tipo: "duplicado_caso", publico: null }).map((fila) => fila.responseId)).toEqual(["2"]);
  });
});

describe("decisión del caso: las reglas de siempre", () => {
  const base = caso({ assisted_review: { candidates: [PERSONAS[1]], assignment_candidates: PERSONAS } });
  const vacio = { seleccion: "", confirmado: false, nota: "", busqueda: "" };

  it("una persona con efectiva no se ofrece para asignar", () => {
    const modelo = modeloDeDecision(base, vacio);
    expect(modelo.opciones.map((item) => item.candidate_id)).toEqual(["c-17", "c-82"]);
    expect(modelo.evidencia[0].candidate_id).toBe("c-05");
    expect(modelo.puedeAsignar).toBe(false);
    expect(modelo.motivoParaNoAsignar).toBe("Elige a la persona del padrón.");
  });

  it("asignar exige confirmar; con evidencia exacta la nota es opcional", () => {
    const sinConfirmar = modeloDeDecision(base, { ...vacio, seleccion: "c-17" });
    expect(sinConfirmar.puedeAsignar).toBe(false);
    const confirmado = modeloDeDecision(base, { ...vacio, seleccion: "c-17", confirmado: true });
    expect(confirmado.notaRequerida).toBe(false);
    expect(payloadDeDecision(base, "include_with_caveat", confirmado, "  ")).toEqual({
      response_id: "115118926233", action: "include_with_caveat", candidate_id: "c-17", note: "",
    });
  });

  it("sin evidencia exacta o con una parcial, la nota es obligatoria", () => {
    const manual = modeloDeDecision(base, { ...vacio, seleccion: "c-82", confirmado: true });
    expect(manual.notaRequerida).toBe(true);
    expect(manual.puedeAsignar).toBe(false);
    expect(modeloDeDecision(base, { ...vacio, seleccion: "c-82", confirmado: true, nota: "Lo confirmó por correo" }).puedeAsignar).toBe(true);
    const parcial = caso({ platform_state: "Parcial", advancement: "partial", assisted_review: base.assisted_review });
    expect(modeloDeDecision(parcial, { ...vacio, seleccion: "c-17", confirmado: true }).notaRequerida).toBe(true);
  });

  it("un rechazo no se asigna pero sí se descarta", () => {
    const rechazo = caso({ platform_state: "Rechazo", advancement: "refusal", assisted_review: base.assisted_review });
    const modelo = modeloDeDecision(rechazo, { ...vacio, seleccion: "c-17", confirmado: true });
    expect(modelo.asignable).toBe(false);
    expect(payloadDeDecision(rechazo, "include_with_caveat", modelo, "")).toBeNull();
    expect(payloadDeDecision(rechazo, "keep_excluded", modelo, " no es del padrón ")).toEqual({
      response_id: "115118926233", action: "keep_excluded", candidate_id: undefined, note: "no es del padrón",
    });
  });

  it("la búsqueda filtra y avisa de quien ya tiene efectiva", () => {
    const modelo = modeloDeDecision(base, { ...vacio, busqueda: "05" });
    expect(modelo.opciones).toEqual([]);
    expect(modelo.yaAsignadas.map((item) => item.candidate_id)).toEqual(["c-05"]);
  });
});

describe("avisos del motor en el caso", () => {
  it("se publican sin la explicación que encadenan tras «;»", () => {
    const aviso = "Hay personas pendientes del universo con correo, código o nombre compatible; revisa estos casos antes de publicar la lista de no respuesta.";
    expect(avisoSinExplicacion(aviso)).toBe("Hay personas pendientes del universo con correo, código o nombre compatible.");
    expect(avisoSinExplicacion("El código declarado no coincide con el código de la persona encontrada por correo.")).toBe(
      "El código declarado no coincide con el código de la persona encontrada por correo.",
    );
    const modelo = modeloDeDecision(caso({ assisted_review: { warnings: [aviso] } }), { seleccion: "", confirmado: false, nota: "", busqueda: "" });
    expect(modelo.avisos).toEqual(["Hay personas pendientes del universo con correo, código o nombre compatible."]);
  });
});
