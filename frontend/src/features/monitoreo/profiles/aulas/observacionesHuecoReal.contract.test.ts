import { describe, expect, it } from "vitest";

import { observacionesDeCampo } from "./observacionesDeCampo";

/**
 * **Contar notas y contar aulas no es lo mismo, y la pantalla los comparaba.**
 *
 * Un curso-horario puede traer DOS observaciones —`replacement_note`, lo que
 * costó agendarlo, y `field_note`, lo que pasó al aplicarlo—. `conNota` las
 * cuenta a ellas; `partes` cuenta aulas. La línea decía «**283 de 200**
 * cursos-horario gestionados traen observación» sobre el operativo real, que es
 * imposible de leer.
 *
 * Y lo que se perdía por eso era justo lo que Gonzalo pidió mirar (2026-08-24):
 * «lo que hay que mirar es el hueco —las gestionadas que NO traen nota—». Ese
 * hueco se enseñaba con `partes > conNota`, y con 283 > 200 no aparecía nunca.
 */
const fila = (p: Record<string, unknown>) => p as never;

describe("el hueco de observaciones se mide contra aulas, no contra notas", () => {
  it("un aula con dos notas cuenta como UNA aula y DOS notas", () => {
    const r = observacionesDeCampo([
      fila({
        operational_code: "CH 1",
        replacement_note: "no contesta, se envía correo",
        field_note: "la docente pidió aplicar al final",
        application_status: "aplicada",
      }),
    ]);
    expect(r.conNota).toBe(2);
    expect(r.aulasConNota).toBe(1);
  });

  it("el hueco aparece aunque las notas pasen del número de aulas", () => {
    // Dos aulas gestionadas; una trae dos notas y la otra ninguna. Antes:
    // conNota=2, partes=2 → «2 de 2» y ningún hueco, con un aula sin anotar.
    const r = observacionesDeCampo([
      fila({
        operational_code: "CH 1", application_status: "aplicada",
        replacement_note: "una", field_note: "otra",
      }),
      fila({ operational_code: "CH 2", application_status: "aplicada" }),
    ]);
    expect(r.partes).toBe(2);
    expect(r.aulasConNota).toBe(1);
    expect(r.partes - r.aulasConNota).toBe(1);
  });

  it("las aulas con nota nunca pasan de las gestionadas", () => {
    // La invariante que la pantalla violaba. Con cualquier reparto de notas,
    // `aulasConNota <= partes`.
    const r = observacionesDeCampo([
      fila({ operational_code: "CH 1", application_status: "aplicada", replacement_note: "a", field_note: "b" }),
      fila({ operational_code: "CH 2", application_status: "aplicada", replacement_note: "c", field_note: "d" }),
      fila({ operational_code: "CH 3", application_status: "aplicada", replacement_note: "e", field_note: "f" }),
    ]);
    expect(r.conNota).toBe(6);
    expect(r.aulasConNota).toBeLessThanOrEqual(r.partes);
    expect(r.aulasConNota).toBe(3);
  });

  it("sin notas no hay aulas con nota, y el hueco es todo", () => {
    const r = observacionesDeCampo([
      fila({ operational_code: "CH 1", application_status: "aplicada" }),
    ]);
    expect(r.aulasConNota).toBe(0);
    expect(r.partes - r.aulasConNota).toBe(r.partes);
  });
});
