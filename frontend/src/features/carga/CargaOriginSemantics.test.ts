import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { EstudioProcessingSuggestions } from "../../api/client";
import { cargaSourceModes } from "./CargaPage";

function suggestions(
  accreditationDeclared: boolean,
  withGroups: boolean,
): EstudioProcessingSuggestions {
  return {
    ok: true,
    source: "monitoreo",
    accreditation_declared: accreditationDeclared,
    has_suggestions: withGroups,
    message: "",
    summary: {
      monitoring_sources_count: withGroups ? 1 : 0,
      survey_sources_count: withGroups ? 1 : 0,
      actors_count: withGroups ? 1 : 0,
      surveymonkey_groups: withGroups ? 1 : 0,
      kobo_groups: 0,
    },
    groups: withGroups ? [{
      id: "estudiantes",
      project_kind: "acreditacion",
      actor: "Estudiantes",
      actor_key: "estudiantes",
      platform: "surveymonkey",
      label: "Encuesta de estudiantes",
      recommended_base_name: "estudiantes",
      source_count: 1,
      importable: true,
      import_mode: "surveymonkey_independent_sibling",
      confidence: "high",
      sources: [],
    }] : [],
  };
}

describe("cargaSourceModes", () => {
  it("mantiene Monitoreo visible sin inferir acreditación por sugerencias", () => {
    expect(cargaSourceModes(suggestions(false, true))).toEqual(["files", "platform", "monitoring"]);
  });

  it("ofrece la revisión consentida aunque el snapshot todavía esté vacío", () => {
    expect(cargaSourceModes(suggestions(true, false))).toEqual(["files", "platform", "monitoring"]);
  });

  it("conserva los tres orígenes cuando hay públicos disponibles", () => {
    expect(cargaSourceModes(suggestions(true, true))).toEqual([
      "files",
      "platform",
      "monitoring",
    ]);
  });

  it("solo ofrece el handoff general para perfiles telefónico o territorial", () => {
    const source = fs.readFileSync(
      path.join(__dirname, "pestanas", "PanelMonitoreoCarga.tsx"),
      "utf8",
    );
    const callout = source.indexOf("<FieldWorkHandoffCallout");
    expect(callout).toBeGreaterThan(-1);
    const guard = source.slice(Math.max(0, callout - 360), callout);

    expect(guard).toMatch(/perfil\s*===\s*"telefonico"/u);
    expect(guard).toMatch(/perfil\s*===\s*"territorial"/u);
    expect(guard).not.toMatch(/perfil\s*!==\s*"multi_actor"/u);
  });
});
