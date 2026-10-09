import { describe, expect, it } from "vitest";
import { debeRetirarAviso, esAvisoDeCaducidad, estadoAlineado } from "../avisoCaducidadResuelta";

// Gonzalo, 2026-08-25, con el marco reconstruido y las 179 ya calculadas: «sigo
// sin entender si estamos en el .pulso definitivo porque esto sigue saliendo».
// El aviso describía un desfase ya reparado.
const H = "260edb37ff26";

describe("esAvisoDeCaducidad", () => {
  it("reconoce el aviso de decisión caducada por su código", () => {
    expect(esAvisoDeCaducidad({
      kind: "error",
      text: "La decisión de alumnos por CH cambió desde esta corrida. · E_CALC_MUESTRA_ALUMNOS_CH_DECISION",
    })).toBe(true);
  });

  it("NO toca un error de verdad", () => {
    // Un fallo real no lo borra nadie salvo el usuario: si esto devolviera true,
    // un «no se pudo calcular» desaparecería solo al recalcular otra cosa.
    expect(esAvisoDeCaducidad({ kind: "error", text: "No se pudo calcular." })).toBe(false);
    expect(esAvisoDeCaducidad({ kind: "info", text: "Reporte metodológico listo." })).toBe(false);
    expect(esAvisoDeCaducidad(null)).toBe(false);
  });
});

describe("estadoAlineado", () => {
  it("es verdadero cuando marco, contrato y firmas coinciden", () => {
    expect(estadoAlineado({ frameHash: H, contratoHash: H, decisionHashes: [H, H] })).toBe(true);
  });

  it("es falso si una sola firma quedó en el marco anterior", () => {
    expect(estadoAlineado({ frameHash: H, contratoHash: H, decisionHashes: [H, "b583867d8b7b"] })).toBe(false);
  });

  it("es falso si el contrato del marco no es el del marco", () => {
    expect(estadoAlineado({ frameHash: H, contratoHash: "b583867d8b7b", decisionHashes: [H] })).toBe(false);
  });

  it("SIN resultados firmados NO se declara alineado", () => {
    // Verde por ausencia: sin ninguna firma no hay evidencia de que la
    // caducidad se resolviera, y borrar el aviso ahí es cantar victoria porque
    // no queda nadie que lleve la contraria.
    expect(estadoAlineado({ frameHash: H, contratoHash: H, decisionHashes: [] })).toBe(false);
    expect(estadoAlineado({ frameHash: H, contratoHash: H, decisionHashes: [null, undefined] })).toBe(false);
  });

  it("sin marco vigente no hay alineación posible", () => {
    expect(estadoAlineado({ frameHash: "", contratoHash: "", decisionHashes: [] })).toBe(false);
    expect(estadoAlineado({ decisionHashes: [H] })).toBe(false);
  });
});

/**
 * Medido el 2026-08-28 sobre el SEGUNDO sorteo de HSVG 2026. Con el marco, el
 * contrato y las firmas los tres en `f1ab83dfa6` —alineados—, «Medir certeza»
 * devolvía 409 `E_CALC_MUESTRA_ALUMNOS_CH_DECISION` porque faltaba regenerar
 * los ARTEFACTOS DE AULAS, una cuarta condición que esos hashes no ven. El
 * aviso se pintaba y el hook lo borraba en el mismo tick: el botón fallaba sin
 * decir una palabra.
 */
describe("debeRetirarAviso", () => {
  it("retira el aviso que NACIÓ desfasado y luego se realineó", () => {
    // El caso original: el analista ve el aviso, repara, y el aviso se va.
    expect(debeRetirarAviso({ caduco: true, alineado: true, nacioAlineado: false })).toBe(true);
  });

  it("NO retira un aviso que nació con el estado ya alineado", () => {
    // El error vivo de «Medir certeza». Si esto devolviera true, el botón
    // vuelve a fallar en silencio.
    expect(debeRetirarAviso({ caduco: true, alineado: true, nacioAlineado: true })).toBe(false);
  });

  it("no retira nada mientras el estado siga desfasado", () => {
    expect(debeRetirarAviso({ caduco: true, alineado: false, nacioAlineado: false })).toBe(false);
  });

  it("no toca un mensaje que no es de caducidad", () => {
    expect(debeRetirarAviso({ caduco: false, alineado: true, nacioAlineado: false })).toBe(false);
  });
});
