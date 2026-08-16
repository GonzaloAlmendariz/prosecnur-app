import { describe, expect, it } from "vitest";

import {
  aulaNecesitaMotivo,
  aulaPuedeReemplazarse,
  cambiosDelRegistro,
  etiquetaDeAula,
  type RegistroForm,
} from "./RegistroDeCampo";
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
  duplicados: "", efectivas: "", aplicador: "", aulaReal: "", momento: "",
  nota: "", ...extra,
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

describe("el registro captura lo que el parte necesita", () => {
  it("manda duplicados y efectivas, que son lo que el cuadre comprueba", () => {
    // Sin estos dos, la identidad `asistentes - rechazos - duplicados =
    // efectivas` no se puede comprobar sobre lo que la app captura, y el
    // control ya existe en Validación.
    const c = cambiosDelRegistro(fila(), form({
      aforo: "22", rechazos: "1", duplicados: "1", efectivas: "20",
    }));
    expect(c.observed_students).toBe(22);
    expect(c.refusals).toBe(1);
    expect(c.duplicates).toBe(1);
    expect(c.effective_surveys).toBe(20);
    // Y cuadran: 22 - 1 - 1 = 20.
    const n = (v: unknown) => Number(v);
    expect(n(c.observed_students) - n(c.refusals) - n(c.duplicates)).toBe(n(c.effective_surveys));
  });

  it("registra el aula real donde se aplicó", () => {
    expect(cambiosDelRegistro(fila(), form({ aulaReal: "H-203" })).actual_room).toBe("H-203");
  });

  it("sigue sin mandar en blanco los campos nuevos que nadie tocó", () => {
    const c = cambiosDelRegistro(fila(), form());
    expect(c).not.toHaveProperty("duplicates");
    expect(c).not.toHaveProperty("effective_surveys");
    expect(c).not.toHaveProperty("actual_room");
  });
});

describe("ofrecer el reemplazo", () => {
  it("sólo cuando el aula cayó de verdad", () => {
    const titular = fila({ sample_role: "titular" });
    expect(aulaPuedeReemplazarse("sin_acceso", titular)).toBe(true);
    expect(aulaPuedeReemplazarse("cancelada", titular)).toBe(true);
    expect(aulaPuedeReemplazarse("reemplazo_pendiente", titular)).toBe(true);
    // Aplicada o en curso no son caídas.
    expect(aulaPuedeReemplazarse("aplicada", titular)).toBe(false);
    expect(aulaPuedeReemplazarse("planificada", titular)).toBe(false);
    expect(aulaPuedeReemplazarse("en_campo", titular)).toBe(false);
  });

  it("no se ofrece sobre un aula que YA fue reemplazada", () => {
    // Volver a activar consumiría otra reserva de la cadena sin que nadie lo
    // haya pedido.
    expect(aulaPuedeReemplazarse("reemplazada", fila({ sample_role: "titular" }))).toBe(false);
  });

  it("una reserva también puede caer y encadenar", () => {
    expect(aulaPuedeReemplazarse("sin_acceso", fila({ sample_role: "chain_reserve" }))).toBe(true);
  });

  it("una unidad sin cadena no tiene a quién llamar", () => {
    expect(aulaPuedeReemplazarse("sin_acceso", fila({ sample_role: "extra_reserve_pool" }))).toBe(false);
    expect(aulaPuedeReemplazarse("sin_acceso", null)).toBe(false);
  });
});
