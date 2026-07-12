/**
 * Candado del impacto EN VIVO del marco (estimación cliente). Cubre: monotonía
 * en reposo (live == hard sin restricción), filtrado por criterios de aula
 * (modalidad flat, docente jerárquico "al menos uno", nivel range por facultad,
 * matriculados numeric, mínimo de elegibles), conteo de docentes distintos y de
 * estudiantes alcanzados, el filtro de alumno computable (faculty/level) y el
 * reporte de criterios de alumno pendientes (formation/condition/age).
 */
import { describe, expect, it } from "vitest";
import type { CriteriosCatalogo, CriteriosSeleccionMarco, MonitoreoRow } from "../../../../api/client";
import { computeImpactoMarco, textKey, unidadCriterio } from "../criteriosImpacto";
import { seleccionInicial, setSeleccionVariable, setLayer, seleccionVariable, toggleCategoria, setThreshold, setRangosFacultad } from "../criteriosMarco";

const CATALOGO: CriteriosCatalogo = {
  schema: "calc_muestra_criterios_catalogo_v1",
  variables: [
    {
      id: "faculty",
      scope: "alumno",
      label: "Facultad",
      kind: "flat",
      defaultLayer: "marco",
      estratifica: true,
      categories: [
        { key: "ingenieria", label: "Ingeniería", aulas: 2 },
        { key: "letras", label: "Letras", aulas: 1 },
      ],
    },
    {
      id: "age",
      scope: "alumno",
      label: "Edad",
      kind: "numeric",
      defaultLayer: "marco",
      numericRange: { min: 16, max: 60 },
    },
    {
      id: "modality",
      scope: "aula",
      label: "Modalidad",
      kind: "flat",
      categories: [
        { key: "presencial", label: "Presencial", aulas: 2 },
        { key: "virtual", label: "Virtual", aulas: 1 },
      ],
    },
    {
      id: "teacher_type",
      scope: "aula",
      label: "Tipo de docente",
      kind: "hierarchical",
      groups: [
        {
          key: "docente_ordinario",
          label: "Docente ordinario",
          aulas: 2,
          children: [{ key: "docente_ordinario_principal", label: "DOCENTE ORDINARIO - PRINCIPAL", aulas: 2 }],
        },
        {
          key: "docente_contratado",
          label: "Docente contratado",
          aulas: 1,
          children: [{ key: "docente_contratado_contratado", label: "DOCENTE CONTRATADO - CONTRATADO", aulas: 1 }],
        },
      ],
    },
    {
      id: "course_level",
      scope: "aula",
      label: "Nivel del curso",
      kind: "range",
      values: [1, 2, 3, 4, 5],
    },
    {
      id: "enrolled_total",
      scope: "aula",
      label: "Matriculados",
      kind: "numeric",
      numericRange: { min: 10, max: 60 },
    },
  ],
};

// 3 aulas incluidas + 1 excluida (no debe contar nunca).
const AULA_FRAME: MonitoreoRow[] = [
  {
    classroom_id: "A1", included: true, eligible_n: 30, enrolled_total: 40,
    modality: "PRESENCIAL", teacher: "Ana", teacher_email: "ana@u.pe",
    teacher_type: "DOCENTE ORDINARIO - PRINCIPAL", faculty: "Ingeniería", course_level_num: 1,
    unique_student_ids: "s1|s2|s3",
  },
  {
    classroom_id: "A2", included: true, eligible_n: 25, enrolled_total: 20,
    modality: "VIRTUAL", teacher: "Beto", teacher_email: "beto@u.pe",
    teacher_type: "DOCENTE CONTRATADO - CONTRATADO", faculty: "Letras", course_level_num: 4,
    unique_student_ids: "s3|s4",
  },
  {
    classroom_id: "A3", included: true, eligible_n: 12, enrolled_total: 55,
    modality: "PRESENCIAL", teacher: "Ana", teacher_email: "ana@u.pe",
    teacher_type: "DOCENTE ORDINARIO - PRINCIPAL", faculty: "Ingeniería", course_level_num: 2,
    unique_student_ids: "s5|s6",
  },
  {
    classroom_id: "X9", included: false, eligible_n: 3, enrolled_total: 8,
    modality: "PRESENCIAL", teacher: "Zoe", teacher_email: "zoe@u.pe",
    teacher_type: "DOCENTE ORDINARIO - PRINCIPAL", faculty: "Ingeniería", course_level_num: 1,
    unique_student_ids: "s7",
  },
];

const POPULATION: MonitoreoRow[] = [
  { student_id: "s1", faculty: "Ingeniería", level: 1 },
  { student_id: "s2", faculty: "Ingeniería", level: 2 },
  { student_id: "s3", faculty: "Letras", level: 4 },
  { student_id: "s4", faculty: "Letras", level: 4 },
  { student_id: "s5", faculty: "Ingeniería", level: 3 },
  { student_id: "s6", faculty: "Ingeniería", level: 5 },
];

const FRAME = { aula_frame: AULA_FRAME, population: POPULATION };
const REFS = { poblacionN: 6, marcoAulas: 3 };

// Pool con atributos crudos por estudiante (edad/formación/condición) SIN
// filtrar por elegibilidad: habilita el conteo en vivo de esos tres criterios
// (que `population` no permite). s1=17 y s5=16 son menores de 18.
const POOL: MonitoreoRow[] = [
  { student_id: "s1", faculty: "Ingeniería", level: 1, age: 17, formation: "PREGRADO", condition: "REGULAR" },
  { student_id: "s2", faculty: "Ingeniería", level: 2, age: 20, formation: "PREGRADO", condition: "REGULAR" },
  { student_id: "s3", faculty: "Letras", level: 4, age: 22, formation: "MAESTRIA", condition: "REGULAR" },
  { student_id: "s4", faculty: "Letras", level: 4, age: 19, formation: "PREGRADO", condition: "POR REINCORPORACION" },
  { student_id: "s5", faculty: "Ingeniería", level: 3, age: 16, formation: "PREGRADO", condition: "REGULAR" },
  { student_id: "s6", faculty: "Ingeniería", level: 5, age: 25, formation: "PREGRADO", condition: "REGULAR" },
];
const FRAME_POOL = { aula_frame: AULA_FRAME, population: POPULATION, population_pool: POOL };

function base(): CriteriosSeleccionMarco {
  return seleccionInicial(CATALOGO);
}

describe("textKey", () => {
  it("normaliza acentos, comillas y no-alfanumérico", () => {
    expect(textKey("Ingeniería")).toBe("ingenieria");
    expect(textKey("DOCENTE ORDINARIO - PRINCIPAL")).toBe("docente_ordinario_principal");
    expect(textKey("  A Distancia ")).toBe("a_distancia");
  });
});

describe("unidadCriterio", () => {
  it("estudiantes para alumno, aulas para aula", () => {
    expect(unidadCriterio({ scope: "alumno" })).toBe("estudiantes");
    expect(unidadCriterio({ scope: "aula" })).toBe("aulas");
  });
});

describe("computeImpactoMarco", () => {
  it("en reposo la estimación iguala la cifra dura", () => {
    const imp = computeImpactoMarco(CATALOGO, base(), FRAME, REFS);
    expect(imp.hasFrame).toBe(true);
    expect(imp.aulasLive).toBe(3);
    expect(imp.aulasHard).toBe(3);
    expect(imp.docentesLive).toBe(2); // ana + beto (s3 dup no importa)
    expect(imp.docentesHard).toBe(2);
    expect(imp.estudiantesLive).toBe(6); // s1..s6 distintos
    expect(imp.activeAulaVars).toEqual([]);
    expect(imp.pendingAlumnoVars).toEqual([]);
  });

  it("sin pool: edad/condición/formación quedan pendientes (fallback)", () => {
    // Umbral de edad activo pero el frame NO trae population_pool: el impacto de
    // edad solo lo fija el motor al reconstruir.
    let sel = base();
    sel = setSeleccionVariable(sel, "age", setThreshold(seleccionVariable(sel, "age"), { op: ">=", min: 18 }));
    const imp = computeImpactoMarco(CATALOGO, sel, FRAME, REFS);
    expect(imp.pendingAlumnoVars).toContain("age");
    expect(imp.activeAlumnoVars).not.toContain("age");
    expect(imp.estudiantesLive).toBe(6); // sin poder recortar por edad
  });

  it("con pool: la edad recorta la población EN VIVO (menores de 18 fuera)", () => {
    let sel = base();
    sel = setSeleccionVariable(sel, "age", setThreshold(seleccionVariable(sel, "age"), { op: ">=", min: 18 }));
    const imp = computeImpactoMarco(CATALOGO, sel, FRAME_POOL, REFS);
    expect(imp.activeAlumnoVars).toContain("age");
    expect(imp.pendingAlumnoVars).not.toContain("age");
    // s1(17) y s5(16) caen; alcanzados = {s2,s3,s4,s6} = 4
    expect(imp.estudiantesLive).toBe(4);
    // criterios de aula sin cambios: aulas/docentes intactos
    expect(imp.aulasLive).toBe(3);
    expect(imp.docentesLive).toBe(2);
  });

  it("con pool en reposo la estimación sigue igualando la cifra dura", () => {
    const imp = computeImpactoMarco(CATALOGO, base(), FRAME_POOL, REFS);
    expect(imp.estudiantesLive).toBe(6);
    expect(imp.pendingAlumnoVars).toEqual([]);
    expect(imp.activeAlumnoVars).toEqual([]);
  });

  it("filtra por modalidad (flat de aula) y recomputa docentes/estudiantes", () => {
    // deselecciona VIRTUAL -> queda solo A1 y A3 (presencial), docente Ana
    let sel = base();
    const mod = seleccionVariable(sel, "modality");
    sel = setSeleccionVariable(sel, "modality", toggleCategoria(mod, "virtual"));
    const imp = computeImpactoMarco(CATALOGO, sel, FRAME, REFS);
    expect(imp.activeAulaVars).toContain("modality");
    expect(imp.aulasLive).toBe(2);
    expect(imp.docentesLive).toBe(1); // solo ana
    expect(imp.estudiantesLive).toBe(5); // A1:{s1,s2,s3} ∪ A3:{s5,s6} = 5
  });

  it("docente jerárquico: al menos uno del set marcado", () => {
    // deja solo DOCENTE CONTRATADO -> solo A2 pasa
    let sel = base();
    const tt = seleccionVariable(sel, "teacher_type");
    let next = toggleCategoria(tt, "docente_ordinario_principal"); // quita principal
    sel = setSeleccionVariable(sel, "teacher_type", next);
    const imp = computeImpactoMarco(CATALOGO, sel, FRAME, REFS);
    expect(imp.aulasLive).toBe(1);
    expect(imp.docentesLive).toBe(1); // beto
    expect(imp.estudiantesLive).toBe(2); // s3, s4
  });

  it("mínimo de elegibles descarta aulas bajo el umbral", () => {
    let sel = base();
    sel = { ...sel, minEligible: { threshold: 20 } };
    const imp = computeImpactoMarco(CATALOGO, sel, FRAME, REFS);
    // A3 tiene eligible_n=12 < 20 -> cae; quedan A1(30) y A2(25)
    expect(imp.aulasLive).toBe(2);
  });

  it("matriculados (numeric de aula) aplica umbral >=", () => {
    let sel = base();
    const en = seleccionVariable(sel, "enrolled_total");
    sel = setSeleccionVariable(sel, "enrolled_total", setThreshold(en, { op: ">=", min: 50 }));
    const imp = computeImpactoMarco(CATALOGO, sel, FRAME, REFS);
    expect(imp.activeAulaVars).toContain("enrolled_total");
    expect(imp.aulasLive).toBe(1); // solo A3 (55)
  });

  it("nivel del curso: rango por facultad filtra por course_level_num", () => {
    // Ingeniería admite niveles 1..1 -> A1(1) pasa, A3(2) cae; Letras sin rango pasa
    let sel = base();
    sel = setRangosFacultad(sel, textKey("Ingeniería"), [[1, 1]]);
    const imp = computeImpactoMarco(CATALOGO, sel, FRAME, REFS);
    expect(imp.activeAulaVars).toContain("course_level");
    expect(imp.aulasLive).toBe(2); // A1 (nivel 1) + A2 (Letras, sin rango)
  });

  it("faculty de alumno (marco) recorta estudiantes vía population", () => {
    // deja solo Ingeniería -> estudiantes de Letras (s3,s4) salen
    let sel = base();
    const fac = seleccionVariable(sel, "faculty");
    sel = setSeleccionVariable(sel, "faculty", toggleCategoria(fac, "letras"));
    const imp = computeImpactoMarco(CATALOGO, sel, FRAME, REFS);
    expect(imp.activeAlumnoVars).toContain("faculty");
    // aulas no cambian (filtro es de estudiante), pero estudiantes sí: s3,s4 fuera
    expect(imp.estudiantesLive).toBe(4); // s1,s2,s5,s6
  });

  it("criterio de alumno no computable (age) se reporta pendiente", () => {
    let sel = base();
    const age = seleccionVariable(sel, "age");
    sel = setSeleccionVariable(sel, "age", setLayer(setThreshold(age, { op: ">=", min: 18 }), "marco"));
    const imp = computeImpactoMarco(CATALOGO, sel, FRAME, REFS);
    expect(imp.pendingAlumnoVars).toContain("age");
    // no cambia estudiantes (no hay atributo por estudiante)
    expect(imp.estudiantesLive).toBe(6);
  });

  it("sin frame degrada a solo cifras duras", () => {
    const imp = computeImpactoMarco(CATALOGO, base(), null, REFS);
    expect(imp.hasFrame).toBe(false);
    expect(imp.aulasLive).toBeNull();
    expect(imp.aulasHard).toBe(3);
    expect(imp.estudiantesHard).toBe(6);
  });
});
