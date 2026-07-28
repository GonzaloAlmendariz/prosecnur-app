import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const telefonicoDir = path.dirname(fileURLToPath(import.meta.url));
const css = fs.readFileSync(path.join(telefonicoDir, "telefonicoProfile.css"), "utf8");
const page = fs.readFileSync(path.join(telefonicoDir, "TelefonicoMonitoreoPage.tsx"), "utf8");

function ruleBodies(selector: string): string[] {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return Array.from(css.matchAll(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`, "g")), (match) => match[1]);
}

describe("Telefónico: geometría del workbench", () => {
  test("declara una fila para cabecera, claridad y superficie de contenido", () => {
    const bodies = ruleBodies(
      ".mon-profile-canonical-shell.is-telefonico-profile .mon-workbench.is-acreditacion .mon-workbench-main",
    );

    expect(bodies.some((body) => (
      /grid-template-rows:\s*auto\s+auto\s+minmax\(0,\s*1fr\);/.test(body)
    ))).toBe(true);
  });

  test("conserva la capacidad libre dentro del panel visible y permite crecer", () => {
    const bodies = ruleBodies(".is-telefonico-profile .mon-phone-panel.is-standalone-phone");

    expect(bodies.some((body) => (
      /height:\s*max-content;/.test(body)
      && /flex:\s*1\s+0\s+auto;/.test(body)
    ))).toBe(true);
  });

  test("el resumen telefónico tiene un solo dueño de scroll vertical", () => {
    const parallelBodies = ruleBodies(
      ".is-telefonico-profile .mon-phone-advance-grid > .mon-phone-advance-parallel",
    );
    const statusBodies = ruleBodies(".is-telefonico-profile .mon-phone-advance-status-list");

    expect(parallelBodies.some((body) => /overflow:\s*hidden;/.test(body))).toBe(true);
    expect(statusBodies.some((body) => (
      /height:\s*auto;/.test(body)
      && /overflow:\s*auto;/.test(body)
    ))).toBe(true);
  });

  test("en escritorio conserva tres columnas explícitas sin auto-fit ni solapamiento", () => {
    const bodies = ruleBodies(
      ".is-telefonico-profile .mon-phone-advance-summary .mon-phone-advance-grid",
    );

    expect(bodies.some((body) => (
      /grid-template-columns:\s*minmax\(360px,\s*1fr\)\s+minmax\(330px,\s*0\.78fr\)\s+minmax\(300px,\s*0\.64fr\);/.test(body)
      && /grid-template-areas:\s*"daily daily daily"\s*"storage context focus";/.test(body)
      && /overflow:\s*hidden;/.test(body)
    ))).toBe(true);
  });

  test("en compacto delega el scroll al workbench y deja crecer el resumen", () => {
    const bodies = ruleBodies(".is-telefonico-profile .mon-phone-advance-summary");

    expect(bodies.some((body) => (
      /flex:\s*0\s+0\s+auto;/.test(body)
      && /height:\s*max-content;/.test(body)
      && /grid-template-rows:\s*auto;/.test(body)
      && /overflow:\s*visible;/.test(body)
    ))).toBe(true);
  });

  test("los estados vacíos ocupan la capacidad completa de su región", () => {
    const bodies = ruleBodies(
      ".is-telefonico-profile .mon-phone-advance-status-list > .is-muted:only-child",
    );

    expect(bodies.some((body) => /grid-column:\s*1\s*\/\s*-1;/.test(body))).toBe(true);
  });

  test("cada categoría de cuota separa descripción y avance sin recortar sus extremos", () => {
    const rowBodies = ruleBodies(
      ".is-telefonico-profile .mon-phone-quota-gap-board article",
    );
    const copyBodies = ruleBodies(
      ".is-telefonico-profile .mon-phone-quota-gap-board article span",
    );
    const barBodies = ruleBodies(
      ".is-telefonico-profile .mon-phone-quota-gap-board article > i",
    );
    const rateBodies = ruleBodies(
      ".is-telefonico-profile .mon-phone-quota-gap-board article > small",
    );

    expect(rowBodies.some((body) => (
      /grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto;/.test(body)
      && /grid-template-areas:\s*"copy copy"\s*"bar rate";/.test(body)
    ))).toBe(true);
    expect(copyBodies.some((body) => /grid-area:\s*copy;/.test(body))).toBe(true);
    expect(barBodies.some((body) => /grid-area:\s*bar;/.test(body))).toBe(true);
    expect(rateBodies.some((body) => /grid-area:\s*rate;/.test(body))).toBe(true);
  });

  test("el cronograma reserva ancho para la métrica diaria completa", () => {
    const bodies = ruleBodies(
      ".is-telefonico-profile .mon-field-schedule-evidence-days article",
    );

    expect(bodies.some((body) => (
      /grid-template-columns:\s*minmax\(132px,\s*0\.22fr\)\s+minmax\(160px,\s*1fr\)\s+minmax\(240px,\s*0\.34fr\);/.test(body)
      && /min-height:\s*58px;/.test(body)
    ))).toBe(true);
  });

  test("en compacto prioriza las cinco decisiones sin inflar el alto del gobernador", () => {
    const governorBodies = ruleBodies(
      ".is-telefonico-profile .mon-phone-quota-governor",
    );
    const pathBodies = ruleBodies(
      ".is-telefonico-profile .mon-phone-quota-decision-path",
    );
    const connectorBodies = ruleBodies(
      ".is-telefonico-profile .mon-phone-quota-decision-path > i",
    );
    const explanationBodies = ruleBodies(
      ".is-telefonico-profile .mon-phone-quota-governor-main p",
    );

    expect(governorBodies.some((body) => (
      /grid-template-columns:\s*minmax\(230px,\s*0\.56fr\)\s+minmax\(0,\s*1\.44fr\);/.test(body)
    ))).toBe(true);
    expect(pathBodies.some((body) => (
      /display:\s*grid;/.test(body)
      && /grid-template-columns:\s*repeat\(5,\s*minmax\(0,\s*1fr\)\);/.test(body)
    ))).toBe(true);
    expect(connectorBodies.some((body) => /display:\s*none;/.test(body))).toBe(true);
    expect(explanationBodies.some((body) => /display:\s*none;/.test(body))).toBe(true);
  });

  test("en compacto el paquete conserva completas sus tres fuentes", () => {
    const bodies = ruleBodies(
      ".is-telefonico-profile .mon-phone-source-tab.is-package .mon-phone-source-contract-grid",
    );

    expect(bodies.some((body) => (
      /grid-template-columns:\s*minmax\(0,\s*1fr\);/.test(body)
    ))).toBe(true);
  });

  test("en Paquete reserva celdas iguales y muestra completos sus valores operativos", () => {
    const cells = ruleBodies(
      ".is-telefonico-profile .mon-phone-source-tab.is-package .mon-phone-source-slot-data span",
    );
    const values = ruleBodies(
      ".is-telefonico-profile .mon-phone-source-tab.is-package .mon-phone-source-slot-data :is(strong, a)",
    );

    expect(cells.some((body) => (
      /min-height:\s*54px;/.test(body)
      && /grid-template-rows:\s*auto\s+minmax\(0,\s*1fr\);/.test(body)
      && /align-content:\s*start;/.test(body)
    ))).toBe(true);
    expect(values.some((body) => (
      /overflow:\s*visible;/.test(body)
      && /text-overflow:\s*clip;/.test(body)
      && /white-space:\s*normal;/.test(body)
      && /overflow-wrap:\s*anywhere;/.test(body)
    ))).toBe(true);
  });

  test("en Actores conserva el reparto ancho del resumen sin perder el apilado compacto", () => {
    const bodies = ruleBodies(".is-telefonico-profile .mon-phone-quota-rhythm-row");

    expect(bodies.some((body) => (
      /grid-template-columns:\s*minmax\(300px,\s*0\.28fr\)\s+minmax\(0,\s*1fr\);/.test(body)
    ))).toBe(true);
    expect(bodies.some((body) => (
      /grid-template-columns:\s*minmax\(0,\s*1fr\);/.test(body)
    ))).toBe(true);
    expect(css).not.toMatch(
      /\.is-telefonico-profile \.mon-phone-quota-rhythm-row\s*,[^{}]*\{[^}]*grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(260px,\s*1fr\)\);/s,
    );
  });

  test("en Sin efectiva la cardinalidad vive dentro de una divulgación y no cambia el marco", () => {
    expect(page).toContain('<div className="mon-phone-noanswer-cases">');
    expect(page).toContain('<details className="mon-phone-noanswer-disclosure">');
    expect(page).toContain('<summary className="mon-phone-noanswer-summary">');
    expect(page).not.toMatch(
      /\{row\.noAnswerCases\.length\s*\?\s*\(\s*<div className="mon-phone-noanswer-cases">/s,
    );
  });

  test("en Consultas compactas mantiene tres métricas y ordena los filtros en dos filas", () => {
    const summaryBodies = ruleBodies(".is-telefonico-profile .mon-phone-consulted-summary");
    const filtersBodies = ruleBodies(".is-telefonico-profile .mon-phone-consulted-filters");
    const searchBodies = ruleBodies(
      ".is-telefonico-profile .mon-phone-consulted-filters .mon-acr-base-search-pill",
    );
    const selectBodies = ruleBodies(
      ".is-telefonico-profile .mon-phone-consulted-filters .mon-acr-base-filter-pill",
    );
    const clearBodies = ruleBodies(
      ".is-telefonico-profile .mon-phone-consulted-filters .mon-acr-base-clear-pill",
    );

    expect(summaryBodies.some((body) => (
      /grid-template-columns:\s*minmax\(0,\s*1fr\);/.test(body)
    ))).toBe(false);
    expect(css).not.toMatch(
      /\.is-telefonico-profile \.mon-phone-consulted-summary\s*,\s*\.is-telefonico-profile \.mon-phone-consulted-filters\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\);/s,
    );
    expect(filtersBodies.some((body) => (
      /display:\s*grid;/.test(body)
      && /grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)\s+auto;/.test(body)
    ))).toBe(true);
    expect(searchBodies.some((body) => (
      /grid-column:\s*1\s*\/\s*-2;/.test(body)
      && /grid-row:\s*1;/.test(body)
    ))).toBe(true);
    expect(selectBodies.some((body) => (
      /grid-row:\s*2;/.test(body)
      && /min-width:\s*0;/.test(body)
      && /min-height:\s*42px;/.test(body)
      && /grid-template-columns:\s*minmax\(0,\s*1fr\);/.test(body)
    ))).toBe(true);
    const compactSelectBodies = ruleBodies(
      ".is-telefonico-profile .mon-phone-consulted-filters .mon-acr-base-filter-pill select",
    );
    expect(compactSelectBodies.some((body) => /width:\s*100%;/.test(body))).toBe(true);
    expect(clearBodies.some((body) => (
      /grid-column:\s*-2\s*\/\s*-1;/.test(body)
      && /grid-row:\s*1;/.test(body)
    ))).toBe(true);
  });

  test("en Cruces reserva tarjetas iguales y muestra completa la explicación operativa", () => {
    const cards = ruleBodies(
      ".is-telefonico-profile .mon-phone-crossing-summary span",
    );
    const details = ruleBodies(
      ".is-telefonico-profile .mon-phone-crossing-summary small",
    );

    expect(cards.some((body) => (
      /min-height:\s*52px;/.test(body)
      && /grid-template-rows:\s*auto\s+minmax\(0,\s*1fr\);/.test(body)
      && /align-content:\s*start;/.test(body)
    ))).toBe(true);
    expect(details.some((body) => (
      /overflow:\s*visible;/.test(body)
      && /text-overflow:\s*clip;/.test(body)
      && /white-space:\s*normal;/.test(body)
      && /overflow-wrap:\s*anywhere;/.test(body)
    ))).toBe(true);
    expect(details.every((body) => !/display:\s*none;/.test(body))).toBe(true);
  });
});
