import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const modeloDir = path.dirname(fileURLToPath(import.meta.url));
const css = fs.readFileSync(path.join(modeloDir, "modeloOperativo.css"), "utf8");
const distributionCss = fs.readFileSync(path.join(modeloDir, "distribucionPorActor.css"), "utf8");
const distributionPage = fs.readFileSync(path.join(modeloDir, "DistribucionPorActor.tsx"), "utf8");
const page = fs.readFileSync(path.join(modeloDir, "..", "AcreditacionMonitoreoPage.tsx"), "utf8");

function between(source: string, start: string, end: string): string {
  const startAt = source.indexOf(start);
  const endAt = source.indexOf(end, startAt + start.length);
  if (startAt < 0 || endAt < 0) return "";
  return source.slice(startAt, endAt);
}

function ruleBody(selector: string, source = css): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return source.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`))?.[1] ?? "";
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

describe("Acreditación > Modelo operativo > Distribución", () => {
  test("mide las tarjetas con un contrato intrínseco y no la cabecera", () => {
    expect(distributionPage).not.toContain('className="mon-dist" data-qa-geometry-group');
    expect(distributionPage).toContain('className="mon-dist-grid" data-qa-geometry-group="acreditacion-distribucion-actores" data-qa-geometry-contract="intrinsic"');
    expect(distributionPage.match(/data-qa-geometry-member/g)).toHaveLength(2);
  });

  test("deja el scroll de actores al panel y posee solo la lista de categorías", () => {
    expect(ruleBody(".mon-dist", distributionCss)).toMatch(/grid-template-rows:\s*auto\s+auto;/);
    expect(ruleBody(".mon-dist-grid", distributionCss)).toMatch(/overflow:\s*visible;/);
    expect(ruleBody(".mon-dist-grid", distributionCss)).not.toMatch(/overflow-y:\s*auto;/);
    expect(distributionPage).toMatch(/<ul data-qa-geometry-capacity="owned" data-qa-geometry-content>/);
  });

  test("equilibra cuatro actores y permite leer nombres operativos completos", () => {
    expect(distributionCss).toMatch(/@media \(max-width:\s*1180px\)[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/);
    expect(ruleBody(".mon-dist-etiqueta", distributionCss)).toMatch(/white-space:\s*normal;/);
    expect(ruleBody(".mon-dist-declarada-head strong", distributionCss)).toMatch(/overflow-wrap:\s*anywhere;/);
    expect(distributionCss).not.toMatch(/text-overflow:\s*ellipsis;/);
  });

  test("aplana la variable declarada y usa la escala de materia", () => {
    const declared = ruleBody(".mon-dist-declarada", distributionCss);
    expect(declared).toMatch(/border:\s*0;/);
    expect(declared).toMatch(/border-radius:\s*0;/);
    expect(declared).toMatch(/background:\s*transparent;/);
    expect(ruleBody(".mon-dist-actor", distributionCss)).toMatch(/border-radius:\s*var\(--pulso-radius-card\);/);
    expect(distributionCss).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|!important/i);
  });

  test("alinea resumen, encabezado y vacíos con la tarea", () => {
    expect(page).toContain('pestanaActiva === "distribucion" ? [');
    expect(page).toContain('{ label: "Variables", value: fmt(interestVariables.length)');
    expect(workbench).toContain('activeVisibleTab !== "distribucion" ? <div className="mon-acr-model-map"');
    expect(distributionPage).toContain("Variables para abrir el detalle de cada actor");
    expect(distributionPage).not.toContain("<span>Distribución</span>");
    expect(distributionPage).toContain("No hay columnas elegibles");
    expect(distributionPage).not.toContain("No quedan columnas por declarar");
  });
});
