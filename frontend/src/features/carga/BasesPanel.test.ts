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
  smBestExistingBaseTarget,
  smCampaignInputFromSurvey,
  smIndependentSurveyInput,
  smSourceSummariesFromBase,
  smSpecWithConsentVar,
  smSurveyCatalogAvailability,
  smSurveyResponseCount,
  smSurveyResponseLabel,
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
        collectionStrategy: "campo",
        channel: "Telefónico",
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
          collectionStrategy: "whatsapp_link",
          channel: "WhatsApp",
        }],
      },
    );

    expect(input).toEqual({
      survey_id: "111",
      label: "Ingeniería Geológica",
      source_alias: "Ingeniería Geológica",
      source_title: "Acreditación Ingeniería Geológica - Encuesta Egresados",
      pais: "",
      response_statuses: ["completed"],
      keep_missing_status: false,
      collection_strategy: "campo",
      channel: "Telefónico",
      source_channel: "Telefónico",
      sources: [
        {
          survey_id: "111",
          label: "Ingeniería Geológica",
          source_alias: "Ingeniería Geológica",
          source_title: "Acreditación Ingeniería Geológica - Encuesta Egresados",
          response_statuses: ["completed"],
          keep_missing_status: false,
          collection_strategy: "campo",
          channel: "Telefónico",
          source_channel: "Telefónico",
        },
        {
          survey_id: "222",
          label: "Ingeniería Geológica campaña 2",
          source_alias: "Ingeniería Geológica campaña 2",
          response_statuses: ["completed"],
          keep_missing_status: false,
          collection_strategy: "whatsapp_link",
          channel: "WhatsApp",
          source_channel: "WhatsApp",
          validation_exclusion_profile: "admin_autoadministrado",
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
        collectionStrategy: "campo",
        channel: "",
        extraSources: [],
      },
    );

    expect(input).toMatchObject({
      survey_id: "333",
      label: "Ingeniería de las Telecomunicaciones",
      source_alias: "Ingeniería de las Telecomunicaciones",
      source_title: "Acreditación Ingeniería de las Telecomunicaciones - Encuesta Egresados",
      response_statuses: ["completed"],
      keep_missing_status: false,
      collection_strategy: "campo",
    });
    expect(input.sources).toBeUndefined();
  });

  test("drops SurveyMonkey actor connector from default sibling aliases", () => {
    const input = smIndependentSurveyInput({
      id: "444",
      title: "Acreditación Ingeniería Civil - Encuesta a Egresados",
      nickname: "",
      date_modified: "",
      pais_guess: "",
    });

    expect(input.label).toBe("Ingeniería Civil");
    expect(input.source_alias).toBe("Ingeniería Civil");

    const nicknameInput = smIndependentSurveyInput({
      id: "445",
      title: "Acreditación Ingeniería Civil - Encuesta a Egresados",
      nickname: "Ingeniería Civil a",
      date_modified: "",
      pais_guess: "",
    });
    expect(nicknameInput.label).toBe("Ingeniería Civil");
  });

  test("infers an existing base target for additional SurveyMonkey campaigns by name proximity", () => {
    const target = smBestExistingBaseTarget(
      {
        id: "555",
        title: "Acreditación Ingeniería Civil - Encuesta a Egresados",
        nickname: "",
        date_modified: "",
        pais_guess: "",
        response_count: 3,
      },
      [
        { nombre: "ingenieria_civil", source_alias: "Ingeniería Civil" } as any,
        { nombre: "ingenieria_minas", source_alias: "Ingeniería de Minas" } as any,
      ],
    );

    expect(target).toBe("ingenieria_civil");
  });

  test("builds strict completed-only campaign inputs for existing base refresh", () => {
    const input = smCampaignInputFromSurvey(
      {
        id: "666",
        title: "Acreditación Ingeniería Civil - Encuesta a Egresados",
        nickname: "",
        date_modified: "",
        pais_guess: "",
        response_count: 3,
      },
      {
        alias: "Civil correo",
        collectorIds: "campo",
        dateModifiedGte: "2026-05-01T00:00",
        dateModifiedLte: "2026-05-30T01:27",
        includeCompleted: true,
        includePartial: true,
        keepMissingStatus: true,
        collectionStrategy: "email",
        channel: "Correo",
      },
    );

    expect(input).toMatchObject({
      survey_id: "666",
      label: "Civil correo",
      source_alias: "Civil correo",
      source_title: "Acreditación Ingeniería Civil - Encuesta a Egresados",
      response_statuses: ["completed"],
      keep_missing_status: false,
      collection_strategy: "email",
      channel: "Correo",
      source_channel: "Correo",
    });
    expect(input.collector_ids).toBeUndefined();
    expect(input.date_modified_gte).toBeUndefined();
    expect(input.date_modified_lte).toBeUndefined();
  });

  test("formats SurveyMonkey response counts for the sibling catalog", () => {
    expect(smSurveyResponseCount({ response_count: 203 })).toBe(203);
    expect(smSurveyResponseLabel({ response_count: 203 })).toBe("203 respuestas");
    expect(smSurveyResponseLabel({ response_count: 1 })).toBe("1 respuesta");
    expect(smSurveyResponseLabel({ response_count: null })).toBe("Conteo no disponible");
  });

  test("hides already loaded or selected SurveyMonkey surveys from the add catalog", () => {
    const surveys = [
      { id: "111", title: "Acreditación Ingeniería Civil - Encuesta Egresados", nickname: "", date_modified: "", pais_guess: "", response_count: 10 },
      { id: "222", title: "Acreditación Ingeniería Civil - Encuesta a Egresados", nickname: "", date_modified: "", pais_guess: "", response_count: 3 },
      { id: "333", title: "Acreditación Ingeniería Civil - Refuerzo", nickname: "", date_modified: "", pais_guess: "", response_count: 2 },
    ];

    const result = smSurveyCatalogAvailability(surveys, "Ingeniería Civil", new Set(["111"]), new Set(["222"]));

    expect(result.available.map((item) => item.id)).toEqual(["333"]);
    expect(result.duplicates.map((item) => item.id)).toEqual(["111", "222"]);
  });

  test("propagates configured consent variable to SurveyMonkey sources", () => {
    const spec = smSpecWithConsentVar({
      survey_id: "111",
      sources: [
        { survey_id: "111", source_title: "Principal" },
        { survey_id: "222", source_title: "Campaña" },
      ],
    }, "p1");

    expect(spec?.consent_var).toBe("p1");
    expect(spec?.sources?.map((source) => source.consent_var)).toEqual(["p1", "p1"]);
  });

  test("summarizes multi-campaign bases from saved SurveyMonkey specs", () => {
    const summaries = smSourceSummariesFromBase({
      nombre: "ingenieria_civil",
      xlsform_file_id: "xls",
      data_file_id: "data",
      data_ext: "xlsx",
      n_filas: 179,
      n_columnas: 76,
      added_at: "",
      surveymonkey_source_spec: {
        survey_id: "111",
        source_title: "Principal",
        sources: [
          { survey_id: "111", source_title: "Principal", source_channel: "Telefónico", consent_var: "p1" },
          { survey_id: "222", source_title: "Campaña correo", collection_strategy: "email", consent_var: "p1" },
        ],
      },
      response_filter: {
        kind: "surveymonkey_multi_source_response_filter",
        sources: [
          { survey_id: "111", kept_rows: 177, original_rows: 188, excluded_rows: 11 },
          { survey_id: "222", kept_rows: 2, original_rows: 3, excluded_rows: 1 },
        ],
      },
    });

    expect(summaries).toMatchObject([
      { surveyId: "111", title: "Principal", channel: "Telefónico", consentVar: "p1", validRecords: 177 },
      { surveyId: "222", title: "Campaña correo", channel: "Correo", consentVar: "p1", validRecords: 2 },
    ]);
  });
});
