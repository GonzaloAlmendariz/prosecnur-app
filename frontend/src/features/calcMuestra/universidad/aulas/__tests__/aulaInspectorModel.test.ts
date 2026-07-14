/**
 * Contrato del modelo del inspector de aula (pestaña Aulas titulares):
 * el helper lee las filas de la selección del motor tal cual (sin recálculos)
 * y arma la vista defendible: titular con su cadena ordenada, reemplazo con su
 * titular y equivalencia, bolsa extra sin cadena, y "—" en campos ausentes.
 */
import { describe, expect, it } from "vitest";
import { buildAulaInspectorModel, DASH } from "../aulaInspectorModel";

const TITULAR = {
  classroom_id: "dec285_0409",
  operational_code: "AULA 1",
  selection_slot_id: "slot_001",
  sample_role: "titular",
  wave: "M1",
  replacement_order: 0,
  course_name: "OBLIGACIONES",
  faculty: "DERECHO",
  program: "DERECHO",
  level: "8",
  schedule: "0409",
  modality: "PRESENCIAL",
  teacher: "CHAHUD COSIO, DANIEL KARIM",
  eligible_n: 43,
  enrolled_total: 43,
  pi_final: 0.0044,
  weight_classroom: 224.7209,
  unique_added: 0,
  duplicate_overlap: 0,
  equivalence_level: "titular",
  replacement_for: "",
};

const R1 = {
  classroom_id: "del204_0409",
  operational_code: "R1.1",
  replacement_chain_code: "R1.1",
  titular_operational_code: "AULA 1",
  selection_slot_id: "slot_001",
  sample_role: "chain_reserve",
  wave: "M2",
  replacement_order: 1,
  course_name: "DERECHO LABORAL ESPECIAL",
  faculty: "DERECHO",
  program: "DERECHO",
  schedule: "0409",
  eligible_n: 43,
  enrolled_total: 43,
  pi_final: 0.0044,
  weight_classroom: 224.7209,
  equivalence_level: "misma_celda",
  replacement_for: "dec285_0409",
};

const R2 = {
  classroom_id: "der310_0102",
  operational_code: "R1.2",
  replacement_chain_code: "R1.2",
  titular_operational_code: "AULA 1",
  selection_slot_id: "slot_001",
  sample_role: "chain_reserve",
  wave: "M3",
  replacement_order: 2,
  course_name: "DERECHO CIVIL",
  faculty: "DERECHO",
  equivalence_level: "misma_facultad",
  replacement_for: "dec285_0409",
};

const OTRO_TITULAR = {
  classroom_id: "eco101_0301",
  operational_code: "AULA 2",
  selection_slot_id: "slot_002",
  sample_role: "titular",
  wave: "M1",
  course_name: "MICROECONOMIA",
  faculty: "ECONOMIA",
};

const EXTRA = {
  classroom_id: "ext900_0101",
  operational_code: "",
  sample_role: "extra_reserve_pool",
  wave: "",
  course_name: "CURSO EXTRA",
};

// El orden de las filas es el del motor (no asumimos que la cadena venga junta).
const ROWS = [TITULAR, OTRO_TITULAR, R2, R1, EXTRA];

describe("buildAulaInspectorModel", () => {
  it("arma el titular con su cadena de reemplazos ordenada (R.1, R.2)", () => {
    const model = buildAulaInspectorModel({
      row: TITULAR,
      selectionRows: ROWS,
      methodLabel: "Muestreo balanceado (cube)",
    });
    expect(model.rol).toBe("titular");
    expect(model.rolLabel).toBe("Titular M1");
    expect(model.code).toBe("CH 1");
    expect(model.courseName).toBe("OBLIGACIONES");
    expect(model.faculty).toBe("DERECHO");
    // π en % con 1 decimal y peso 1/π con 2 decimales (formatos sharedCore).
    expect(model.piText).toBe("0.4%");
    expect(model.pesoText).toBe("224.72");
    expect(model.metodoLabel).toBe("Muestreo balanceado (cube)");
    expect(model.titular).toBeNull();
    // Cadena leída de replacement_for === classroom_id del titular, ordenada.
    expect(model.cadena.map((slot) => slot.code)).toEqual(["R1.1", "R1.2"]);
    expect(model.cadena.map((slot) => slot.id)).toEqual(["del204_0409", "der310_0102"]);
    expect(model.cadena[0].equivalencia).toBe("Misma celda");
    expect(model.cadena[1].equivalencia).toBe("Misma facultad");
    expect(model.cadena.every((slot) => !slot.activo)).toBe(true);
    // Composición honesta: 0 reales se muestran como 0, no como "—".
    expect(model.elegiblesText).toBe("43");
    expect(model.unicosText).toBe("0");
    expect(model.repetidosText).toBe("0");
  });

  it("arma el reemplazo con su titular, equivalencia y posición activa en la cadena", () => {
    const model = buildAulaInspectorModel({ row: R1, selectionRows: ROWS });
    expect(model.rol).toBe("reemplazo");
    expect(model.rolLabel).toBe("Reemplazo R1.1");
    expect(model.equivalenciaLabel).toBe("Misma celda");
    expect(model.titular).toEqual({
      id: "dec285_0409",
      code: "CH 1",
      label: "OBLIGACIONES",
    });
    // La cadena mostrada es la del titular, marcando este eslabón como activo.
    expect(model.cadena.map((slot) => slot.code)).toEqual(["R1.1", "R1.2"]);
    expect(model.cadena[0].activo).toBe(true);
    expect(model.cadena[1].activo).toBe(false);
    // Método no provisto → "—" (nunca texto inventado).
    expect(model.metodoLabel).toBe(DASH);
  });

  it("marca la bolsa extra sin cadena ni titular", () => {
    const model = buildAulaInspectorModel({ row: EXTRA, selectionRows: ROWS });
    expect(model.rol).toBe("extra");
    expect(model.rolLabel).toBe("Bolsa extra");
    expect(model.titular).toBeNull();
    expect(model.cadena).toEqual([]);
  });

  it("muestra '—' en campos ausentes sin inventar cifras", () => {
    const model = buildAulaInspectorModel({ row: {}, selectionRows: [] });
    expect(model.id).toBe(DASH);
    expect(model.courseName).toBe(DASH);
    expect(model.faculty).toBe(DASH);
    expect(model.program).toBe(DASH);
    expect(model.schedule).toBe(DASH);
    expect(model.piText).toBe(DASH);
    expect(model.pesoText).toBe(DASH);
    expect(model.metodoLabel).toBe(DASH);
    expect(model.elegiblesText).toBe(DASH);
    expect(model.matriculadosText).toBe(DASH);
    expect(model.repetidosText).toBe(DASH);
    expect(model.unicosText).toBe("");
    expect(model.cadena).toEqual([]);
  });

  it("liga la cadena por selection_slot_id cuando falta replacement_for", () => {
    const titular = { ...TITULAR, classroom_id: "t1", selection_slot_id: "slot_9" };
    const reserva = {
      ...R1,
      classroom_id: "r9",
      operational_code: "R9.1",
      replacement_chain_code: "R9.1",
      selection_slot_id: "slot_9",
      replacement_for: "",
    };
    const rows = [titular, reserva];
    const modelTitular = buildAulaInspectorModel({ row: titular, selectionRows: rows });
    expect(modelTitular.cadena.map((slot) => slot.code)).toEqual(["R9.1"]);
    const modelReserva = buildAulaInspectorModel({ row: reserva, selectionRows: rows });
    expect(modelReserva.titular?.id).toBe("t1");
    expect(modelReserva.cadena[0].activo).toBe(true);
  });
});
