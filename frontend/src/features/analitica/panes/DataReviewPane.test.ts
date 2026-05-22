import { describe, expect, test } from "vitest";
import type { DataReviewVariable } from "../../../api/client";
import {
  buildDataReviewDraft,
  buildDataReviewSectionGroups,
  dataReviewDraftStatus,
  dataReviewEffectiveOptionLabel,
  dataReviewEffectiveVariableLabel,
  dataReviewHasEditableOptions,
} from "./DataReviewPane";

function variable(patch: Partial<DataReviewVariable>): DataReviewVariable {
  return {
    name: "p1",
    tipo_xlsform: "text",
    seccion: "General",
    included: true,
    label_actual: "Pregunta original",
    label_original: "Pregunta original",
    n_non_missing: 0,
    n_missing: 0,
    opciones: [],
    ...patch,
  };
}

describe("DataReviewPane helpers", () => {
  test("only selection questions expose editable option labels", () => {
    const options = [{ code: "1", label: "Si", count: 3 }];

    expect(dataReviewHasEditableOptions(variable({ tipo_xlsform: "text", opciones: options }))).toBe(false);
    expect(dataReviewHasEditableOptions(variable({ tipo_xlsform: "integer", opciones: options }))).toBe(false);
    expect(dataReviewHasEditableOptions(variable({ tipo_xlsform: "select_one yesno", opciones: options }))).toBe(true);
    expect(dataReviewHasEditableOptions(variable({ tipo_xlsform: "select_multiple servicios", opciones: options }))).toBe(true);
  });

  test("inputs show the effective label as their editable value", () => {
    const v = variable({ label_actual: "Satisfaccion", label_original: "Satisfaccion" });
    const option = { code: "2", label: "No", count: 5 };

    expect(dataReviewEffectiveVariableLabel(v)).toBe("Satisfaccion");
    expect(dataReviewEffectiveVariableLabel(v, "Satisfaccion editada")).toBe("Satisfaccion editada");
    expect(dataReviewEffectiveOptionLabel(option)).toBe("No");
    expect(dataReviewEffectiveOptionLabel(option, "No editado")).toBe("No editado");
  });

  test("groups variables by configured sections and keeps uncategorized variables visible", () => {
    const groups = buildDataReviewSectionGroups(
      [
        variable({ name: "p1", seccion: "General" }),
        variable({ name: "p2", seccion: "Hogar" }),
        variable({ name: "extra", seccion: "Extras" }),
      ],
      [
        { id: "hogar", nombre: "Hogar editado", variables: ["p2"], oculto: false, orden: 0, manual: true },
      ],
    );

    expect(groups.map((group) => group.name)).toEqual(["Hogar editado", "General", "Extras"]);
    expect(groups[0].synthetic).toBe(false);
    expect(groups[0].variables.map((v) => v.name)).toEqual(["p2"]);
    expect(groups[1].synthetic).toBe(true);
    expect(groups[1].variables.map((v) => v.name)).toEqual(["p1"]);
  });

  test("draft labels can be temporarily blank but are invalid to confirm", () => {
    const v = variable({
      tipo_xlsform: "select_one yesno",
      opciones: [{ code: "1", label: "Si", count: 3 }],
    });
    const baseline = buildDataReviewDraft([v]);
    const draft = {
      variableLabels: { p1: "" },
      valueLabels: { p1: { "1": "Si editado" } },
    };

    expect(dataReviewDraftStatus([v], draft, baseline)).toEqual({
      pendingCount: 2,
      emptyCount: 1,
    });
  });
});
