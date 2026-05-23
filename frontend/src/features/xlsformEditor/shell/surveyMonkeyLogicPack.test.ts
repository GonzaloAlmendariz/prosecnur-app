import { describe, expect, test } from "vitest";
import type { ChoiceCodeMap, SurveyMonkeyVisualLogicRule } from "../../../api/client";
import type { XlsformEditorWorkbook } from "../types";
import {
  buildSurveyMonkeyLogicPack,
  importSurveyMonkeyLogicPack,
  SURVEY_MONKEY_LOGIC_PACK_KIND,
} from "./surveyMonkeyLogicPack";

function workbook({
  questionRef = "p7",
  questionLabel = "¿Qué actividades laborales realiza?",
  targetRef = "p9",
  targetLabel = "Destino de salto",
  choiceNames = ["1", "2"],
  choiceLabels = ["Sí", "No"],
}: {
  questionRef?: string;
  questionLabel?: string;
  targetRef?: string;
  targetLabel?: string;
  choiceNames?: string[];
  choiceLabels?: string[];
} = {}): XlsformEditorWorkbook {
  return {
    survey: {
      name: "survey",
      columns: ["type", "name", "label::es", "relevant", "section"],
      rows: [
        ["begin_group", "Pag1", "Página 1", "", "Pag1"],
        ["select_one lst_main", questionRef, questionLabel, "", "Pag1"],
        ["text", targetRef, targetLabel, "", "Pag1"],
        ["end_group", "", "", "", "Pag1"],
      ],
    },
    choices: {
      name: "choices",
      columns: ["list_name", "name", "label::es"],
      rows: choiceNames.map((name, index) => ["lst_main", name, choiceLabels[index] ?? name]),
    },
    settings: { name: "settings", columns: ["form_title", "form_id"], rows: [["Demo", "demo"]] },
    paper: { name: "paper", columns: [], rows: [] },
  };
}

function visualRule(variableRef = "p7", targetRef = "p9"): SurveyMonkeyVisualLogicRule {
  return {
    id: "v1",
    variableRef,
    variableLabel: `${variableRef}: pregunta`,
    choices: [
      {
        choiceName: "1",
        choiceLabel: "Sí",
        choiceIndex: 1,
        action: {
          kind: "question",
          pageId: "1",
          pageLabel: "Pag1",
          targetRef,
          targetLabel: `${targetRef}: destino`,
        },
      },
    ],
  };
}

function choiceCodeMap(variable = "p7"): ChoiceCodeMap {
  return {
    variable,
    label: "Pregunta con códigos SurveyMonkey",
    type: "select_one",
    list_name: "lst_main",
    status: "matched",
    high_confidence: true,
    requires_confirmation: false,
    mappings: [
      {
        source_code: "2",
        source_column: "Q7",
        source_label: "Sí",
        xls_code: "1",
        xls_label: "Sí",
        match: "label",
      },
    ],
  };
}

describe("surveyMonkeyLogicPack", () => {
  test("exporta reglas, overrides y firma versionada", () => {
    const pack = buildSurveyMonkeyLogicPack({
      workbook: workbook(),
      advancedRules: [{ id: "a1", texto: "Q7 = C1 => Pasar a P9.", texto_humano: "Salta", kobo_expr: "${p7} != '1'" }],
	      visualRules: [visualRule()],
	      choiceOrderOverrides: { "7": ["Sí", "No"] },
	      choiceCodeMaps: [choiceCodeMap()],
	      sourceName: "Ingeniería Civil",
	    });

    expect(pack.kind).toBe(SURVEY_MONKEY_LOGIC_PACK_KIND);
    expect(pack.version).toBe(1);
    expect(pack.source.name).toBe("Ingeniería Civil");
    expect(pack.advanced_rules).toHaveLength(1);
	    expect(pack.visual_rules).toHaveLength(1);
	    expect(pack.choice_order_overrides["7"]).toEqual(["Sí", "No"]);
	    expect(pack.choice_code_maps[0].mappings[0]).toMatchObject({ source_code: "2", xls_code: "1" });
	    expect(pack.signature.questions.map((q) => q.ref)).toEqual(["p7", "p9"]);
	  });

  test("importa un paquete con IDs iguales sin tocar el XLSForm", () => {
    const source = workbook();
    const pack = buildSurveyMonkeyLogicPack({
      workbook: source,
      advancedRules: [{ id: "a1", texto: "Q7 = C1 => Pasar a P9.", texto_humano: "Salta" }],
	      visualRules: [visualRule()],
	      choiceOrderOverrides: { "7": ["Sí", "No"] },
	      choiceCodeMaps: [choiceCodeMap()],
	      sourceName: "Base",
	    });

    const result = importSurveyMonkeyLogicPack(pack, workbook());

    expect(result.advanced_rules[0].texto).toBe("P7 = C1 => Pasar a P9.");
	    expect(result.visual_rules[0].variableRef).toBe("p7");
	    expect(result.visual_rules[0].choices[0].action).toMatchObject({ kind: "question", targetRef: "p9" });
	    expect(result.choice_order_overrides["7"]).toEqual(["Sí", "No"]);
	    expect(result.choice_code_maps[0]).toMatchObject({ variable: "p7" });
	    expect(result.choice_code_maps[0].mappings[0]).toMatchObject({ source_code: "2", xls_code: "1" });
	    expect(result.warnings.filter((w) => w.severity === "warn")).toHaveLength(0);
	  });

  test("empareja por fraseo similar cuando cambian los IDs", () => {
    const pack = buildSurveyMonkeyLogicPack({
      workbook: workbook(),
      advancedRules: [{ id: "a1", texto: "Q7 = C1 => Pasar a P9.", texto_humano: "Salta" }],
	      visualRules: [visualRule()],
	      choiceOrderOverrides: { "7": ["Sí", "No"] },
	      choiceCodeMaps: [choiceCodeMap()],
	      sourceName: "Base",
	    });
    const target = workbook({
      questionRef: "p11",
      questionLabel: "Actividades laborales que realiza",
      targetRef: "p12",
      targetLabel: "Destino del salto",
      choiceNames: ["yes", "no"],
      choiceLabels: ["Sí", "No"],
    });

    const result = importSurveyMonkeyLogicPack(pack, target);

    expect(result.advanced_rules[0].texto).toBe("P11 = C1 => Pasar a P12.");
    expect(result.visual_rules[0].variableRef).toBe("p11");
	    expect(result.visual_rules[0].choices[0].choiceName).toBe("yes");
	    expect(result.visual_rules[0].choices[0].action).toMatchObject({ kind: "question", targetRef: "p12" });
	    expect(result.choice_order_overrides["11"]).toEqual(["Sí", "No"]);
	    expect(result.choice_code_maps[0]).toMatchObject({ variable: "p11" });
	    expect(result.choice_code_maps[0].mappings[0]).toMatchObject({ source_code: "2", xls_code: "yes" });
	    expect(result.warnings.some((w) => w.message.includes("fraseo similar"))).toBe(true);
	  });

  test("reporta acciones sin destino y no las carga en silencio", () => {
    const pack = buildSurveyMonkeyLogicPack({
      workbook: workbook(),
      advancedRules: [],
      visualRules: [visualRule("p7", "p99")],
      choiceOrderOverrides: {},
      sourceName: "Base",
    });

    const result = importSurveyMonkeyLogicPack(pack, workbook());

    expect(result.visual_rules).toHaveLength(0);
    expect(result.warnings.some((w) => w.severity === "warn")).toBe(true);
  });

  test("reporta reglas avanzadas sin referencia emparejada y no las carga", () => {
    const pack = buildSurveyMonkeyLogicPack({
      workbook: workbook(),
      advancedRules: [{ id: "a1", texto: "Q7 = C1 => Pasar a P99.", texto_humano: "Salta" }],
      visualRules: [],
      choiceOrderOverrides: {},
      sourceName: "Base",
    });

    const result = importSurveyMonkeyLogicPack(pack, workbook());

    expect(result.advanced_rules).toHaveLength(0);
    expect(result.warnings.some((w) => w.message.includes("P99"))).toBe(true);
  });

  test("empareja destinos de matriz de una fila con la primera variable expandida", () => {
    const pack = buildSurveyMonkeyLogicPack({
      workbook: workbook(),
      advancedRules: [{ id: "a1", texto: "Q7 = C1 => Pasar a P9.", texto_humano: "Salta" }],
      visualRules: [visualRule()],
      choiceOrderOverrides: {},
      sourceName: "Base",
    });
    const target = workbook({
      targetRef: "p9_1",
      targetLabel: "Única fila visible de matriz",
    });

    const result = importSurveyMonkeyLogicPack(pack, target);

    expect(result.advanced_rules[0].texto).toBe("P7 = C1 => Pasar a P9_1.");
    expect(result.visual_rules[0].choices[0].action).toMatchObject({ kind: "question", targetRef: "p9_1" });
    expect(result.warnings.some((w) => w.message.includes("pregunta compuesta"))).toBe(true);
  });
});
