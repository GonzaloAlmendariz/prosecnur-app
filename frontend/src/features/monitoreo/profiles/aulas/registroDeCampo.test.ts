import { describe, expect, it } from "vitest";

import { aulaNecesitaMotivo, cambiosDelRegistro, etiquetaDeAula, type RegistroForm } from "./RegistroDeCampo";
import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";

const fila = (extra: Partial<MonitoreoAulasPlanRow> = {}) => ({
  classroom_id: "AULA-01",
  operational_code: "CH 1",
  course_name: "Cálculo I",
  collection_unit_id: "unit-01",
  operational_status: "planificada",
  ...extra,
}) as unknown as MonitoreoAulasPlanRow;

const form = (extra: Partial<RegistroForm> = {}): RegistroForm => ({
  estado: "aplicada", motivo: "", aforo: "", aplicadas: "", rechazos: "",
  aplicador: "", momento: "", nota: "", ...extra,
});

describe("registro de campo", () => {
  it("pide motivo sólo cuando el estado lo justifica", () => {
    expect(aulaNecesitaMotivo("sin_acceso")).toBe(true);
    expect(aulaNecesitaMotivo("cancelada")).toBe(true);
    expect(aulaNecesitaMotivo("aplicada")).toBe(false);
    expect(aulaNecesitaMotivo("planificada")).toBe(false);
  });

  it("identifica el aula por su código y su curso", () => {
    expect(etiquetaDeAula(fila())).toBe("CH 1 · Cálculo I");
    expect(etiquetaDeAula(fila({ course_name: "", label: "" }))).toBe("CH 1");
  });

  it("manda el id que viaja en el QR además del aula", () => {
    const c = cambiosDelRegistro(fila(), form());
    expect(c.collection_unit_id).toBe("unit-01");
    expect(c.classroom_id).toBe("AULA-01");
    expect(c.operational_code).toBe("CH 1");
  });

  it("es un PATCH: no manda en blanco lo que el usuario no tocó", () => {
    const c = cambiosDelRegistro(fila(), form());
    // El control: mandar estos campos vacíos borraría lo que otro ya registró.
    expect(c).not.toHaveProperty("observed_students");
    expect(c).not.toHaveProperty("applied_by");
    expect(c).not.toHaveProperty("field_note");
  });

  it("convierte los números y descarta lo que no lo es", () => {
    const c = cambiosDelRegistro(fila(), form({ aforo: "27", aplicadas: "24", rechazos: "0" }));
    expect(c.observed_students).toBe(27);
    expect(c.applied_surveys).toBe(24);
    expect(c.refusals).toBe(0);

    const malo = cambiosDelRegistro(fila(), form({ aforo: "no sé", aplicadas: "-3" }));
    expect(malo).not.toHaveProperty("observed_students");
    expect(malo).not.toHaveProperty("applied_surveys");
  });

  it("sólo adjunta el motivo si el estado lo pide", () => {
    expect(cambiosDelRegistro(fila(), form({ estado: "aplicada", motivo: "otro" })))
      .not.toHaveProperty("replacement_reason");
    expect(cambiosDelRegistro(fila(), form({ estado: "sin_acceso", motivo: "docente_no_autoriza" })).replacement_reason)
      .toBe("docente_no_autoriza");
  });
});
