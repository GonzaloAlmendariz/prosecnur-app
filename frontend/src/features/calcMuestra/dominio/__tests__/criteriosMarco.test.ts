/**
 * Candado del modelo EVALUABLE de criterios por categoría (alumno y aula).
 * Cubre defaults, toggles inmutables (include/exclude), grupos jerárquicos,
 * numéricos (edad: umbral/rango), ordinales (ciclo: set o "desde N"), capa del
 * criterio de alumno, excepciones por facultad, rangos de nivel y el conteo por
 * aula cliente (unión de sets).
 */
import { describe, expect, it } from "vitest";
import type { CriteriosCatalogo, CriteriosSeleccionMarco } from "../../../../api/client";
import {
  aulasCubiertas,
  capaDe,
  categoriaMarcada,
  estadoGrupo,
  minEligibleThreshold,
  ordinalIncluido,
  reconciliarSeleccionConCatalogo,
  removeExcepcion,
  resumenVariable,
  seleccionCanonica,
  seleccionInicial,
  seleccionVariable,
  setFromValue,
  setLayer,
  setMinEligible,
  setRangosFacultad,
  setSeleccionVariable,
  setThreshold,
  toggleCategoria,
  toggleGrupo,
  toggleOrdinal,
  upsertExcepcion,
} from "../criteriosMarco";

/** Catálogo con las cinco formas y ambos scopes. */
const CATALOGO: CriteriosCatalogo = {
  schema: "calc_muestra_criterios_catalogo_v1",
  variables: [
    {
      id: "modality",
      scope: "aula",
      label: "Modalidad",
      kind: "flat",
      mappedColumn: "MODALIDAD",
      categories: [
        { key: "presencial", label: "Presencial", aulas: 4624, variants: ["Presencial", "PRESENCIAL"] },
        { key: "semipresencial", label: "Semipresencial", aulas: 322 },
        { key: "virtual", label: "Virtual", aulas: 162 },
        { key: "a_distancia", label: "A distancia", aulas: 154 },
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
          aulas: 2000,
          children: [
            { key: "principal", label: "Principal", aulas: 800 },
            { key: "asociado", label: "Asociado", aulas: 700 },
            { key: "auxiliar", label: "Auxiliar", aulas: 500 },
          ],
        },
        {
          key: "docente_contratado",
          label: "Docente contratado",
          aulas: 900,
          children: [{ key: "contratado", label: "Contratado", aulas: 900 }],
        },
      ],
    },
    {
      id: "course_level",
      scope: "aula",
      label: "Nivel del curso",
      kind: "range",
      values: [0, 2, 4, 5, 8, 10, 12],
    },
    {
      id: "age",
      scope: "alumno",
      label: "Edad",
      kind: "numeric",
      mappedColumn: "EDAD",
      numericRange: { min: 16, max: 65 },
      defaultLayer: "marco",
    },
    {
      id: "level",
      scope: "alumno",
      label: "Ciclo",
      kind: "ordinal",
      values: [1, 2, 3, 4, 5, 6, 7, 8],
      defaultLayer: "instrumento",
    },
  ],
};

describe("seleccionInicial", () => {
  it("incluye todo por defecto; todo criterio de alumno nace en marco", () => {
    const sel = seleccionInicial(CATALOGO);
    expect(sel.byVariable.modality.categories).toHaveLength(4);
    expect(sel.byVariable.teacher_type.match).toBe("any");
    // range no vive en byVariable.
    expect(sel.byVariable.course_level).toBeUndefined();
    // numeric: sin threshold = incluye todo; alumno siempre en marco.
    expect(sel.byVariable.age.threshold).toBeUndefined();
    expect(sel.byVariable.age.layer).toBe("marco");
    // ordinal: todos los valores incluidos; alumno siempre en marco.
    expect(sel.byVariable.level.includeValues).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(sel.byVariable.level.layer).toBe("marco");
  });

  it("tolera catálogo nulo", () => {
    expect(seleccionInicial(null)).toEqual({ byVariable: {} });
  });
});

describe("seleccionCanonica — teacher_type", () => {
  // Catálogo jerárquico realista: los hijos portan el tipo completo en su label
  // (categoriasDeVariable aplana grupos → hijos, y el match usa label+key).
  const CATALOGO_DOCENTES: CriteriosCatalogo = {
    schema: "calc_muestra_criterios_catalogo_v1",
    variables: [
      {
        id: "teacher_type",
        scope: "aula",
        label: "Tipo de docente",
        kind: "hierarchical",
        groups: [
          {
            key: "g_contratado",
            label: "Docente contratado",
            aulas: 900,
            children: [{ key: "contratado", label: "Docente contratado", aulas: 900 }],
          },
          {
            key: "g_ordinario",
            label: "Docente ordinario",
            aulas: 2000,
            children: [
              { key: "ord_principal", label: "Docente ordinario principal", aulas: 800 },
              { key: "ord_asociado", label: "Docente ordinario asociado", aulas: 700 },
              { key: "ord_auxiliar", label: "Docente ordinario auxiliar", aulas: 500 },
            ],
          },
          {
            key: "g_pre",
            label: "Pre-docente",
            aulas: 300,
            children: [
              { key: "jefe_practica", label: "Jefe de práctica", aulas: 200 },
              { key: "instructor", label: "Instructor", aulas: 100 },
            ],
          },
          {
            key: "g_extra",
            label: "Docente extraordinario",
            aulas: 150,
            children: [{ key: "ext_visitante", label: "Docente extraordinario visitante", aulas: 150 }],
          },
        ],
      },
    ],
  };

  it("incluye SOLO contratado + ordinario; excluye extraordinario y pre-docente", () => {
    const sel = seleccionCanonica(CATALOGO_DOCENTES).byVariable.teacher_type;
    expect(sel.mode).toBe("include");
    expect(sel.match).toBe("any");
    const canonicas = new Set(sel.categories ?? []);
    // Contratado + los tres ordinarios (Principal/Asociado/Auxiliar).
    expect(canonicas).toEqual(new Set(["contratado", "ord_principal", "ord_asociado", "ord_auxiliar"]));
    // El substring "ordinario" NO debe arrastrar "EXTRA-ordinario".
    expect(canonicas.has("ext_visitante")).toBe(false);
    // Pre-docente (jefe de práctica / instructor) queda fuera.
    expect(canonicas.has("jefe_practica")).toBe(false);
    expect(canonicas.has("instructor")).toBe(false);
  });
});

describe("reconciliarSeleccionConCatalogo", () => {
  // Catálogo con el rol teacher_type ya bien mapeado a "Tipo de docente".
  const CATALOGO_REAL: CriteriosCatalogo = {
    schema: "calc_muestra_criterios_catalogo_v1",
    variables: [
      {
        id: "teacher_type",
        scope: "aula",
        label: "Tipo de docente",
        kind: "hierarchical",
        groups: [
          {
            key: "g_contratado",
            label: "Docente contratado",
            aulas: 900,
            children: [{ key: "contratado", label: "Docente contratado", aulas: 900 }],
          },
          {
            key: "g_ordinario",
            label: "Docente ordinario",
            aulas: 2000,
            children: [
              { key: "ord_principal", label: "Docente ordinario principal", aulas: 800 },
              { key: "ord_asociado", label: "Docente ordinario asociado", aulas: 700 },
              { key: "ord_auxiliar", label: "Docente ordinario auxiliar", aulas: 500 },
            ],
          },
          {
            key: "g_extra",
            label: "Docente extraordinario",
            aulas: 150,
            children: [{ key: "ext_visitante", label: "Docente extraordinario visitante", aulas: 150 }],
          },
        ],
      },
      {
        id: "formation",
        scope: "alumno",
        label: "Formación",
        kind: "flat",
        categories: [
          { key: "pregrado", label: "Pregrado", aulas: 5000 },
          { key: "maestria", label: "Maestría", aulas: 400 },
          { key: "doctorado", label: "Doctorado", aulas: 120 },
        ],
      },
      {
        id: "modality",
        scope: "aula",
        label: "Modalidad",
        kind: "flat",
        categories: [
          { key: "presencial", label: "Presencial", aulas: 4000 },
          { key: "virtual", label: "Virtual", aulas: 300 },
        ],
      },
    ],
  };

  it("(a) selección STALE de teacher_type (claves de la columna vieja) se resetea a canónico", () => {
    const stale: CriteriosSeleccionMarco = {
      byVariable: {
        // Claves heredadas de "Condición" (regular/reincorporado): ninguna matchea
        // un tipo de docente real → 100% stale → excluiría todos los cursos-horario.
        teacher_type: { mode: "include", match: "any", categories: ["regular", "reincorporado"], layer: "marco" },
        formation: { mode: "include", categories: ["pregrado"] },
        modality: { mode: "include", categories: ["presencial", "virtual"] },
      },
    };
    const out = reconciliarSeleccionConCatalogo(stale, CATALOGO_REAL);
    const tt = new Set(out.byVariable.teacher_type.categories ?? []);
    // Reset a canónico: contratado + ordinario, SIN extraordinario.
    expect(tt).toEqual(new Set(["contratado", "ord_principal", "ord_asociado", "ord_auxiliar"]));
    expect(tt.has("ext_visitante")).toBe(false);
    // Las demás (válidas) quedan intactas.
    expect(out.byVariable.formation.categories).toEqual(["pregrado"]);
    expect(out.byVariable.modality.categories).toEqual(["presencial", "virtual"]);
  });

  it("(b) selección VÁLIDA parcial (pregrado sin maestría) se conserva intacta", () => {
    const sel: CriteriosSeleccionMarco = {
      byVariable: {
        teacher_type: { mode: "include", match: "any", categories: ["contratado"] },
        formation: { mode: "include", categories: ["pregrado"] },
        modality: { mode: "include", categories: ["presencial"] },
      },
    };
    const out = reconciliarSeleccionConCatalogo(sel, CATALOGO_REAL);
    expect(out.byVariable.formation.categories).toEqual(["pregrado"]);
    expect(out.byVariable.teacher_type.categories).toEqual(["contratado"]);
    expect(out.byVariable.modality.categories).toEqual(["presencial"]);
  });

  it("(c) variable sin selección guardada toma la canónica", () => {
    const sel: CriteriosSeleccionMarco = {
      byVariable: {
        teacher_type: { mode: "include", match: "any", categories: ["contratado"] },
        // formation y modality sin entrada persistida.
      },
    };
    const out = reconciliarSeleccionConCatalogo(sel, CATALOGO_REAL);
    expect(out.byVariable.formation.categories).toEqual(["pregrado"]);
    expect(new Set(out.byVariable.modality.categories ?? [])).toEqual(new Set(["presencial"]));
    // La válida no se toca.
    expect(out.byVariable.teacher_type.categories).toEqual(["contratado"]);
  });

  it("preserva courseLevelRanges y minEligible", () => {
    const sel: CriteriosSeleccionMarco = {
      byVariable: { teacher_type: { mode: "include", match: "any", categories: ["regular"] } },
      courseLevelRanges: { ingenieria: [[2, 10]] },
      minEligible: { threshold: 15 },
    };
    const out = reconciliarSeleccionConCatalogo(sel, CATALOGO_REAL);
    expect(out.courseLevelRanges).toEqual({ ingenieria: [[2, 10]] });
    expect(out.minEligible).toEqual({ threshold: 15 });
  });

  it("es idempotente (reconciliar dos veces == una)", () => {
    const stale: CriteriosSeleccionMarco = {
      byVariable: { teacher_type: { mode: "include", match: "any", categories: ["regular"] } },
    };
    const once = reconciliarSeleccionConCatalogo(stale, CATALOGO_REAL);
    const twice = reconciliarSeleccionConCatalogo(once, CATALOGO_REAL);
    expect(twice).toEqual(once);
  });

  it("catálogo sin variables no altera la selección", () => {
    const sel: CriteriosSeleccionMarco = {
      byVariable: { teacher_type: { mode: "include", categories: ["regular"] } },
    };
    const out = reconciliarSeleccionConCatalogo(sel, { schema: "x", variables: [] });
    expect(out.byVariable).toEqual(sel.byVariable);
  });

  it("no revienta si categories llega como escalar (jsonlite desempaca array de 1)", () => {
    // El .pulso persistido puede traer `categories: "regular"` (no array) tras
    // pasar por jsonlite; sin la coerción defensiva, .some() crasheaba la app.
    const sel = {
      byVariable: { teacher_type: { mode: "include", match: "any", categories: "regular" } },
    } as unknown as CriteriosSeleccionMarco;
    const out = reconciliarSeleccionConCatalogo(sel, CATALOGO_REAL);
    // El escalar stale "regular" no matchea ningún tipo de docente → canónico
    // (contratado + ordinario), y sobre todo NO revienta con .some().
    expect(new Set(out.byVariable.teacher_type.categories ?? [])).toEqual(
      new Set(["contratado", "ord_principal", "ord_asociado", "ord_auxiliar"]),
    );
  });
});

describe("toggleCategoria (include/exclude)", () => {
  it("agrega y quita preservando inmutabilidad", () => {
    const sel = seleccionVariable(seleccionInicial(CATALOGO), "modality");
    expect(categoriaMarcada(sel, "virtual")).toBe(true);
    const sinVirtual = toggleCategoria(sel, "virtual");
    expect(categoriaMarcada(sinVirtual, "virtual")).toBe(false);
    expect(categoriaMarcada(sel, "virtual")).toBe(true);
  });

  it("modo exclude: marcar = quitar del set de excluidas", () => {
    const sel = { mode: "exclude" as const, categories: ["virtual"] };
    expect(categoriaMarcada(sel, "virtual")).toBe(false);
    expect(categoriaMarcada(sel, "presencial")).toBe(true);
    const marcada = toggleCategoria(sel, "virtual");
    expect(marcada.categories).not.toContain("virtual");
    expect(categoriaMarcada(marcada, "virtual")).toBe(true);
  });
});

describe("grupos jerárquicos", () => {
  const hijos = ["principal", "asociado", "auxiliar"];
  it("estadoGrupo distingue all/some/none", () => {
    expect(estadoGrupo({ mode: "include", categories: [...hijos] }, hijos)).toBe("all");
    expect(estadoGrupo({ mode: "include", categories: ["principal"] }, hijos)).toBe("some");
    expect(estadoGrupo({ mode: "include", categories: [] }, hijos)).toBe("none");
  });
  it("toggleGrupo marca todos si está parcial y desmarca si está completo", () => {
    const parcial = { mode: "include" as const, categories: ["principal"] };
    const todos = toggleGrupo(parcial, hijos);
    expect(estadoGrupo(todos, hijos)).toBe("all");
    expect(estadoGrupo(toggleGrupo(todos, hijos), hijos)).toBe("none");
  });
});

describe("numeric (edad)", () => {
  it("setThreshold fija y limpia el umbral", () => {
    const base = { mode: "include" as const };
    const con = setThreshold(base, { op: "between", min: 22, max: 28 });
    expect(con.threshold).toEqual({ op: "between", min: 22, max: 28 });
    const sin = setThreshold(con, undefined);
    expect(sin.threshold).toBeUndefined();
  });
});

describe("ordinal (ciclo)", () => {
  const todos = [1, 2, 3, 4, 5, 6, 7, 8];
  it("ordinalIncluido respeta fromValue y el set", () => {
    expect(ordinalIncluido({ mode: "include", fromValue: 2 }, 1)).toBe(false);
    expect(ordinalIncluido({ mode: "include", fromValue: 2 }, 3)).toBe(true);
    expect(ordinalIncluido({ mode: "include", includeValues: [2, 4] }, 4)).toBe(true);
    expect(ordinalIncluido({ mode: "include", includeValues: [2, 4] }, 3)).toBe(false);
  });
  it("setFromValue excluye ciclo 1 (desde 2)", () => {
    const sel = setFromValue({ mode: "include" }, 2);
    expect(sel.fromValue).toBe(2);
    expect(ordinalIncluido(sel, 1)).toBe(false);
  });
  it("toggleOrdinal materializa el set y quita un valor", () => {
    const sel = toggleOrdinal({ mode: "include", fromValue: 1 }, 1, todos);
    expect(sel.fromValue).toBeUndefined();
    expect(sel.includeValues).toEqual([2, 3, 4, 5, 6, 7, 8]);
  });
});

describe("capa del criterio de alumno", () => {
  it("capaDe cae al default de la variable y setLayer la reubica", () => {
    const variable = CATALOGO.variables[4]; // level, defaultLayer instrumento
    expect(capaDe({ mode: "include" }, variable)).toBe("instrumento");
    expect(capaDe(setLayer({ mode: "include" }, "marco"), variable)).toBe("marco");
  });
});

describe("excepciones por facultad", () => {
  it("upsert y remove son inmutables", () => {
    const base = seleccionVariable(seleccionInicial(CATALOGO), "modality");
    const conExc = upsertExcepcion(base, "arte_y_diseno", { categories: ["taller"], op: "add" });
    expect(conExc.exceptions?.arte_y_diseno).toEqual({ categories: ["taller"], op: "add" });
    expect(base.exceptions).toBeUndefined();
    expect(removeExcepcion(conExc, "arte_y_diseno").exceptions).toBeUndefined();
  });
});

describe("aulasCubiertas / resumenVariable", () => {
  it("suma las aulas de las categorías marcadas (unión de sets)", () => {
    const soloPresencial = { mode: "include" as const, categories: ["presencial"] };
    expect(aulasCubiertas(CATALOGO.variables[0], soloPresencial)).toBe(4624);
    const resumen = resumenVariable(CATALOGO.variables[0], { byVariable: { modality: soloPresencial } });
    expect(resumen.seleccionadas).toBe(1);
    expect(resumen.total).toBe(4);
    expect(resumen.aulasTotales).toBe(4624 + 322 + 162 + 154);
  });

  it("resumen de ordinal cuenta valores incluidos", () => {
    const sel = { byVariable: { level: { mode: "include" as const, fromValue: 2 } } };
    const resumen = resumenVariable(CATALOGO.variables[4], sel);
    expect(resumen.total).toBe(8);
    expect(resumen.seleccionadas).toBe(7); // ciclos 2..8
  });
});

describe("rangos de nivel y umbral de elegibles", () => {
  it("setRangosFacultad agrega y elimina", () => {
    const sel = setRangosFacultad({ byVariable: {} }, "arte_y_diseno", [[2, 10]]);
    expect(sel.courseLevelRanges?.arte_y_diseno).toEqual([[2, 10]]);
    expect(setRangosFacultad(sel, "arte_y_diseno", []).courseLevelRanges).toBeUndefined();
  });
  it("minEligibleThreshold cae al default y setMinEligible lo fija", () => {
    expect(minEligibleThreshold({ byVariable: {} })).toBe(10);
    expect(minEligibleThreshold(setMinEligible({ byVariable: {} }, 15))).toBe(15);
  });
});

describe("setSeleccionVariable", () => {
  it("reemplaza una variable sin tocar las demás", () => {
    const inicial = seleccionInicial(CATALOGO);
    const next = setSeleccionVariable(inicial, "modality", { mode: "include", categories: ["presencial"] });
    expect(next.byVariable.modality.categories).toEqual(["presencial"]);
    expect(next.byVariable.teacher_type).toBe(inicial.byVariable.teacher_type);
    expect(inicial.byVariable.modality.categories).toHaveLength(4);
  });
});
