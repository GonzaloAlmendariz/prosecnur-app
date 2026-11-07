/**
 * «Falta confirmar Alumnos por CH en Marco» decía dónde ir y no llevaba
 * (Gonzalo, 2026-11-01). El enlace aparece sólo con esa razón del motor
 * (`source_frame_hash_missing`), no con cualquier estado inválido.
 */
import { describe, expect, it } from "vitest";
import { pideConfirmarAlumnosPorCh } from "../RazonesDelEstado";

const razon = (code: string) => ({ code, message: "m", details: {} });

describe("el aviso de Alumnos por CH lleva a su pestaña", () => {
  it("con la razón del motor, pide el enlace", () => {
    expect(pideConfirmarAlumnosPorCh({ kind: "invalid", reasons: ["m"], backend_reasons: [razon("source_frame_hash_missing")] })).toBe(true);
  });

  it("con otra razón, o sin razones del motor, no", () => {
    expect(pideConfirmarAlumnosPorCh({ kind: "invalid", reasons: ["m"], backend_reasons: [razon("source_frame_stale")] })).toBe(false);
    expect(pideConfirmarAlumnosPorCh({ kind: "invalid", reasons: ["m"] })).toBe(false);
    expect(pideConfirmarAlumnosPorCh({ kind: "empty", reasons: ["m"] })).toBe(false);
  });
});
