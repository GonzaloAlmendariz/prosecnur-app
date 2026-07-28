import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const profilesDir = path.dirname(fileURLToPath(import.meta.url));
const css = fs.readFileSync(path.join(profilesDir, "profilePage.css"), "utf8");
const sharedChrome = css.slice(css.indexOf("/* Shared profile chrome standard v2. */"));

function ruleBodies(selector: string): string[] {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return Array.from(
    sharedChrome.matchAll(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`, "g")),
    (match) => match[1],
  );
}

describe("Encabezados internos de panel: jerarquia compartida", () => {
  test("el encabezado no se materializa como una segunda tarjeta", () => {
    const materialGroup = sharedChrome.slice(
      sharedChrome.indexOf(":where("),
      sharedChrome.indexOf(") {", sharedChrome.indexOf(":where(")),
    );

    expect(materialGroup).not.toContain(".mon-profile-panel-head");
    expect(sharedChrome).not.toMatch(
      /@supports[\s\S]*?:where\([\s\S]*?\.mon-profile-panel-head,[\s\S]*?\)\s*\{/,
    );
  });

  test("conserva un marco estable mediante espacio y separador, no otra superficie", () => {
    const bodies = ruleBodies(".mon-profile-panel > .mon-profile-panel-head");

    expect(bodies.some((body) => (
      /min-height:\s*36px;/.test(body)
      && /border:\s*0;/.test(body)
      && /border-bottom:\s*1px\s+solid/.test(body)
      && /border-radius:\s*0;/.test(body)
      && /background:\s*transparent;/.test(body)
      && /box-shadow:\s*none;/.test(body)
      && /padding:\s*2px\s+1px\s+7px;/.test(body)
    ))).toBe(true);
  });

  test("mantiene un alto compacto explícito sin recuperar la caja ornamental", () => {
    const bodies = ruleBodies(".mon-profile-panel > .mon-profile-panel-head");

    expect(bodies.some((body) => (
      /min-height:\s*32px;/.test(body)
      && /padding:\s*1px\s+1px\s+6px;/.test(body)
    ))).toBe(true);
  });
});
