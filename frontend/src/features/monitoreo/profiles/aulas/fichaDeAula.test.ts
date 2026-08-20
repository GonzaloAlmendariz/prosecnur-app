import { describe, expect, test } from "vitest";

import { fichaDeAula, mismoCodigo } from "./fichaDeAula";
import { focoDesdeTexto, textoDesdeFoco } from "./AulasCuotasResumen";

describe("ficha de aula", () => {
  test("reúne las cuatro hojas de un aula bajo un solo código", () => {
    const f = fichaDeAula("CH 31", {
      agenda: [{ operational_code: "CH 31", faculty: "Derecho", expected_valid: 14, eligible_n: 40, operational_status: "aplicada" }],
      partes: [{ operational_code: "CH 31", attendees: 22, effective_surveys: 18, applied_by: "Equipo 2" }],
      control: [{ operational_code: "CH 31", total_sent: 19 }],
      brechas: [{ operational_code: "CH 31", respuestas_validas: 12, brecha: 2 }],
    });
    expect(f.existe).toBe(true);
    expect(f.facultad).toBe("Derecho");
    expect(f.esperado).toBe(14);
    expect(f.parte.encuestas).toBe(18);
    expect(f.control.enviadas).toBe(19);
    expect(f.brecha).toBe(2);
  });

  test("un aula sin parte no es un aula con cero encuestas", () => {
    // La distinción que sostiene la ficha: faltar y valer cero son cosas
    // distintas, y con un 0 nadie sabría que el parte no llegó.
    const f = fichaDeAula("CH 9", {
      agenda: [{ operational_code: "CH 9", faculty: "Gestión" }],
      partes: [],
    });
    expect(f.existe).toBe(true);
    expect(f.parte.hay).toBe(false);
    expect(f.parte.encuestas).toBeNull();
    expect(f.control.hay).toBe(false);
  });

  test("el aula se reconoce aunque cada hoja la nombre a su manera", () => {
    const f = fichaDeAula("CH 5", {
      agenda: [{ classroom_id: "CH 5", faculty: "Letras" }],
      partes: [{ codigo: "ch 5", attendees: 10 }],
    });
    expect(f.facultad).toBe("Letras");
    expect(f.parte.asistentes).toBe(10);
  });

  test("un código que no está en ninguna hoja se declara inexistente", () => {
    const f = fichaDeAula("CH 999", { agenda: [{ operational_code: "CH 1" }] });
    expect(f.existe).toBe(false);
    expect(f.esperado).toBeNull();
  });

  test("comparar códigos ignora mayúsculas y espacios de sobra, pero no vacíos", () => {
    expect(mismoCodigo("CH 31", "ch  31")).toBe(true);
    expect(mismoCodigo("", "")).toBe(false);
    expect(mismoCodigo("CH 3", "CH 31")).toBe(false);
  });

  test("la ficha es enlazable: el foco de aula viaja en la URL", () => {
    // Sin esto la ficha no se le puede mandar a nadie, que es la mitad de para
    // qué existe. `aula:` convive con los focos que acotan tablas sin
    // confundirse con ellos.
    const foco = focoDesdeTexto("aula:CH 31");
    expect(foco).toEqual({ tipo: "aula", valor: "CH 31" });
    expect(textoDesdeFoco(foco)).toBe("aula:CH 31");
    expect(focoDesdeTexto("facultad:Derecho")).toEqual({ tipo: "facultad", valor: "Derecho" });
    expect(focoDesdeTexto("inventado:x")).toBeNull();
  });
});
