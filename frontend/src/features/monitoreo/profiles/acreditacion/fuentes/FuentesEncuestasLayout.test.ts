import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const fuentesDir = path.dirname(fileURLToPath(import.meta.url));
const css = fs.readFileSync(path.join(fuentesDir, "fuentes.css"), "utf8");
const page = fs.readFileSync(path.join(fuentesDir, "..", "AcreditacionMonitoreoPage.tsx"), "utf8");

function between(source: string, start: string, end: string): string {
  const startAt = source.indexOf(start);
  const endAt = source.indexOf(end, startAt + start.length);
  if (startAt < 0 || endAt < 0) return "";
  return source.slice(startAt, endAt);
}

function ruleBody(selector: string, source: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return source.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`))?.[1] ?? "";
}

const platformView = between(
  page,
  "function AcreditacionPlatformSurveySourcesView(",
  "function collectorConfigFromRow(",
);
const collectorsView = between(
  page,
  "function AcreditacionCollectorsSourceView(",
  "function AcreditacionActiveSourcesView(",
);
const encuestasCss = between(
  css,
  "/* ══ Encuestas y recopiladores",
  "/* ══ Fin Encuestas y recopiladores",
);

describe("Fuentes > Encuestas y recopiladores", () => {
  test("aísla el pulido en una raíz propia", () => {
    expect(page).toContain('className="mon-profile-stack fuentes-encuestas-stack"');
    expect(encuestasCss).not.toBe("");
    expect(encuestasCss).toContain(".fuentes-encuestas-stack .mon-acr-object-surface");
  });

  test("declara cuatro colecciones condicionales y sus miembros", () => {
    expect(platformView).toMatch(
      /className="mon-acr-survey-declaration-list"[\s\S]*?data-qa-geometry-group="fuentes-encuestas-actores"[\s\S]*?data-qa-geometry-contract="equal"/,
    );
    expect(platformView).toMatch(
      /className="mon-acr-survey-card-grid"[\s\S]*?data-qa-geometry-group=\{platformSources\.length \? "fuentes-encuestas-tarjetas" : undefined\}[\s\S]*?data-qa-geometry-contract=\{platformSources\.length \? "equal" : undefined\}/,
    );
    expect(collectorsView).toMatch(
      /className="mon-acr-collector-picker"[\s\S]*?data-qa-geometry-group=\{surveySources\.length \? "fuentes-encuestas-selector" : undefined\}[\s\S]*?data-qa-geometry-contract=\{surveySources\.length \? "equal" : undefined\}/,
    );
    expect(collectorsView).toMatch(
      /className="mon-acr-collector-list"[\s\S]*?data-qa-geometry-group=\{collectorRows\.length \? "fuentes-encuestas-recopiladores" : undefined\}[\s\S]*?data-qa-geometry-contract=\{collectorRows\.length \? "equal" : undefined\}/,
    );
    expect(platformView.match(/data-qa-geometry-member/g)).toHaveLength(2);
    expect(collectorsView.match(/data-qa-geometry-member/g)).toHaveLength(2);
  });

  test("pone la capacidad en la lista interna de cada actor", () => {
    expect(platformView).toMatch(
      /className="mon-acr-survey-declaration-surveys"[\s\S]*?data-qa-geometry-capacity="owned"[\s\S]*?data-qa-geometry-content/,
    );
  });

  test("mantiene cuatro columnas estiradas y filas equivalentes", () => {
    const coverage = ruleBody(
      ".fuentes-encuestas-stack .mon-acr-survey-declaration-list",
      encuestasCss,
    );
    const actorCard = ruleBody(
      ".fuentes-encuestas-stack .mon-acr-survey-declaration-list article",
      encuestasCss,
    );

    expect(coverage).toMatch(/grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\);/);
    expect(coverage).toMatch(/grid-auto-rows:\s*1fr;/);
    expect(coverage).toMatch(/align-items:\s*stretch;/);
    expect(actorCard).toMatch(/height:\s*100%;/);
    expect(actorCard).toMatch(/grid-template-rows:\s*auto\s+minmax\(0,\s*1fr\);/);
    expect(encuestasCss).toMatch(
      /\.mon-acr-survey-card-grid,[\s\S]*?\.mon-acr-collector-picker,[\s\S]*?\.mon-acr-collector-list[\s\S]*?grid-auto-rows:\s*1fr;/,
    );
    expect(encuestasCss).toMatch(
      /\.mon-acr-source-object-card,[\s\S]*?\.mon-acr-collector-picker button,[\s\S]*?\.mon-acr-collector-row[\s\S]*?height:\s*100%;/,
    );
  });

  test("envuelve nombres operativos y aplana las tres cifras de encuesta", () => {
    expect(encuestasCss).toMatch(/\.mon-acr-collector-picker button strong,/);
    expect(encuestasCss).toMatch(/\.mon-collector-title strong,/);
    expect(encuestasCss).toMatch(/white-space:\s*normal;/);
    expect(encuestasCss).toMatch(/overflow-wrap:\s*anywhere;/);
    expect(encuestasCss).not.toMatch(/text-overflow:\s*ellipsis;/);

    const metric = ruleBody(
      ".fuentes-encuestas-stack .mon-acr-source-object-metrics span",
      encuestasCss,
    );
    expect(metric).toMatch(/border:\s*0;/);
    expect(metric).toMatch(/border-radius:\s*0;/);
    expect(metric).toMatch(/background:\s*transparent;/);
  });

  test("usa lenguaje de tarea y elimina duplicados del switch", () => {
    expect(platformView).not.toMatch(/const (?:surveySources|koboSources)\s*=/);
    expect(platformView).toContain("Conecta una fuente de respuestas y asigna la encuesta al actor correspondiente.");
    expect(platformView).not.toContain("Guardando declaracion");
    expect(platformView).not.toContain("quedo declarada");

    expect(collectorsView).toContain("Conecta una fuente de respuestas para elegir la encuesta.");
    expect(collectorsView).not.toMatch(/Sin metadata|metadata real|\bIDs\b|persistidos/);
    expect(collectorsView).not.toContain('row.enabled ? "Cuenta" : "No cuenta"');
    expect(collectorsView).not.toContain("sourceExternalId(source)");
    expect(collectorsView).toContain("se usarán en Avance");
  });

  test("no introduce colores sueltos ni sobreescrituras forzadas", () => {
    expect(encuestasCss).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(encuestasCss).not.toContain("!important");
  });
});
