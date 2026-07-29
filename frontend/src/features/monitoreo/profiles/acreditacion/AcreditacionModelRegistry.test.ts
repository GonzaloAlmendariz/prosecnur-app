import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import type { MonitoreoSource } from "../../../../api/client";
import {
  ACREDITACION_PHONE_TABS,
  buildAcreditacionSourceActorRoster,
  hasAcreditacionPhoneSourceActors,
  shouldShowAcreditacionPhoneEmptyState,
} from "./AcreditacionMonitoreoPage";

const acreditacionDir = path.dirname(fileURLToPath(import.meta.url));
const profileCss = fs.readFileSync(path.join(acreditacionDir, "..", "profilePage.css"), "utf8");
const pageSource = fs.readFileSync(path.join(acreditacionDir, "AcreditacionMonitoreoPage.tsx"), "utf8");

function source(
  id: string,
  actor: string,
  canal: string,
  enabled = true,
): MonitoreoSource {
  return {
    id,
    kind: "surveymonkey",
    label: `Fuente ${id}`,
    enabled,
    role: "respuestas",
    dimensions: { actor, canal },
  };
}

describe("Acreditación: Fuentes gobierna actores y canales", () => {
  test("deduplica el roster, conserva el nombre declarado y cuenta sus fuentes", () => {
    const roster = buildAcreditacionSourceActorRoster([
      source("est-qr", "Estudiantes", "Ficha QR"),
      source("egr-tel", "Egresados", "Telefónico"),
      source("egr-web", "Egresados", "Correo"),
      source("adm-web", "Administrativos", "Correo"),
      source("doc-web", "Docentes", "Enlace"),
    ]);

    expect(roster).toEqual([
      { actor: "Estudiantes", sourceCount: 1, phoneEnabled: false },
      { actor: "Egresados", sourceCount: 2, phoneEnabled: true },
      { actor: "Administrativos", sourceCount: 1, phoneEnabled: false },
      { actor: "Docentes", sourceCount: 1, phoneEnabled: false },
    ]);
  });

  test("ignora fuentes inactivas, actores vacíos y apariencias telefónicas", () => {
    const sources = [
      source("disabled", "Egresados", "Telefónico", false),
      source("empty", "", "Telefónico"),
      { ...source("label-only", "Docentes", "Correo"), label: "Encuesta telefónica Docentes" },
    ];

    expect(buildAcreditacionSourceActorRoster(sources)).toEqual([
      { actor: "Docentes", sourceCount: 1, phoneEnabled: false },
    ]);
    expect(hasAcreditacionPhoneSourceActors(sources)).toBe(false);
  });

  test("el estado vacío se aplica igual a todas las pestañas y no al modo autónomo", () => {
    const withoutPhone = [source("doc", "Docentes", "Correo")];
    const withPhone = [...withoutPhone, source("egr", "Egresados", "Telefonico")];

    // 7 desde que existe «Estados»: confirmar los estados de la base de
    // barrido es parte de Teléfono, no un ajuste escondido. Lo que este
    // contrato protege es que el estado vacío se aplique a TODAS por igual,
    // no cuántas hay.
    expect(ACREDITACION_PHONE_TABS.length).toBeGreaterThanOrEqual(6);
    expect(ACREDITACION_PHONE_TABS.every(() => shouldShowAcreditacionPhoneEmptyState(false, withoutPhone))).toBe(true);
    expect(shouldShowAcreditacionPhoneEmptyState(false, withPhone)).toBe(false);
    expect(shouldShowAcreditacionPhoneEmptyState(true, withoutPhone)).toBe(false);
  });

  test("Modelo no duplica el editor de actores que pertenece a Fuentes", () => {
    expect(pageSource).toContain("Actores definidos en Fuentes");
    expect(pageSource).not.toContain("Guardar actores");
    expect(pageSource).not.toContain("Nuevo actor");
    expect(pageSource).not.toContain("Participa en Teléfono");
  });
});

describe("Acreditación Modelo: geometría repetible", () => {
  test("tarjetas y roster usan filas iguales con capacidad interna acotada", () => {
    const gridRule = profileCss.match(/\.mon-profile-canonical-shell \.mon-acr-model-actor-grid\s*\{([^}]*)\}/)?.[1] ?? "";
    const cardRule = profileCss.match(/\.mon-profile-canonical-shell \.mon-acr-model-actor\s*\{([^}]*)\}/)?.[1] ?? "";
    const listRules = Array.from(
      profileCss.matchAll(/\.mon-profile-canonical-shell \.mon-acr-model-source-list\s*\{([^}]*)\}/g),
      (match) => match[1],
    ).join("\n");
    const rosterItems = profileCss.match(/\.mon-acr-model-roster__items\s*\{([^}]*)\}/)?.[1] ?? "";
    const rosterItem = profileCss.match(/\.mon-acr-model-roster__items\s*>\s*span\s*\{([^}]*)\}/)?.[1] ?? "";

    expect(gridRule).toMatch(/grid-auto-rows:\s*304px;/);
    expect(gridRule).toMatch(/align-items:\s*stretch;/);
    expect(cardRule).toMatch(/height:\s*100%;/);
    expect(cardRule).toMatch(/grid-template-rows:\s*auto\s+auto\s+auto\s+auto\s+minmax\(76px,\s*1fr\);/);
    expect(listRules).toMatch(/min-height:\s*76px;/);
    expect(listRules).toMatch(/max-height:\s*160px;/);
    expect(listRules).toMatch(/overflow:\s*auto;/);
    expect(rosterItems).toMatch(/grid-auto-rows:\s*46px;/);
    expect(rosterItem).toMatch(/height:\s*100%;/);
  });
});
