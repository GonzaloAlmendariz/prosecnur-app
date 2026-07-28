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

function cssRule(styles: string, selector: string): string {
  const start = styles.indexOf(`${selector} {`);
  expect(start).toBeGreaterThan(-1);
  const end = styles.indexOf("}", start);
  expect(end).toBeGreaterThan(start);
  return styles.slice(start, end + 1);
}

describe("cargaSourceModes", () => {
  it("mantiene el selector como radiogroup y delega el teclado al roving compartido", () => {
    const source = fs.readFileSync(
      path.join(__dirname, "CargaPage.tsx"),
      "utf8",
    );
    const anchor = source.indexOf('aria-label="Origen de carga"');
    const selector = source.slice(
      source.lastIndexOf("<GlidingTabList", anchor),
      source.indexOf("</GlidingTabList>", anchor),
    );

    expect(selector).toContain('role="radiogroup"');
    expect(selector).toContain('mode="tabs"');
    expect(selector).toContain("onRovingKeyChange=");
    expect(selector).toContain('role="radio"');
    expect(selector).toContain("aria-checked=");
    expect(selector).not.toContain('role="tablist"');
    expect(selector).not.toContain('role="tab"');
    expect(selector).not.toContain("aria-selected=");
  });

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
      path.join(__dirname, "CargaPage.tsx"),
      "utf8",
    );
    const callout = source.indexOf("<FieldWorkHandoffCallout");
    expect(callout).toBeGreaterThan(-1);
    const guard = source.slice(Math.max(0, callout - 360), callout);

    expect(guard).toMatch(/monitoringProfile\s*===\s*"telefonico"/u);
    expect(guard).toMatch(/monitoringProfile\s*===\s*"territorial"/u);
    expect(guard).not.toMatch(/monitoringProfile\s*!==\s*"multi_actor"/u);
  });

  it("preserva las etiquetas de origen y la estrategia bloqueada sin estirarlas", () => {
    const pageSource = fs.readFileSync(path.join(__dirname, "CargaPage.tsx"), "utf8");
    const styles = fs.readFileSync(path.join(__dirname, "carga-sources.css"), "utf8");

    expect(pageSource).toContain('import "./carga-sources.css";');
    expect(cssRule(styles, ".pulso-carga-origin-tabs.pulso-compact-tabs .pulso-compact-tab"))
      .toMatch(/flex-basis:\s*auto/u);
    expect(cssRule(styles, ".pulso-carga-origin-tabs .pulso-carga-tab-label"))
      .toMatch(/max-width:\s*126px[\s\S]*opacity:\s*1[\s\S]*overflow:\s*visible[\s\S]*transform:\s*none/u);

    const locked = cssRule(styles, ".pulso-multi-strategy.is-locked");
    expect(locked).toMatch(/align-self:\s*start/u);
    expect(locked).toMatch(/width:\s*fit-content/u);
    expect(locked).toMatch(/height:\s*auto/u);
    expect(locked).not.toMatch(/width:\s*100%/u);
    expect(cssRule(styles, ".pulso-multi-strategy.is-locked .pulso-multi-strategy-label"))
      .toMatch(/max-width:\s*none[\s\S]*opacity:\s*1[\s\S]*overflow:\s*visible[\s\S]*transform:\s*none/u);
  });
});
