import { describe, expect, test } from "vitest";
import type { EstudioMultiIntegrated, EstudioProcessingSuggestions } from "../../api/client";
import {
  INDEPENDENT_SIBLINGS_MAX_BASES,
  independentSiblingsCapacity,
  independentSiblingsCapacityLabel,
  integratedHistoryArray,
  integratedLabelOverrideGroups,
  integratedLabelOverrideEntries,
  integratedStandardLabelEntries,
  integratedVariantRows,
  smBestExistingBaseTarget,
  smBaseChannel,
  smBaseChannelDetail,
  smCampaignInputFromSurvey,
  smDecisionCaseRows,
  smDecisionCollectorIsTest,
  smDecisionDuplicateEvidenceLine,
  smDecisionPolicyFingerprint,
  smDecisionPolicyForSurveyMonkeyCommit,
  smDecisionValidCollectorIds,
  smIndependentSurveyInput,
  smSourceSummariesFromBase,
  smSpecWithConsentVar,
  smSpecWithSourceCollectors,
  smSurveyCatalogAvailability,
	  smSurveyResponseCount,
	  smSurveyResponseLabel,
	  smSurveyMonkeyLogicRuleLines,
	  smSurveyMonkeyLogicPreviewEntries,
	  smSurveyMonkeyLogicPreviewNeedsReview,
	  smSurveySpecificLogicRulesBySurvey,
	  smSuggestedSurveyMonkeyLogicRulesFromMonitoring,
  smWorkbookInspectionCanImport,
  smWorkbookInspectionCellErrorCount,
  smWorkbookInspectionWarningCount,
  smSavBundleIssueGroups,
  smSavBundleInspectionCanImport,
  smSavBundleInspectionWarningCount,
  smSavBundleVariableLabel,
  smXlsformVariableLabelLookup,
} from "./BasesPanel";

describe("BasesPanel integrated history helpers", () => {
  test("describes active independent bases without ambiguous fractions", () => {
    expect(independentSiblingsCapacityLabel(1, 10)).toBe("1 base activa · capacidad máxima 10");
    expect(independentSiblingsCapacityLabel(4, 10)).toBe("4 bases activas · capacidad máxima 10");
  });

  test("summarizes workbook inspection state for visual controls", () => {
    const inspection = {
      ok: true,
      file_id: "file-xlsx",
      filename: "Base Cliente.xlsx",
      n_sheets: 2,
      n_matched: 2,
      n_blocking: 0,
      blocking_sheets: [],
      warnings: ["Advertencia global"],
      sheets: [
        {
          sheet_name: "Industrial",
          base_name: "ingenieria_industrial",
          matched: true,
          blocking: false,
          n_rows: 206,
          n_columns: 94,
          recognized_headers: 90,
          unknown_headers: [],
          ambiguous_headers: [],
          missing_variables: ["p3", "p4", "p5"],
          warnings: ["Variables personales faltantes"],
        },
        {
          sheet_name: "Civil",
          base_name: "ingenieria_civil",
          matched: true,
          blocking: false,
          n_rows: 179,
          n_columns: 91,
          recognized_headers: 88,
          unknown_headers: ["Columna dudosa"],
          ambiguous_headers: [],
          missing_variables: [],
          cell_errors: [{ source: "Matriz | Fila", kind: "question", variable: "p13_1", n_errors: 173, rows: [2, 3, 4] }],
          n_cell_errors: 173,
          warnings: [],
        },
      ],
    };

    expect(smWorkbookInspectionCanImport(inspection)).toBe(true);
    expect(smWorkbookInspectionWarningCount(inspection)).toBe(2);
    expect(smWorkbookInspectionCellErrorCount(inspection)).toBe(173);
    expect(smWorkbookInspectionCanImport({ ...inspection, ok: false, n_blocking: 1 })).toBe(false);
  });

  test("summarizes SAV bundle inspection state for controlled updates", () => {
    const inspection = {
      ok: true,
      file_id: "zip-sav",
      filename: "Bases finales.zip",
      n_files: 2,
      n_matched: 2,
      n_blocking: 0,
      blocking_files: [],
      inspection_fingerprint: "inspection-sav",
      warnings: ["Variable sin datos observados"],
      files: [
        {
          file_name: "Revision Civil.sav",
          entry_name: "Bases finales/Revision Civil.sav",
          base_name: "ingenieria_civil",
          matched: true,
          blocking: false,
          action: "replace_data",
          n_rows: 182,
          n_columns: 111,
          n_output_columns: 86,
          expected_variables: 61,
          matched_variables: 61,
          missing_variables: [],
          blank_filled_variables: [],
          all_empty_variables: [],
          metadata_columns: ["respondent_id"],
          instrument_revision: {
            status: "pinned_healthy" as const,
            healthy: true,
            revision_id: "rev-civil",
            revision_hash: "hash",
            base_revision_hash: "hash",
            base_xlsform_file_id: "xls",
            revision_xlsform_file_id: "xls",
            reasons: [],
            warning: "",
          },
          warnings: [],
          change_plan: {
            action: "replace_data",
            base_name: "ingenieria_civil",
            source_file: "Revision Civil.sav",
            current: { n_rows: 176, n_columns: 84, data_file_id: "old", xlsform_file_id: "xls" },
            incoming: { raw_rows: 182, raw_columns: 111, normalized_rows: 182, normalized_columns: 86 },
            impact: {
              rows_delta: 6,
              columns_delta: 2,
              expected_variables: 61,
              matched_variables: 61,
              missing_variables: [],
              blank_filled_variables: [],
              all_empty_variables: [],
              metadata_columns: ["respondent_id"],
            },
            effects: { xlsform: "preserved", data: "replaced", invalidates: ["validacion", "analitica"] },
          },
        },
        {
          file_name: "Revision Geologica.sav",
          entry_name: "Bases finales/Revision Geologica.sav",
          base_name: "ingenieria_geologica",
          matched: true,
          blocking: false,
          action: "replace_data",
          n_rows: 28,
          n_columns: 98,
          n_output_columns: 73,
          expected_variables: 59,
          matched_variables: 59,
          missing_variables: [],
          blank_filled_variables: [],
          all_empty_variables: ["p28"],
          metadata_columns: ["respondent_id"],
          instrument_revision: {
            status: "legacy_unpinned" as const,
            healthy: null,
            revision_id: "",
            revision_hash: "",
            base_revision_hash: "",
            base_xlsform_file_id: "xls2",
            revision_xlsform_file_id: "",
            reasons: ["instrument_revision_id_missing"],
            warning: "Sin pin publicado",
          },
          warnings: ["El archivo tiene 1 variables esperadas presentes pero completamente vacías."],
          change_plan: {
            action: "replace_data",
            base_name: "ingenieria_geologica",
            source_file: "Revision Geologica.sav",
            current: { n_rows: 31, n_columns: 74, data_file_id: "old2", xlsform_file_id: "xls2" },
            incoming: { raw_rows: 28, raw_columns: 98, normalized_rows: 28, normalized_columns: 73 },
            impact: {
              rows_delta: -3,
              columns_delta: -1,
              expected_variables: 59,
              matched_variables: 59,
              missing_variables: [],
              blank_filled_variables: [],
              all_empty_variables: ["p28"],
              metadata_columns: ["respondent_id"],
            },
            effects: { xlsform: "preserved", data: "replaced", invalidates: ["validacion", "analitica"] },
          },
        },
      ],
      change_plan: [],
    };

    expect(smSavBundleInspectionCanImport(inspection)).toBe(true);
    expect(smSavBundleInspectionWarningCount(inspection)).toBe(2);
    expect(smSavBundleInspectionCanImport({ ...inspection, ok: false, n_blocking: 1 })).toBe(false);

    const geologicaGroups = smSavBundleIssueGroups(inspection.files[1]);
    expect(geologicaGroups).toMatchObject([
      {
        key: "warnings",
        label: "Advertencias de inspección",
        notes: ["El archivo tiene 1 variables esperadas presentes pero completamente vacías."],
      },
      {
        key: "all-empty",
        label: "Sin datos observados",
        variables: ["p28"],
      },
    ]);

    const labelLookup = smXlsformVariableLabelLookup({
      xlsform_variables: [
        { name: "p28", label: "Indique el tipo de actividad principal que realiza actualmente" },
      ],
    });
    expect(smSavBundleVariableLabel("p28", labelLookup)).toBe("Indique el tipo de actividad principal que realiza actualmente");
  });

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
	        logicRules: "",
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
          collector_ids: ["campo", "recordatorio"],
          date_modified_lte: "2026-05-30T01:27:00+00:00",
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

  test("suggests editable SurveyMonkey logic from accreditation monitoring links", () => {
    const suggestions: EstudioProcessingSuggestions = {
      ok: true,
      source: "monitoreo",
      project_kind: "acreditacion",
      profile_family: "acreditacion",
      profile_variant: "multi_actor",
      has_suggestions: true,
      message: "Acreditacion multiactor",
      summary: {
        monitoring_sources_count: 1,
        survey_sources_count: 1,
        actors_count: 1,
        surveymonkey_groups: 1,
        kobo_groups: 0,
      },
      groups: [{
        id: "egresados-surveymonkey",
        project_kind: "acreditacion",
        actor: "Egresados",
        actor_key: "egresados",
        platform: "surveymonkey",
        label: "SurveyMonkey Egresados",
        recommended_base_name: "egresados",
        source_count: 1,
        response_count: 42,
        importable: true,
        import_mode: "surveymonkey_independent_sibling",
        confidence: "high",
        sources: [{
          source_id: "sm-egresados-whatsapp",
          kind: "surveymonkey",
          label: "Egresados WhatsApp",
          title: "Encuesta egresados",
          actor: "Egresados",
          actor_key: "egresados",
          channel: "Enlace personalizado por WhatsApp",
          collection_strategy: "whatsapp_link",
          role: "responses",
          integration_mode: "survey",
          survey_id: "sm-123",
          asset_uid: "",
          base_url: "",
          connection_profile_id: "surveymonkey-main",
          collector_ids: ["collector-1"],
          enabled: true,
          last_sync_at: "2026-07-02T00:00:00Z",
        }],
      }],
    };

    expect(smSuggestedSurveyMonkeyLogicRulesFromMonitoring(suggestions)).toBe("Q1 = C1 => Ocultar P2.");
    expect(smSuggestedSurveyMonkeyLogicRulesFromMonitoring({
      ...suggestions,
      project_kind: "territorial",
      profile_family: "territorial",
    })).toBe("");
    expect(smSuggestedSurveyMonkeyLogicRulesFromMonitoring({
      ...suggestions,
      groups: suggestions.groups.map((group) => ({
        ...group,
        sources: group.sources.map((source) => ({
          ...source,
          label: "Egresados correo",
          title: "Encuesta egresados correo",
          channel: "Correo",
          collection_strategy: "email",
        })),
      })),
    })).toBe("");
  });

	  test("splits SurveyMonkey logic text into reviewable rule lines", () => {
	    expect(smSurveyMonkeyLogicRuleLines(`
	      Q1 = C1 => Ocultar P2.
	      Q3 IN [C1, C2] => Fin;
	      ;
    `)).toEqual([
      "Q1 = C1 => Ocultar P2.",
      "Q3 IN [C1, C2] => Fin",
	    ]);
	  });

	  test("builds SurveyMonkey direct logic maps for actor-specific exceptions", () => {
	    expect(smSurveySpecificLogicRulesBySurvey(
	      [{ id: "sm-estudiantes" }, { id: "sm-docentes" }, { id: "" }],
	      {
	        "sm-estudiantes": { logicRules: "" },
	        "sm-docentes": { logicRules: "  Q1 != C1 => Ocultar P2.  " },
	        "": { logicRules: "Q9 = C1 => Fin" },
	      },
	    )).toEqual({
	      "sm-docentes": "Q1 != C1 => Ocultar P2.",
	    });
	  });

	  test("combines common and actor-specific SurveyMonkey rules for preview", () => {
	    expect(smSurveyMonkeyLogicPreviewEntries(
	      "Q1 = C1 => Ocultar P2.",
	      {
	        "sm-docentes": "Q1 != C1 => Ocultar P2.; Q3 = C2 => Fin",
	      },
	      {
	        "sm-docentes": "Docentes",
	      },
	    )).toEqual([
	      { rule: "Q1 = C1 => Ocultar P2.", origin: "Regla común" },
	      { rule: "Q1 != C1 => Ocultar P2.", origin: "Actor Docentes" },
	      { rule: "Q3 = C2 => Fin", origin: "Actor Docentes" },
	    ]);
	  });

	  test("requires fresh successful SurveyMonkey logic preview before import", () => {
    const rules = ["Q1 = C1 => Ocultar P2.", "Q3 = C2 => Fin"];
    expect(smSurveyMonkeyLogicPreviewNeedsReview([], null)).toBe(false);
    expect(smSurveyMonkeyLogicPreviewNeedsReview(rules, null)).toBe(true);
    expect(smSurveyMonkeyLogicPreviewNeedsReview(rules, [{ rule: rules[0], ok: true }])).toBe(true);
    expect(smSurveyMonkeyLogicPreviewNeedsReview(rules, [
      { rule: rules[0], ok: true },
      { rule: rules[1], ok: false },
    ])).toBe(true);
    expect(smSurveyMonkeyLogicPreviewNeedsReview(rules, [
      { rule: rules[0], ok: true },
      { rule: "Q4 = C1 => Fin", ok: true },
    ])).toBe(true);
    expect(smSurveyMonkeyLogicPreviewNeedsReview(rules, [
      { rule: rules[0], ok: true },
      { rule: rules[1], ok: true },
    ])).toBe(false);
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
	        logicRules: "",
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
      collector_ids: ["campo"],
      date_modified_gte: "2026-05-01T00:00:00+00:00",
      date_modified_lte: "2026-05-30T01:27:00+00:00",
      collection_strategy: "email",
      channel: "Correo",
      source_channel: "Correo",
    });
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

  test("prefers explicit SurveyMonkey source payload with effective and included counts", () => {
    const base = {
      nombre: "ingenieria_civil",
      xlsform_file_id: "xls",
      data_file_id: "data",
      data_ext: "xlsx",
      n_filas: 179,
      n_columnas: 76,
      added_at: "",
      source_channel: "Telefónico",
      surveymonkey_source_summary: {
        channel_label: "Mixto",
        channels: ["Telefónico", "Correo"],
        has_email: true,
        email_active: true,
      },
      surveymonkey_sources: [
        {
          survey_id: "111",
          source_title: "Encuesta Egresados",
          channel: "Telefónico",
          raw_records: 188,
          effective_records: 177,
          included_records: 177,
          excluded_records: 11,
          collector_ids: ["campo"],
        },
        {
          survey_id: "222",
          source_title: "Encuesta a Egresados",
          channel: "Correo",
          raw_records: 3,
          effective_records: 2,
          included_records: 2,
          excluded_records: 1,
        },
      ],
    } as any;

    expect(smBaseChannel(base)).toBe("Mixto");
    expect(smBaseChannelDetail(base)).toBe("Telefónico + Correo");
    expect(smSourceSummariesFromBase(base)).toMatchObject([
      { surveyId: "111", title: "Encuesta Egresados", channel: "Telefónico", rawRecords: 188, effectiveRecords: 177, includedRecords: 177, excludedRecords: 11 },
      { surveyId: "222", title: "Encuesta a Egresados", channel: "Correo", rawRecords: 3, effectiveRecords: 2, includedRecords: 2, excludedRecords: 1 },
    ]);
  });

  test("infers mixed channel from legacy response_filter sources", () => {
    const base = {
      nombre: "ingenieria_civil",
      xlsform_file_id: "xls",
      data_file_id: "data",
      data_ext: "xlsx",
      n_filas: 179,
      n_columnas: 76,
      added_at: "",
      source_channel: "Telefónico",
      response_filter: {
        kind: "surveymonkey_multi_source_response_filter",
        sources: [
          { survey_id: "111", source_title: "Encuesta Egresados", collection_strategy: "campo", kept_rows: 177 },
          { survey_id: "222", source_title: "Encuesta a Egresados", collection_strategy: "email", kept_rows: 2 },
        ],
      },
    } as any;

    expect(smBaseChannel(base)).toBe("Mixto");
    expect(smBaseChannelDetail(base)).toBe("Telefónico + Correo");
  });

  test("updates saved SurveyMonkey collector filters by source", () => {
    const spec = smSpecWithSourceCollectors({
      survey_id: "111",
      collector_ids: ["campo"],
      sources: [
        { survey_id: "111", source_title: "Principal", collector_ids: ["campo"] },
        { survey_id: "222", source_title: "Correo" },
      ],
    }, 0, "campo, prueba");

    expect(spec?.collector_ids).toEqual(["campo", "prueba"]);
    expect(spec?.sources?.[0]?.collector_ids).toEqual(["campo", "prueba"]);

    const cleared = smSpecWithSourceCollectors(spec, 0, "");
    expect(cleared?.collector_ids).toBeUndefined();
    expect(cleared?.sources?.[0]?.collector_ids).toBeUndefined();
    expect(cleared?.sources?.[1]?.source_title).toBe("Correo");
  });

  test("excludes test collectors from effective SurveyMonkey decisions", () => {
    const collectors = [
      { id: "campo", label: "Campo · campo", source: "Ingeniería Civil" },
      { id: "prueba", label: "Prueba · prueba", source: "Ingeniería Civil" },
      { id: "correo", label: "Email Invitation 1 · correo", source: "Encuesta a Egresados" },
    ];

    expect(smDecisionCollectorIsTest(collectors[1])).toBe(true);
    expect(smDecisionValidCollectorIds(collectors)).toEqual(["campo", "correo"]);
    expect(smDecisionPolicyForSurveyMonkeyCommit({
      collector_ids: ["campo", "prueba", "correo"],
    }, collectors)).toMatchObject({
      collector_ids: ["campo", "correo"],
      edited: true,
    });
  });

  test("normalizes SurveyMonkey case audit completion and duplicate evidence", () => {
    const audit = {
      sources: [
        {
          survey_id: "111",
          source_title: "Ingeniería Civil",
          collectors: [
            { id: "campo", name: "Campo" },
            { id: "prueba", name: "Prueba" },
          ],
          cases: [
            {
              case_uid: "111:r1",
              response_id: "r1",
              collector_id: "campo",
              answer_completion_label: "45/46",
              answered_required_count: "45",
              answerable_required_count: "46",
              answer_completion_ratio: "0.978261",
              near_complete: "1",
              duplicate_group_size: "2",
              duplicate_kept_response_id: "r0",
              duplicate_code_match: "coincide",
              duplicate_career_match: "difiere",
              duplicate_evidence: "Grupo de 2 por cv_id; se conserva respuesta r0.",
            },
            {
              case_uid: "111:r2",
              response_id: "r2",
              collector_id: "prueba",
              answer_completion_label: "46/46",
            },
          ],
        },
      ],
    } as any;

    const rows = smDecisionCaseRows(audit);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      completionLabel: "45/46",
      answeredRequired: "45",
      answerableRequired: "46",
      completionRatio: 0.978261,
      nearComplete: true,
      duplicateGroupSize: "2",
      duplicateCodeMatch: "coincide",
      duplicateCareerMatch: "difiere",
    });
    expect(rows[0].duplicateEvidence).toContain("Grupo de 2");
    expect(smDecisionDuplicateEvidenceLine(rows[0])).toContain("2 respuestas con el mismo ID enlace");
    expect(smDecisionDuplicateEvidenceLine(rows[0])).not.toContain("cv_id");
  });

  test("keeps SurveyMonkey policy fingerprint stable for saved metadata and sorts partials by progress", () => {
    expect(smDecisionPolicyFingerprint({
      collector_ids: ["correo", "campo"],
      manual_include_case_uids: ["b", "a"],
      saved_at: "2026-06-15T10:00:00Z",
    } as any)).toBe(smDecisionPolicyFingerprint({
      collector_ids: ["campo", "correo"],
      manual_include_case_uids: ["a", "b"],
      saved_at: "2026-06-15T11:00:00Z",
    } as any));

    const audit = {
      sources: [{
        survey_id: "111",
        source_title: "Ingeniería Civil",
        collectors: [{ id: "campo", name: "Campo" }],
        cases: [
          {
            case_uid: "111:low",
            response_id: "low",
            collector_id: "campo",
            response_status: "partial",
            decision_class: "parcial_excluida",
            answer_completion_label: "22/41",
            answer_completion_ratio: "0.54",
            observed: true,
          },
          {
            case_uid: "111:high",
            response_id: "high",
            collector_id: "campo",
            response_status: "partial",
            decision_class: "parcial_excluida",
            answer_completion_label: "33/41",
            answer_completion_ratio: "0.80",
            observed: true,
          },
        ],
      }],
    } as any;

    expect(smDecisionCaseRows(audit).map((row) => row.response_id)).toEqual(["high", "low"]);
  });
});
