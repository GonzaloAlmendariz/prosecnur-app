import { describe, expect, test } from "vitest";
import {
  buildExplorerGrain,
  formatPersonTag,
  markRosterRows,
  orderColumnsForRoster,
  repeatContextFromBase,
  resolveRosterColumns,
  isRepeatVariableApplicable,
  scopeRepeatSections,
  scopeRepeatVariableCounts,
  withRepeatIdentityFilter,
  ROSTER_RELATIONAL_NOTE,
} from "./rosterExplorer";
import type { RepeatGrain } from "./repeatIdentity";

describe("resolveRosterColumns", () => {
  const cols = ["_index", "_parent_index", "current_code", "current_label", "servicio", "P1"];

  test("resuelve persona por _parent_index e identidad por current_*", () => {
    expect(resolveRosterColumns(cols)).toEqual({
      personKey: "_parent_index",
      serviceLabelKey: "current_label",
      serviceCodeKey: "current_code",
    });
  });

  test("prioriza el linkKey declarado cuando existe en las columnas", () => {
    const withAlt = ["_submission__id", "current_label"];
    expect(
      resolveRosterColumns(withAlt, { linkKey: "_submission__id" }).personKey,
    ).toBe("_submission__id");
  });

  test("cae a _parent_index si el linkKey declarado no está presente", () => {
    expect(
      resolveRosterColumns(cols, { linkKey: "_no_existe" }).personKey,
    ).toBe("_parent_index");
  });

  test("heurística *parent_index cuando no hay match exacto", () => {
    const grouped = ["grupo/_parent_index", "current_label"];
    expect(resolveRosterColumns(grouped).personKey).toBe("grupo/_parent_index");
  });

  test("es case-insensitive y devuelve null para lo ausente", () => {
    const res = resolveRosterColumns(["CURRENT_LABEL", "P1"]);
    expect(res.serviceLabelKey).toBe("CURRENT_LABEL");
    expect(res.personKey).toBeNull();
    expect(res.serviceCodeKey).toBeNull();
  });

  test("tolera lista vacía", () => {
    expect(resolveRosterColumns([])).toEqual({
      personKey: null,
      serviceLabelKey: null,
      serviceCodeKey: null,
    });
  });
});

describe("formatPersonTag", () => {
  test("prefija Persona # al valor del vínculo", () => {
    expect(formatPersonTag("123")).toBe("Persona #123");
    expect(formatPersonTag("  7 ")).toBe("Persona #7");
  });

  test("marca ausencia de vínculo", () => {
    expect(formatPersonTag("")).toBe("Persona sin vínculo");
    expect(formatPersonTag(null)).toBe("Persona sin vínculo");
    expect(formatPersonTag(undefined)).toBe("Persona sin vínculo");
  });
});

describe("markRosterRows", () => {
  test("agrupa filas contiguas de la misma persona", () => {
    const rows = [
      { _parent_index: "1", current_label: "Salud" },
      { _parent_index: "1", current_label: "Agua" },
      { _parent_index: "2", current_label: "Salud" },
      { _parent_index: "2", current_label: "Comida" },
      { _parent_index: "2", current_label: "Abrigo" },
    ];
    const marks = markRosterRows(rows, "_parent_index");
    expect(marks.map((m) => m.isGroupStart)).toEqual([true, false, true, false, false]);
    expect(marks.map((m) => m.isGroupEnd)).toEqual([false, true, false, false, true]);
    expect(marks[0].person).toBe("1");
    expect(marks[4].person).toBe("2");
  });

  test("sin columna de persona cada fila es su propio grupo", () => {
    const rows = [{ a: "x" }, { a: "y" }];
    const marks = markRosterRows(rows, null);
    expect(marks).toEqual([
      { person: "", isGroupStart: true, isGroupEnd: true },
      { person: "", isGroupStart: true, isGroupEnd: true },
    ]);
  });

  test("tolera filas vacías", () => {
    expect(markRosterRows([], "_parent_index")).toEqual([]);
  });
});

describe("repeatContextFromBase", () => {
  test("null para bases que no son hija repeat", () => {
    expect(repeatContextFromBase(null)).toBeNull();
    expect(repeatContextFromBase({ source_kind: "manual" })).toBeNull();
    expect(repeatContextFromBase({ source_kind: "surveymonkey" })).toBeNull();
  });

  test("deriva el contexto de una base hija con su metadata", () => {
    const grain: RepeatGrain = {
      kind: "instancia",
      n_instancias: 668,
      n_personas: 427,
      repeat_group: "rep_servicios",
      parent_base: "acnur_pdm",
      nota: "clustering",
    };
    expect(
      repeatContextFromBase({
        source_kind: "kobo_repeat",
        n_filas: 668,
        repeat_group: "rep_servicios",
        parent_base: "acnur_pdm",
        link_key: "_parent_index",
        grain,
      }),
    ).toEqual({
      grain,
      repeatGroup: "rep_servicios",
      parentBase: "acnur_pdm",
      linkKey: "_parent_index",
      nInstancias: 668,
    });
  });

  test("degrada a null en los campos que la metadata no trae", () => {
    expect(repeatContextFromBase({ source_kind: "kobo_repeat", n_filas: 668 })).toEqual({
      grain: null,
      repeatGroup: null,
      parentBase: null,
      linkKey: null,
      nInstancias: 668,
    });
  });
});

describe("orderColumnsForRoster", () => {
  const cols = [
    { key: "srv_claridad" },
    { key: "current_code" },
    { key: "current_label" },
    { key: "_parent_index" },
    { key: "P1" },
  ];
  const roster = {
    personKey: "_parent_index",
    serviceLabelKey: "current_label",
    serviceCodeKey: "current_code",
  };

  test("lleva Persona → Servicio → Código al frente y conserva el resto", () => {
    expect(orderColumnsForRoster(cols, roster).map((c) => c.key)).toEqual([
      "_parent_index",
      "current_label",
      "current_code",
      "srv_claridad",
      "P1",
    ]);
  });

  test("omite columnas ausentes sin duplicar", () => {
    const partial = [{ key: "current_label" }, { key: "P1" }];
    expect(orderColumnsForRoster(partial, roster).map((c) => c.key)).toEqual([
      "current_label",
      "P1",
    ]);
  });

  test("sin columnas relacionales devuelve el orden original", () => {
    const none = { personKey: null, serviceLabelKey: null, serviceCodeKey: null };
    expect(orderColumnsForRoster(cols, none)).toBe(cols);
  });
});

describe("buildExplorerGrain", () => {
  test("prefiere el grano real de Analítica intacto", () => {
    const grain: RepeatGrain = {
      kind: "instancia",
      n_instancias: 668,
      n_personas: 427,
      repeat_group: "rep_servicios",
      parent_base: "acnur_pdm",
      nota: "clustering original",
    };
    expect(buildExplorerGrain({ grain, nInstancias: 5 })).toBe(grain);
  });

  test("arma un grano con el N conocido y la nota relacional", () => {
    const built = buildExplorerGrain({
      nInstancias: 668,
      repeatGroup: "rep_servicios",
      parentBase: "acnur_pdm",
    });
    expect(built).toEqual({
      kind: "instancia",
      n_instancias: 668,
      n_personas: null,
      repeat_group: "rep_servicios",
      parent_base: "acnur_pdm",
      nota: ROSTER_RELATIONAL_NOTE,
    });
  });

  test("null cuando no hay N ni grupo que mostrar", () => {
    expect(buildExplorerGrain({})).toBeNull();
    expect(buildExplorerGrain({ nInstancias: null, nPersonas: null })).toBeNull();
  });
});

describe("explorador por instancia repeat", () => {
  const sections = [
    {
      nombre: "Servicio",
      variables: [
        { name: "current_code", n_validos: 8, n_nulos: 0, repeat_scope: "identity" as const },
        { name: "srv_claridad", n_validos: 7, n_nulos: 1, repeat_scope: "shared" as const },
        {
          name: "srv_legal_resolucion",
          n_validos: 3,
          n_nulos: 5,
          repeat_scope: "conditional" as const,
          applicable_codes: ["legal"],
          counts_by_code: [
            { code: "legal", n_instancias: 4, n_aplicables: 4, n_validos: 3, n_nulos: 1 },
            { code: "salud", n_instancias: 4, n_aplicables: 0, n_validos: 0, n_nulos: 0 },
          ],
        },
        {
          name: "srv_salud_escucha",
          n_validos: 4,
          n_nulos: 4,
          repeat_scope: "conditional" as const,
          applicable_codes: ["salud"],
        },
      ],
    },
  ];

  test("Todos conserva identidad, comunes y condicionales", () => {
    expect(scopeRepeatSections(sections, null)).toBe(sections);
  });

  test("un código conserva identity/shared y sólo sus condicionales", () => {
    const scoped = scopeRepeatSections(sections, "legal");
    expect(scoped[0].variables.map((variable) => variable.name)).toEqual([
      "current_code",
      "srv_claridad",
      "srv_legal_resolucion",
    ]);
    expect(scoped[0].variables[2]).toMatchObject({ n_aplicables: 4, n_validos: 3, n_nulos: 1 });
  });

  test("aplicabilidad y conteos degradan sin inventar datos", () => {
    expect(isRepeatVariableApplicable(sections[0].variables[2], "salud")).toBe(false);
    expect(isRepeatVariableApplicable(sections[0].variables[1], "salud")).toBe(true);
    expect(scopeRepeatVariableCounts(sections[0].variables[1], "salud")).toBe(sections[0].variables[1]);
  });

  test("limpia cualquier filtro manual de identidad antes de componer el estructural", () => {
    const manual = { current_code: ["salud"], distrito: ["lima"] };
    expect(withRepeatIdentityFilter(manual, { identity_var: "current_code" }, "legal")).toEqual({
      distrito: ["lima"],
      current_code: ["legal"],
    });
    expect(withRepeatIdentityFilter(manual, { identity_var: "current_code" }, null)).toEqual({
      distrito: ["lima"],
    });
    expect(manual).toEqual({ current_code: ["salud"], distrito: ["lima"] });
    expect(withRepeatIdentityFilter(manual, null, "legal")).toBe(manual);
  });
});
