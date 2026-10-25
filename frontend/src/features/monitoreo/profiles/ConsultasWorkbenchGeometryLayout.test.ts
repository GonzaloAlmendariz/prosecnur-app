import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const profilesDir = path.dirname(fileURLToPath(import.meta.url));
const sharedCss = fs.readFileSync(path.join(profilesDir, "profilePage.css"), "utf8");
const phoneCss = fs.readFileSync(path.join(profilesDir, "telefonico", "telefonicoProfile.css"), "utf8");
const accreditationPage = fs.readFileSync(
  path.join(profilesDir, "acreditacion", "AcreditacionMonitoreoPage.tsx"),
  "utf8",
);
const phonePage = fs.readFileSync(
  path.join(profilesDir, "telefonico", "TelefonicoMonitoreoPage.tsx"),
  "utf8",
);

function ruleBodies(source: string, selector: string): string[] {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return Array.from(source.matchAll(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`, "g")), (match) => match[1]);
}

describe("Consultas: cada fila visible tiene un dueño", () => {
  test("la franja de contexto que las grillas cuentan permanece renderizada", () => {
    const bodies = ruleBodies(sharedCss, ".mon-clarity-strip.is-consultas");

    expect(bodies.length).toBeGreaterThan(0);
    expect(bodies.some((body) => /display:\s*grid;/.test(body))).toBe(true);
    expect(bodies.every((body) => !/display:\s*none;/.test(body))).toBe(true);
  });

  // Revamp (A1): Acreditación retiró la franja como Telefónico; sus filas son
  // la cabecera de pestaña y el contenido.
  test("Acreditacion entrega la fila flexible al contenido tras la cabecera", () => {
    const bodies = ruleBodies(
      sharedCss,
      ".mon-profile-canonical-shell .mon-workbench.is-acreditacion .mon-workbench-main",
    );

    expect(bodies.some((body) => (
      /grid-template-rows:\s*auto\s+minmax\(0,\s*1fr\);/.test(body)
    ))).toBe(true);
    expect(accreditationPage).not.toMatch(/clarity=\{/);
    // La cabecera ocupa la fila `auto` salvo cuando el rótulo de la pestaña va
    // en su primera tarjeta (§2a-bis): entonces no hay fila de cabecera.
    expect(accreditationPage).toMatch(/head=\{conRotuloEnTarjeta \? null : \(\s*<CabeceraAcreditacion/);
  });

  // Revamp de Monitoreo (2026-10-23): Telefónico retiró la franja de lectura;
  // sus filas son la cabecera de pestaña y el contenido, y la grilla lo dice.
  test("Telefonico declara cabecera y contenido como dos filas explicitas, sin franja", () => {
    const bodies = ruleBodies(
      phoneCss,
      ".mon-profile-canonical-shell.is-telefonico-profile .mon-workbench.is-acreditacion .mon-workbench-main",
    );

    expect(bodies.some((body) => (
      /grid-template-rows:\s*auto\s+minmax\(0,\s*1fr\);/.test(body)
    ))).toBe(true);
    expect(phonePage).not.toMatch(/clarity=\{/);
  });

  test("en escritorio bajo conserva una ventana de datos real dentro del scroll exterior", () => {
    const stageBodies = ruleBodies(
      sharedCss,
      ".mon-profile-canonical-shell .mon-stage--consultas",
    );
    const explorerBodies = ruleBodies(
      sharedCss,
      ".mon-profile-canonical-shell .mon-case-explorer",
    );
    const bodyBodies = ruleBodies(
      sharedCss,
      ".mon-profile-canonical-shell .mon-case-explorer-body",
    );

    expect(stageBodies.some((body) => (
      /height:\s*auto\s*!important;/.test(body)
      && /min-height:\s*max-content;/.test(body)
      && /overflow:\s*visible;/.test(body)
    ))).toBe(true);
    expect(explorerBodies.some((body) => (
      /grid-template-rows:\s*auto\s+auto\s+auto\s+260px;/.test(body)
      && /height:\s*auto;/.test(body)
      && /min-height:\s*max-content;/.test(body)
      && /overflow:\s*visible;/.test(body)
    ))).toBe(true);
    expect(bodyBodies.some((body) => (
      /height:\s*260px;/.test(body)
      && /min-height:\s*260px;/.test(body)
      && /overflow:\s*hidden;/.test(body)
    ))).toBe(true);
  });
});
