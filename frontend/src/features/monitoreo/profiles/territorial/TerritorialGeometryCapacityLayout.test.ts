import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const territorialDir = path.dirname(fileURLToPath(import.meta.url));
const css = fs.readFileSync(path.join(territorialDir, "..", "..", "monitoreo.css"), "utf8");
const profileCss = fs.readFileSync(path.join(territorialDir, "territorialProfile.css"), "utf8");

function ruleBody(selector: string, source = css): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return source.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`))?.[1] ?? "";
}

function mediaRuleBodies(maxWidth: number, selector: string, source = css): string[] {
  const marker = `@media (max-width: ${maxWidth}px)`;
  const bodies: string[] = [];
  let start = source.indexOf(marker);
  while (start >= 0) {
    const nextMedia = source.indexOf("@media ", start + marker.length);
    const section = source.slice(start, nextMedia < 0 ? undefined : nextMedia);
    const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    bodies.push(...Array.from(
      section.matchAll(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`, "g")),
      (match) => match[1] ?? "",
    ));
    start = source.indexOf(marker, start + marker.length);
  }
  return bodies;
}

describe("Territorial: geometría por capacidad", () => {
  test("da viewport propio a tabla y ficha cuando Modelo se apila", () => {
    const sidebar = mediaRuleBodies(1120, ".mon-page .mon-territorial-route-table-workspace .mon-territorial-route-sidebar", profileCss);
    const cards = mediaRuleBodies(1120, ".mon-page .mon-territorial-route-table-workspace .mon-territorial-route-context-card", profileCss);
    const scrollOwners = mediaRuleBodies(1120, ".mon-page .mon-territorial-route-table-workspace .mon-territorial-route-context-body", profileCss);

    expect(sidebar.some((body) => /grid-template-rows:\s*var\(--mon-route-table-compact-h\)\s+var\(--mon-route-context-compact-h\);/.test(body))).toBe(true);
    expect(cards.some((body) => /height:\s*100%;/.test(body) && /overflow:\s*hidden;/.test(body))).toBe(true);
    expect(scrollOwners.some((body) => /height:\s*100%;/.test(body) && /overflow:\s*auto;/.test(body))).toBe(true);
    expect(profileCss).toContain(".mon-territorial-route-table-scroll,\n  .mon-page .mon-territorial-route-table-workspace .mon-territorial-route-context-body");
  });

  test("iguala el par lateral de Fuentes/Filtro y libera el alto al apilar", () => {
    const desktop = ruleBody(".mon-territorial-source-workgrid--filter");
    const desktopCards = ruleBody(
      ".mon-territorial-source-workgrid--filter > .mon-territorial-source-card:not(.mon-territorial-filter-config-summary)",
    );
    const stacked = mediaRuleBodies(1180, ".mon-territorial-source-workgrid--filter");
    const stackedCards = mediaRuleBodies(
      1180,
      ".mon-territorial-source-workgrid--filter > .mon-territorial-source-card:not(.mon-territorial-filter-config-summary)",
    );

    expect(desktop).toMatch(/align-items:\s*stretch;/);
    expect(desktopCards).toMatch(/align-self:\s*stretch;/);
    expect(stacked.some((body) => (
      /grid-template-columns:\s*1fr;/.test(body) && /align-items:\s*start;/.test(body)
    ))).toBe(true);
    expect(stackedCards.some((body) => /align-self:\s*start;/.test(body))).toBe(true);
  });

  test("mantiene una capacidad compacta común para filas de distrito", () => {
    const compactRows = mediaRuleBodies(1420, ".mon-field-occurrences-district-row");
    const compactDescriptions = mediaRuleBodies(1420, ".mon-field-occurrences-district-name span");
    const districtCanvas = ruleBody(".mon-stage--ocurrencias .mon-field-occurrences-overview.is-distritos");

    expect(compactRows.some((body) => /height:\s*256px;/.test(body))).toBe(true);
    expect(compactDescriptions.some((body) => (
      /-webkit-line-clamp:\s*2;/.test(body) && /overflow:\s*hidden;/.test(body)
    ))).toBe(true);
    expect(districtCanvas).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\);/);
    expect(districtCanvas).toMatch(/grid-template-areas:\s*"districts";/);
  });
});
