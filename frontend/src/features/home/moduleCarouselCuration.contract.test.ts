import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const featureDir = path.dirname(fileURLToPath(import.meta.url));

describe("curaduría de módulos en el selector", () => {
  it("es aditiva y deja la acción de quitar en el homepage", () => {
    const carousel = fs.readFileSync(path.join(featureDir, "ModuleCarousel.tsx"), "utf8");
    const homeCard = fs.readFileSync(path.join(featureDir, "ModuleStatusCard.tsx"), "utf8");

    expect(carousel).not.toContain("onRemove");
    expect(carousel).not.toContain("Quitar del proyecto");
    expect(homeCard).toContain("Quitar del proyecto");
    expect(homeCard).toContain("home-confirm-remove");
  });

  it("usa un rail de solo logos en una fila y resalta la pertenencia", () => {
    const carousel = fs.readFileSync(path.join(featureDir, "ModuleCarousel.tsx"), "utf8");
    const css = fs.readFileSync(path.join(featureDir, "home-v2.css"), "utf8");
    const strip = carousel.match(
      /<div className="home-cinema-strip"[\s\S]*?<\/div>/,
    )?.[0] ?? "";
    const stripRule = css.match(/^\.home-cinema-strip\s*\{([^}]*)\}/m)?.[1] ?? "";
    const addedRule = css.match(/\.home-cinema-dot\.is-added\s*\{([^}]*)\}/)?.[1] ?? "";

    expect(strip).toContain("<Icon");
    expect(strip).not.toContain("mod.shortLabel}</span>");
    expect(strip).not.toContain("home-cinema-dot-status");
    expect(stripRule).toMatch(/flex-wrap:\s*nowrap/);
    expect(addedRule).toMatch(/background:/);
    expect(addedRule).toMatch(/border-color:/);
  });

  it("centra el conjunto y adapta su respiración a la altura disponible", () => {
    const css = fs.readFileSync(path.join(featureDir, "home-v2.css"), "utf8");
    const pickerRules = [
      ...css.matchAll(/^\.home-picker-stage \.home-cinema\s*\{([^}]*)\}/gm),
    ];
    const pickerRule = pickerRules.at(-1)?.[1] ?? "";
    const stripRule = css.match(/^\.home-cinema-strip\s*\{([^}]*)\}/m)?.[1] ?? "";

    expect(pickerRule).toMatch(/height:\s*min\(780px,\s*100%\)/);
    expect(pickerRule).toMatch(/max-height:\s*780px/);
    expect(pickerRule).toMatch(/gap:\s*clamp\(14px,\s*1\.8vh,\s*20px\)/);
    expect(stripRule).toMatch(/gap:\s*clamp\(10px,\s*1vw,\s*14px\)/);
    expect(css).toMatch(
      /@media \(max-height: 720px\)[\s\S]*?\.home-picker-overlay \.home-cinema \.home-cinema-card\s*\{\s*top:\s*50%/,
    );
  });
});
