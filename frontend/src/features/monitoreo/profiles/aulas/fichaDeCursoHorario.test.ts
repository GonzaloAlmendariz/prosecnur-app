import { describe, expect, test } from "vitest";

import {
  buscarCursosHorario, claveDeBusqueda, fichaDeCursoHorario, rolEnPalabras,
} from "./fichaDeCursoHorario";

const CH43 = {
  operational_code: "CH 43", sample_role: "titular", faculty: "ESTUDIOS GENERALES CIENCIAS",
  course_name: "Cálculo 1", section: "0501", teacher: "Docente X",
  scheduled_date: "2026-09-07", scheduled_time: "10:00", scheduled_venue: "A-101",
  eligible_n: 50, expected_valid: 23.7, respuestas_validas: 16,
  tasa_efectividad_aula: 0.473, tasa_facultad: 0.4087, brecha: 8,
  operational_status: "planificada", sample_status: "agendada", link: "https://x",
};

describe("la ficha de un curso-horario", () => {
  test("la efectividad OBTENIDA se calcula; la PREVISTA se lee", () => {
    // `tasa_efectividad_aula` vale 0,473 para CH 43 y es su tasa PREVISTA —la
    // misma que `dos_tasas` publica como `tasa_prevista`—, no un resultado del
    // campo. La obtenida no viaja en el payload: es 16 de 50.
    const f = fichaDeCursoHorario(CH43);
    expect(f.efectividadPrevista).toBeCloseTo(0.473, 6);
    expect(f.efectividadObtenida).toBeCloseTo(16 / 50, 6);
    expect(f.efectividadDeSuFacultad).toBeCloseTo(0.4087, 6);
  });

  test("el estado sale de la EVIDENCIA, no de `operational_status`", () => {
    // Ese campo dice «planificada» en las 174 filas del plan mientras hay
    // cursos-horario aplicados; ya obligó a reparar `dos_tasas` (531369a2).
    expect(fichaDeCursoHorario(CH43).estado).toBe("aplicado");
    expect(fichaDeCursoHorario(CH43).estadoOperativo).toBe("planificada");
  });

  test("el parte de campo vale como evidencia cuando la plataforma no trae nada", () => {
    const sinPlataforma = { ...CH43, respuestas_validas: 0 };
    expect(fichaDeCursoHorario(sinPlataforma).estado).toBe("agendado");
    expect(fichaDeCursoHorario(sinPlataforma, { effective_surveys: 12 }).estado).toBe("aplicado");
  });

  test("sin aplicar NO se publica una efectividad obtenida de cero", () => {
    // Un cero ahí se lee como «rindió cero», y lo que pasa es que nadie ha ido.
    const f = fichaDeCursoHorario({ ...CH43, respuestas_validas: 0, scheduled_date: "" });
    expect(f.estado).toBe("sin_agendar");
    expect(f.efectividadObtenida).toBeNull();
  });

  test("sin aforo declarado no se divide entre cero", () => {
    const f = fichaDeCursoHorario({ ...CH43, eligible_n: 0 });
    expect(f.efectividadObtenida).toBeNull();
    expect(f.elegibles).toBe(0);
  });

  test("un retirado se dice retirado, no «sin agendar»", () => {
    const f = fichaDeCursoHorario({
      ...CH43, respuestas_validas: 0, scheduled_date: "",
      operational_status: "reemplazada", sample_status: "reemplazada",
    });
    expect(f.estado).toBe("retirado");
  });

  test("un retirado que YA había aplicado conserva lo que trajo", () => {
    // Su reemplazo responde por lo que falta, pero las encuestas que consiguió
    // están en la base y borrarlas de la ficha las haría desaparecer.
    const f = fichaDeCursoHorario({ ...CH43, operational_status: "reemplazada" });
    expect(f.estado).toBe("aplicado");
    expect(f.efectivasObtenidas).toBe(16);
  });

  test("el parte aporta asistentes, aplicador y aula real", () => {
    const f = fichaDeCursoHorario(CH43, {
      observed_students: 41, effective_surveys: 16,
      applied_by: "Chamorro Rodriguez, Rosa", actual_room: "A-205",
    });
    expect(f.asistentes).toBe(41);
    expect(f.efectivasDelParte).toBe(16);
    expect(f.responsable).toBe("Chamorro Rodriguez, Rosa");
    // El aula REAL manda sobre la agendada: es donde se aplicó de verdad.
    expect(f.local).toBe("A-205");
  });

  test("los tres roles se dicen en palabras", () => {
    expect(rolEnPalabras("titular")).toBe("Titular");
    expect(rolEnPalabras("")).toBe("Titular");
    expect(rolEnPalabras("chain_reserve")).toBe("Reserva de cadena");
    expect(rolEnPalabras("extra_reserve_pool")).toBe("Reserva adicional");
  });
});

describe("la búsqueda por código", () => {
  const plan = [
    { operational_code: "CH 4" }, { operational_code: "CH 40" },
    { operational_code: "CH 43" }, { operational_code: "R 1.1" },
    { operational_code: "R 1.2" }, { operational_code: "" },
  ];

  test("se teclea como se recuerda: «ch43», «CH 43» y «ch-43» son lo mismo", () => {
    for (const q of ["ch43", "CH 43", "ch-43", "  Ch 43 "]) {
      expect(buscarCursosHorario(plan, q).map((f) => f.operational_code)).toContain("CH 43");
    }
    expect(claveDeBusqueda(" ch_4-3 ")).toBe("CH43");
  });

  test("la coincidencia EXACTA va primera: «CH 4» no puede abrir con CH 40", () => {
    expect(buscarCursosHorario(plan, "CH 4")[0].operational_code).toBe("CH 4");
  });

  test("devuelve TODAS las coincidencias: «R 1» es la cadena entera", () => {
    expect(buscarCursosHorario(plan, "R1").map((f) => f.operational_code))
      .toEqual(["R 1.1", "R 1.2"]);
  });

  test("una consulta vacía no devuelve el plan entero", () => {
    expect(buscarCursosHorario(plan, "")).toEqual([]);
    expect(buscarCursosHorario(plan, "   ")).toEqual([]);
  });

  test("una fila sin código no rompe la búsqueda", () => {
    expect(buscarCursosHorario(plan, "CH").length).toBe(3);
  });

  test("el tope acota, y nunca deja la lista en cero", () => {
    expect(buscarCursosHorario(plan, "CH", 2).length).toBe(2);
    expect(buscarCursosHorario(plan, "CH", 0).length).toBe(1);
  });
});

import { cuandoEnPalabras, fechaEnPalabras } from "./fichaDeCursoHorario";

describe("la frase que contesta «¿y para cuándo?»", () => {
  test("un YYYY-MM-DD NO se corre un día", () => {
    // `new Date("2026-09-05")` es medianoche UTC y en Lima —UTC−5— sale como
    // 4/9. El perfil ya tropezó con eso (`kpisDeAulas.ts:167`).
    expect(fechaEnPalabras("2026-09-05")).toBe("sábado 5 de setiembre");
    expect(fechaEnPalabras("2026-09-08")).toBe("martes 8 de setiembre");
  });

  test("«setiembre», que es como se escribe aquí", () => {
    expect(fechaEnPalabras("2026-09-01")).toContain("setiembre");
  });

  test("el estado y la fecha van en UNA frase, no en dos datos sueltos", () => {
    expect(cuandoEnPalabras("agendado", "2026-09-08", "6:45 pm"))
      .toBe("Agendado para el martes 8 de setiembre, 6:45 pm");
    expect(cuandoEnPalabras("aplicado", "2026-09-07", "11:10 am"))
      .toBe("Se aplicó el lunes 7 de setiembre, 11:10 am");
  });

  test("sin fecha lo dice, no deja el hueco", () => {
    expect(cuandoEnPalabras("sin_agendar", "", "")).toBe("Todavía sin fecha en la agenda");
    expect(cuandoEnPalabras("agendado", "", "")).toBe("Agendado, sin fecha registrada");
  });

  test("un retirado conserva la fecha que tuvo", () => {
    expect(cuandoEnPalabras("retirado", "2026-09-08", ""))
      .toBe("Retirado del plan · tenía fecha el martes 8 de setiembre");
  });

  test("una fecha que no es fecha se devuelve tal cual, sin inventar", () => {
    expect(fechaEnPalabras("por confirmar")).toBe("por confirmar");
    expect(fechaEnPalabras("")).toBe("");
  });
});
