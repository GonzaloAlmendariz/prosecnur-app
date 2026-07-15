import { describe, expect, test } from "vitest";
import { MATRIZ_PULSO_AUDIENCES, planMatrizPulsoForms } from "./matrizPulso";

describe("planMatrizPulsoForms", () => {
  test("crea todas las audiencias cuando hay cupo de sobra", () => {
    const plan = planMatrizPulsoForms([...MATRIZ_PULSO_AUDIENCES], 0, 6);
    expect(plan.toCreate).toEqual(["Docentes", "Estudiantes", "Administrativos"]);
    expect(plan.skipped).toEqual([]);
    expect(plan.capped).toBe(false);
    expect(plan.availableSlots).toBe(6);
  });

  test("recorta al cupo libre y marca capped", () => {
    const plan = planMatrizPulsoForms([...MATRIZ_PULSO_AUDIENCES], 5, 6);
    expect(plan.toCreate).toEqual(["Docentes"]);
    expect(plan.skipped).toEqual(["Estudiantes", "Administrativos"]);
    expect(plan.capped).toBe(true);
    expect(plan.availableSlots).toBe(1);
  });

  test("no crea nada cuando el proyecto ya está en el tope", () => {
    const plan = planMatrizPulsoForms([...MATRIZ_PULSO_AUDIENCES], 6, 6);
    expect(plan.toCreate).toEqual([]);
    expect(plan.skipped).toEqual(["Docentes", "Estudiantes", "Administrativos"]);
    expect(plan.capped).toBe(true);
    expect(plan.availableSlots).toBe(0);
  });

  test("deduplica y descarta audiencias vacías preservando el orden", () => {
    const plan = planMatrizPulsoForms(["Docentes", "  ", "Docentes", "Estudiantes"], 0, 6);
    expect(plan.toCreate).toEqual(["Docentes", "Estudiantes"]);
    expect(plan.capped).toBe(false);
  });

  test("trata un existingCount negativo como cero", () => {
    const plan = planMatrizPulsoForms(["Docentes"], -3, 6);
    expect(plan.availableSlots).toBe(6);
    expect(plan.toCreate).toEqual(["Docentes"]);
  });
});
