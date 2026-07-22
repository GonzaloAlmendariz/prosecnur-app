import { describe, expect, test } from "vitest";
import type { EstudioProcessingSuggestionGroup } from "../../../api/client";
import { formSourceWithActorKey, instrumentActorOptions } from "./actorAssignmentModel";

function group(actor_key: string, actor: string): EstudioProcessingSuggestionGroup {
  return {
    id: `group-${actor_key}`,
    project_kind: "acreditacion",
    actor,
    actor_key,
    platform: "surveymonkey",
    label: actor,
    recommended_base_name: actor,
    source_count: 1,
    importable: true,
    import_mode: "surveymonkey_independent_sibling",
    confidence: "high",
    sources: [],
  };
}

describe("explicit instrument actor assignment", () => {
  test("uses only actor keys returned by processing suggestions", () => {
    expect(instrumentActorOptions([
      group("docentes", "Docentes"),
      group("", "Nombre sin clave"),
      group("docentes", "Etiqueta duplicada"),
    ])).toEqual([{ actor_key: "docentes", actor: "Docentes" }]);
  });

  test("changes actor_key without discarding rich source provenance", () => {
    expect(formSourceWithActorKey({
      schema: "survey_source/v1",
      kind: "surveymonkey",
      original_name: "Encuesta",
      actor_key: "docentes",
      survey_id: "survey-1",
    }, "egresados")).toEqual({
      schema: "survey_source/v1",
      kind: "surveymonkey",
      original_name: "Encuesta",
      actor_key: "egresados",
      survey_id: "survey-1",
    });
  });
});
