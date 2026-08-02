import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const radiografiaCss = readFileSync(new URL("../criteriosRadiografia.css", import.meta.url), "utf8");
const i18bCss = readFileSync(new URL("../criteriosI18b.css", import.meta.url), "utf8");

function ruleBody(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]+)\\}`));
  expect(match, `Falta la regla CSS ${selector}`).not.toBeNull();
  return match?.[1] ?? "";
}

describe("geometría de la radiografía por facultad", () => {
  it.each([
    [".cmv2-crc-gate", "var(--pulso-radius)"],
    [".cmv2-crc-faculty", "var(--pulso-radius-card)"],
    [".cmv2-crc-segment", "var(--pulso-radius)"],
    [".cmv2-crc-snapshot", "var(--pulso-radius)"],
  ])("mantiene %s como superficie rectangular", (selector, radius) => {
    const body = ruleBody(radiografiaCss, selector);
    expect(body).toContain(`border-radius: ${radius}`);
    expect(body).not.toContain("var(--pulso-radius-chip)");
  });

  it.each([
    ".cmv2-i18b-boxplot",
    ".cmv2-i18b-anchor",
    ".cmv2-i18b-cascade-head",
    ".cmv2-i18b-cascade-state",
    ".cmv2-i18b-cascade-steps > li",
  ])("no convierte %s en una elipse de 999px", (selector) => {
    expect(ruleBody(i18bCss, selector)).not.toContain("var(--pulso-radius-chip)");
  });
});
