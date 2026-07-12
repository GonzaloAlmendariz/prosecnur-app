import { describe, expect, test } from "vitest";
import {
  buildRelationalMetaMap,
  deriveRelationalKind,
  externalRosterBadgeLabel,
  formatRelationalRepeatHeadline,
  normalizeRelationalRuleMeta,
  normalizeRelationalSummary,
  relationalRowId,
  resolveRelationalInfo,
  type RelationalRowSignals,
} from "./relationalPlan";

// Señales base de una regla no-relacional; cada test sobreescribe lo suyo.
function sig(overrides: Partial<RelationalRowSignals> = {}): RelationalRowSignals {
  return {
    tipoRegla: null,
    rosterSubtype: null,
    categoriaUx: null,
    tabla: "principal",
    issueCode: null,
    targetVar: null,
    variables: [],
    ...overrides,
  };
}

describe("normalizeRelationalSummary", () => {
  test("normaliza el contrato del backend (payload PDM)", () => {
    const summary = normalizeRelationalSummary({
      n_relational: 4,
      n_requires_external_dataset: 2,
      repeat_groups: ["rep_servicios"],
      external_datasets: ["listadoedp"],
      repeats: [
        {
          repeat_group: "rep_servicios",
          sm_conductor: "services",
          identity_var: "current_code",
          repeat_count: "count-selected(${services})",
        },
      ],
    });
    expect(summary).not.toBeNull();
    expect(summary?.nRelational).toBe(4);
    expect(summary?.nRequiresExternalDataset).toBe(2);
    expect(summary?.repeatGroups).toEqual(["rep_servicios"]);
    expect(summary?.externalDatasets).toEqual(["listadoedp"]);
    expect(summary?.repeats).toHaveLength(1);
    expect(summary?.repeats[0]).toEqual({
      repeatGroup: "rep_servicios",
      smConductor: "services",
      identityVar: "current_code",
      repeatCount: "count-selected(${services})",
    });
  });

  test("tolera counts como string y NA (payload R)", () => {
    const summary = normalizeRelationalSummary({
      n_relational: "3",
      n_requires_external_dataset: "0",
      repeat_groups: "rep_hijos",
      external_datasets: "NA",
      repeats: [{ repeat_group: "rep_hijos", sm_conductor: "NA", identity_var: null }],
    });
    expect(summary?.nRelational).toBe(3);
    expect(summary?.repeatGroups).toEqual(["rep_hijos"]);
    expect(summary?.externalDatasets).toEqual([]);
    expect(summary?.repeats[0]?.smConductor).toBeNull();
    expect(summary?.repeats[0]?.repeatCount).toBeNull();
  });

  test("devuelve null cuando no hay nada relacional (instrumento sin repeat)", () => {
    expect(
      normalizeRelationalSummary({
        n_relational: 0,
        n_requires_external_dataset: 0,
        repeat_groups: [],
        external_datasets: [],
        repeats: [],
      }),
    ).toBeNull();
    expect(normalizeRelationalSummary(null)).toBeNull();
    expect(normalizeRelationalSummary("nope")).toBeNull();
  });

  test("descarta repeats sin repeat_group", () => {
    const summary = normalizeRelationalSummary({
      n_relational: 1,
      repeats: [{ sm_conductor: "x" }, { repeat_group: "rep_ok" }],
    });
    expect(summary?.repeats).toHaveLength(1);
    expect(summary?.repeats[0]?.repeatGroup).toBe("rep_ok");
  });
});

describe("normalizeRelationalRuleMeta + buildRelationalMetaMap", () => {
  test("lee los flags inline de una fila del plan", () => {
    const meta = normalizeRelationalRuleMeta({
      relational: true,
      repeat_group: "rep_servicios",
      depends_on_child_base: true,
      requires_external_dataset: false,
      external_datasets: [],
      roster_subtype: "relacional",
    });
    expect(meta.relational).toBe(true);
    expect(meta.repeatGroup).toBe("rep_servicios");
    expect(meta.dependsOnChildBase).toBe(true);
    expect(meta.requiresExternalDataset).toBe(false);
    expect(meta.rosterSubtype).toBe("relacional");
  });

  test("mapea por ID (mayúscula del preview) y tolera alternativas", () => {
    const map = buildRelationalMetaMap([
      { ID: "coh_r1", relational: true, repeat_group: "rep_servicios" },
      { id_regla: "ext_1", requires_external_dataset: true, external_datasets: ["listadoedp"] },
      { relational: true }, // sin id → se ignora
    ]);
    expect(map.size).toBe(2);
    expect(map.get("coh_r1")?.relational).toBe(true);
    expect(map.get("ext_1")?.externalDatasets).toEqual(["listadoedp"]);
  });

  test("relationalRowId prioriza ID sobre id/id_regla", () => {
    expect(relationalRowId({ ID: "A", id: "B", id_regla: "C" })).toBe("A");
    expect(relationalRowId({ id_regla: "C" })).toBe("C");
    expect(relationalRowId({})).toBeNull();
  });
});

describe("deriveRelationalKind", () => {
  test("RC1 cardinalidad por tipo_regla repeat_length", () => {
    expect(deriveRelationalKind(sig({ tipoRegla: "repeat_length" }))).toBe("cardinality");
    expect(deriveRelationalKind(sig({ rosterSubtype: "count" }))).toBe("cardinality");
  });

  test("RC5 correspondencia: subtipo relacional en la madre", () => {
    expect(
      deriveRelationalKind(
        sig({ tipoRegla: "coherence", rosterSubtype: "relacional", tabla: "principal", targetVar: "services" }),
      ),
    ).toBe("correspondence");
  });

  test("RC3 referencial: subtipo relacional en la hija (_parent_index)", () => {
    expect(
      deriveRelationalKind(
        sig({ tipoRegla: "coherence", rosterSubtype: "relacional", tabla: "rep_servicios", targetVar: "_parent_index" }),
      ),
    ).toBe("referential");
  });

  test("RC4 unicidad: duplicate sobre current_code/_parent_index", () => {
    expect(
      deriveRelationalKind(sig({ tipoRegla: "duplicate", variables: ["_parent_index", "current_code"] })),
    ).toBe("uniqueness");
    // duplicate ordinario NO es relacional.
    expect(deriveRelationalKind(sig({ tipoRegla: "duplicate", variables: ["dni"] }))).toBe("other");
  });

  test("regla ordinaria no es relacional", () => {
    expect(deriveRelationalKind(sig({ tipoRegla: "required" }))).toBe("other");
  });
});

describe("resolveRelationalInfo", () => {
  test("solo derivado (sin plan meta): marca relacional y depende de la hija", () => {
    const info = resolveRelationalInfo(sig({ tipoRegla: "repeat_length", tabla: "rep_servicios" }));
    expect(info.relational).toBe(true);
    expect(info.kind).toBe("cardinality");
    expect(info.repeatGroup).toBe("rep_servicios");
    expect(info.dependsOnChildBase).toBe(true);
  });

  test("childBaseMissing desde issue sin_datos_repeat", () => {
    const info = resolveRelationalInfo(
      sig({ tipoRegla: "coherence", rosterSubtype: "relacional", tabla: "rep_servicios", issueCode: "sin_datos_repeat" }),
    );
    expect(info.childBaseMissing).toBe(true);
    expect(info.relational).toBe(true);
  });

  test("requiere roster externo desde issue_code", () => {
    const info = resolveRelationalInfo(sig({ issueCode: "requires_external_dataset" }));
    expect(info.requiresExternalDataset).toBe(true);
  });

  test("plan meta es autoritativo y aporta repeat_group / datasets", () => {
    const info = resolveRelationalInfo(sig({ tipoRegla: "coherence", tabla: "principal" }), {
      relational: true,
      repeatGroup: "rep_servicios",
      dependsOnChildBase: true,
      requiresExternalDataset: true,
      externalDatasets: ["listadoedp"],
      rosterSubtype: "relacional",
    });
    expect(info.relational).toBe(true);
    expect(info.repeatGroup).toBe("rep_servicios");
    expect(info.requiresExternalDataset).toBe(true);
    expect(info.externalDatasets).toEqual(["listadoedp"]);
  });
});

describe("copy helpers", () => {
  test("externalRosterBadgeLabel según cantidad de datasets", () => {
    expect(externalRosterBadgeLabel(["listadoedp"])).toBe('Requiere el listado externo «listadoedp»');
    expect(externalRosterBadgeLabel(["a", "b"])).toBe('Requiere los listados externos: «a», «b»');
    expect(externalRosterBadgeLabel([])).toBe("Requiere un listado externo");
  });

  test("formatRelationalRepeatHeadline usa el conductor cuando existe", () => {
    expect(
      formatRelationalRepeatHeadline({
        repeatGroup: "rep_servicios",
        smConductor: "services",
        identityVar: "current_code",
        repeatCount: "count-selected(${services})",
      }),
    ).toBe('Una fila de «rep_servicios» por cada opción marcada en «services».');
    expect(
      formatRelationalRepeatHeadline({
        repeatGroup: "rep_hijos",
        smConductor: null,
        identityVar: null,
        repeatCount: null,
      }),
    ).toContain("respuestas repetidas");
  });
});
