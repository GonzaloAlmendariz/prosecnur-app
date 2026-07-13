import { describe, expect, test } from "vitest";
import {
  buildExplorerGrain,
  formatPersonTag,
  markRosterRows,
  orderColumnsForRoster,
  repeatContextFromBase,
  resolveRosterColumns,
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
