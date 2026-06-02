import { describe, expect, test } from "vitest";
import type { EstudioMultiIntegrated } from "../../api/client";
import {
  INDEPENDENT_SIBLINGS_MAX_BASES,
  independentSiblingsCapacity,
  integratedHistoryArray,
  integratedLabelOverrideGroups,
  integratedLabelOverrideEntries,
  integratedStandardLabelEntries,
  integratedVariantRows,
  smIndependentSurveyInput,
} from "./BasesPanel";

describe("BasesPanel integrated history helpers", () => {
  test("normalizes named R lists serialized as objects", () => {
    expect(integratedHistoryArray<{ key_value: string }>({
      mx: { key_value: "Mexico" },
      pe: { key_value: "Peru" },
    })).toEqual([
      { key_value: "Mexico" },
      { key_value: "Peru" },
    ]);
  });

  test("keeps legacy named variant_map readable", () => {
    const meta = {
      variant_map: {
        "Mexico::p10": { from: "p10", to: "p10_mexico", origin_key: "Mexico" },
        "Peru::p10": { from: "p10", to: "p10_peru", origin_key: "Peru" },
      },
    } as unknown as EstudioMultiIntegrated;

    expect(integratedVariantRows(meta)).toEqual([
      { from: "p10", to: "p10_mexico", origin: "Mexico", ref: "" },
      { from: "p10", to: "p10_peru", origin: "Peru", ref: "" },
    ]);
  });

  test("flattens label overrides grouped by origin", () => {
    const meta = {
      label_overrides_by_key: {
        Mexico: { p1: "Fraseo estandar Mexico" },
        p2: "Fraseo comun",
      },
    } as unknown as EstudioMultiIntegrated;

    expect(integratedLabelOverrideEntries(meta)).toMatchObject([
      { key: "Mexico \u00b7 p1", value: "Fraseo estandar Mexico", origin: "Mexico", variable: "p1" },
      { key: "p2", value: "Fraseo comun", origin: "Común", variable: "p2" },
    ]);
    expect(integratedLabelOverrideGroups(meta)).toMatchObject([
      { origin: "Común", entries: [{ variable: "p2" }] },
      { origin: "Mexico", entries: [{ variable: "p1" }] },
    ]);
  });

  test("flattens standard label overrides for the integrated global wording", () => {
    const meta = {
      label_overrides_standard: {
        p1: "Fraseo final común",
      },
    } as unknown as EstudioMultiIntegrated;

    expect(integratedStandardLabelEntries(meta)).toEqual([
      { key: "p1", value: "Fraseo final común", origin: "Final común", variable: "p1" },
    ]);
  });

  test("builds independent sibling SurveyMonkey scope payloads", () => {
    const input = smIndependentSurveyInput(
      {
        id: "111",
        title: "Acreditación Ingeniería Geológica - Encuesta Egresados",
        nickname: "",
        date_modified: "",
        pais_guess: "",
      },
      {
        alias: "Ingeniería Geológica",
        collectorIds: "campo, recordatorio",
        dateModifiedGte: "",
        dateModifiedLte: "2026-05-30T01:27",
        includeCompleted: true,
        includePartial: false,
        keepMissingStatus: false,
        extraSources: [{
          key: "extra",
          surveyId: "222",
          label: "Ingeniería Geológica campaña 2",
          collectorIds: "",
          dateModifiedGte: "",
          dateModifiedLte: "",
          includeCompleted: true,
          includePartial: true,
          keepMissingStatus: false,
        }],
      },
    );

    expect(input).toEqual({
      survey_id: "111",
      label: "Ingeniería Geológica",
      source_alias: "Ingeniería Geológica",
      source_title: "Acreditación Ingeniería Geológica - Encuesta Egresados",
      pais: "",
      sources: [
        {
          survey_id: "111",
          label: "Ingeniería Geológica",
          source_alias: "Ingeniería Geológica",
          source_title: "Acreditación Ingeniería Geológica - Encuesta Egresados",
          response_statuses: ["completed"],
          collector_ids: ["campo", "recordatorio"],
          date_modified_lte: "2026-05-30T01:27:00+00:00",
        },
        {
          survey_id: "222",
          label: "Ingeniería Geológica campaña 2",
          source_alias: "Ingeniería Geológica campaña 2",
          response_statuses: ["completed", "partial"],
        },
      ],
    });
  });

  test("caps independent sibling families at ten bases even if the study allows more", () => {
    expect(INDEPENDENT_SIBLINGS_MAX_BASES).toBe(10);
    expect(independentSiblingsCapacity({ max_bases: 16, n_bases: 8 })).toEqual({
      maxBases: 10,
      capacityLeft: 2,
    });
    expect(independentSiblingsCapacity({ max_bases: 16, n_bases: 10 })).toEqual({
      maxBases: 10,
      capacityLeft: 0,
    });
  });

  test("keeps independent sibling aliases human-readable while producing stable technical ids", () => {
    const input = smIndependentSurveyInput(
      {
        id: "333",
        title: "Acreditación Ingeniería de las Telecomunicaciones - Encuesta Egresados",
        nickname: "",
        date_modified: "",
        pais_guess: "",
      },
      {
        alias: "Ingeniería de las Telecomunicaciones",
        collectorIds: "",
        dateModifiedGte: "",
        dateModifiedLte: "",
        includeCompleted: true,
        includePartial: false,
        keepMissingStatus: false,
        extraSources: [],
      },
    );

    expect(input).toMatchObject({
      survey_id: "333",
      label: "Ingeniería de las Telecomunicaciones",
      source_alias: "Ingeniería de las Telecomunicaciones",
      source_title: "Acreditación Ingeniería de las Telecomunicaciones - Encuesta Egresados",
    });
    expect(input.sources).toBeUndefined();
  });
});
