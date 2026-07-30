import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const modeloDir = path.dirname(fileURLToPath(import.meta.url));
const css = fs.readFileSync(path.join(modeloDir, "modeloOperativo.css"), "utf8");
const page = fs.readFileSync(path.join(modeloDir, "..", "AcreditacionMonitoreoPage.tsx"), "utf8");

function between(source: string, start: string, end: string): string {
  const startAt = source.indexOf(start);
  const endAt = source.indexOf(end, startAt + start.length);
  if (startAt < 0 || endAt < 0) return "";
  return source.slice(startAt, endAt);
}

function ruleBody(selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return css.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`))?.[1] ?? "";
}

const actorCard = between(
  page,
  "function AcreditacionModelActorSummaryCard(",
  "type PlatformRejectionRuleDraft",
);
const workbench = between(
  page,
  "function AcreditacionCanonicalModelWorkbench(",
  "function AcreditacionFieldSchedulePanel(",
);

describe("Acreditación > Modelo operativo", () => {
  test("aísla el pulido de estructura frente a Teléfono y las otras pestañas", () => {
    expect(page).toContain('import "./modelo/modeloOperativo.css"');
    expect(workbench).toContain('activeVisibleTab === "estructura" && !isPhoneModel ? " is-accreditation-structure" : ""');
    expect(css).toContain(".mon-stage--acr-model.is-accreditation-structure");
    expect(css).not.toMatch(/(^|\n)\.mon-acr-model-/);
  });

  test("declara igualdad para el resumen, las tarjetas y cada flujo", () => {
    expect(workbench).toMatch(
      /data-qa-geometry-group=\{activeVisibleTab === "estructura" && !isPhoneModel \? "acreditacion-model-summary" : undefined\}[\s\S]*?data-qa-geometry-contract=\{activeVisibleTab === "estructura" && !isPhoneModel \? "equal" : undefined\}/,
    );
    expect(workbench).toContain('data-qa-geometry-group={cards.length ? "acreditacion-model-actors" : undefined}');
    expect(actorCard).toContain('data-qa-geometry-group={`acreditacion-model-flow-${card.id}`}');
    expect(actorCard).toContain('data-qa-geometry-contract="equal"');
  });

  test("usa dos resúmenes de ancho completo y cuatro actores estables en el roster", () => {
    const summary = ruleBody(".mon-stage--acr-model.is-accreditation-structure .mon-acr-model-map");
    const roster = ruleBody(".mon-stage--acr-model.is-accreditation-structure .mon-acr-model-roster__items");
    const rosterItem = ruleBody(".mon-stage--acr-model.is-accreditation-structure .mon-acr-model-roster__items > span");

    expect(summary).toMatch(/grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/);
    expect(summary).toMatch(/grid-auto-rows:\s*1fr;/);
    expect(roster).toMatch(/grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\);/);
    expect(roster).toMatch(/grid-auto-rows:\s*58px;/);
    expect(rosterItem).toMatch(/height:\s*100%;/);
    expect(css).toMatch(/\.mon-acr-model-roster__items strong[\s\S]*?white-space:\s*normal;/);
  });

  test("da capacidad útil a las tarjetas sin ocultar el último mecanismo", () => {
    const grid = ruleBody(".mon-stage--acr-model.is-accreditation-structure .mon-acr-model-actor-grid");
    const card = ruleBody(".mon-stage--acr-model.is-accreditation-structure .mon-acr-model-actor");
    const sources = ruleBody(".mon-stage--acr-model.is-accreditation-structure .mon-acr-model-source-list");

    expect(grid).toMatch(/grid-auto-rows:\s*352px;/);
    expect(card).toMatch(/height:\s*100%;/);
    expect(card).toMatch(/grid-template-rows:\s*auto\s+auto\s+auto\s+auto\s+minmax\(92px,\s*1fr\);/);
    expect(sources).toMatch(/min-height:\s*92px;/);
    expect(sources).toMatch(/max-height:\s*184px;/);
    expect(sources).toMatch(/overflow:\s*auto;/);
    expect(actorCard).toMatch(/data-qa-geometry-capacity="owned"[\s\S]*?data-qa-geometry-content/);
  });

  test("usa lenguaje de tarea y cubre metas o fuentes ausentes", () => {
    expect(actorCard).not.toContain('"S/M"');
    expect(actorCard).toContain('"Pendiente"');
    expect(actorCard).toContain('"Guardar meta"');
    expect(actorCard).toContain("Sin fuentes vinculadas. Asígnalas en Fuentes.");
    expect(workbench).toContain('metaTotal ? fmt(metaTotal) : "Pendiente"');
    expect(workbench).not.toContain("Fuentes todavía no declara actores activos.");
  });

  test("consume tokens y evita sobreescrituras frágiles", () => {
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(css).not.toMatch(/rgba?\(/i);
    expect(css).not.toContain("!important");
    expect(css).toContain("var(--pulso-radius-card)");
    expect(css).toContain("var(--pulso-control-height-md)");
  });
});
