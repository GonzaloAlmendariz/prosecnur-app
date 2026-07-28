import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const acreditacionDir = path.dirname(fileURLToPath(import.meta.url));
const css = fs.readFileSync(path.join(acreditacionDir, "..", "profilePage.css"), "utf8");
const page = fs.readFileSync(path.join(acreditacionDir, "AcreditacionMonitoreoPage.tsx"), "utf8");
const acreditacionShell = ".mon-profile-canonical-shell.is-acreditacion-profile";

function ruleBody(selector: string, source = css): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return source.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`))?.[1] ?? "";
}

function ruleBodies(selector: string, source = css): string[] {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return Array.from(
    source.matchAll(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`, "g")),
    (match) => match[1],
  );
}

function mediaRuleBody(maxWidth: number, selector: string): string {
  const marker = `@media (max-width: ${maxWidth}px)`;
  let start = css.indexOf(marker);

  while (start >= 0) {
    const nextMedia = css.indexOf("@media ", start + marker.length);
    const section = css.slice(start, nextMedia < 0 ? undefined : nextMedia);
    const body = ruleBody(selector, section);
    if (body) return body;
    start = css.indexOf(marker, start + marker.length);
  }

  return "";
}

function mediaRangeRuleBody(minWidth: number, maxWidth: number, selector: string): string {
  const marker = "@media (min-width: " + minWidth + "px) and (max-width: " + maxWidth + "px)";
  const start = css.indexOf(marker);
  if (start < 0) return "";
  const nextMedia = css.indexOf("@media ", start + marker.length);
  return ruleBody(selector, css.slice(start, nextMedia < 0 ? undefined : nextMedia));
}

function minMediaRuleBody(minWidth: number, selector: string): string {
  const marker = `@media (min-width: ${minWidth}px)`;
  const start = css.indexOf(marker);
  if (start < 0) return "";
  const nextMedia = css.indexOf("@media ", start + marker.length);
  return ruleBody(selector, css.slice(start, nextMedia < 0 ? undefined : nextMedia));
}

describe("Acreditacion fuentes activas: geometria de superficies", () => {
  test("mantiene Actores, Recopiladores y Sheets como tres marcos de capacidad equivalente", () => {
    const desktopGrid = ruleBody(".mon-acr-active-grid");
    const surfaces = ruleBody(".mon-acr-active-grid > .mon-acr-object-surface");
    const contentLists = ruleBody(
      ".mon-acr-active-grid > .mon-acr-object-surface > :is(.mon-acr-active-source-list, .mon-acr-active-actor-list)",
    );

    expect(desktopGrid).toMatch(/grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\);/);
    expect(desktopGrid).toMatch(/align-items:\s*stretch;/);
    expect(desktopGrid).toMatch(/--mon-acr-active-surface-height:\s*clamp\(/);
    expect(surfaces).toMatch(/height:\s*var\(--mon-acr-active-surface-height\);/);
    expect(surfaces).toMatch(/grid-template-rows:\s*auto\s+minmax\(0,\s*1fr\);/);
    expect(contentLists).toMatch(/min-height:\s*0;/);
    expect(contentLists).toMatch(/overflow-y:\s*auto;/);
  });

  test("no hace que Actores abarque las filas de Recopiladores y Sheets", () => {
    const actorSurface = ruleBody(".mon-acr-active-grid > .mon-acr-object-surface:first-child");

    expect(actorSurface).not.toMatch(/grid-row\s*:/);
  });

  test("conserva tres columnas iguales en el rango intermedio y apila bajo 980px", () => {
    const intermediateGrid = mediaRuleBody(1320, ".mon-acr-active-grid");
    const compactGrid = mediaRuleBody(980, ".mon-acr-active-grid");

    if (intermediateGrid) {
      expect(intermediateGrid).toMatch(
        /grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\);/,
      );
      expect(intermediateGrid).toMatch(/align-items:\s*stretch;/);
    }
    expect(compactGrid).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\);/);
  });

  test("reserva dos líneas legibles en tarjetas repetidas sin variar su alto", () => {
    const cards = ruleBody(
      ".mon-acr-active-sources :is(.mon-acr-active-source-list, .mon-acr-active-actor-list) article",
    );
    const titles = ruleBody(
      ".mon-acr-active-sources :is(.mon-acr-active-source-list, .mon-acr-active-actor-list) article strong",
    );

    expect(cards).toMatch(/height:\s*64px;/);
    expect(titles).toMatch(/display:\s*-webkit-box;/);
    expect(titles).toMatch(/-webkit-line-clamp:\s*2;/);
    expect(titles).toMatch(/white-space:\s*normal;/);
  });

  test("en el rango compacto libera el ancho del título sin variar entre filas", () => {
    const cards = mediaRangeRuleBody(
      981,
      1200,
      ".mon-acr-active-sources :is(.mon-acr-active-source-list, .mon-acr-active-actor-list) article",
    );
    const metadata = mediaRangeRuleBody(
      981,
      1200,
      ".mon-acr-active-sources :is(.mon-acr-active-source-list, .mon-acr-active-actor-list) article span",
    );

    expect(cards).toMatch(/height:\s*84px;/);
    expect(cards).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\);/);
    expect(cards).toMatch(/grid-template-areas:\s*"title"\s*"meta"\s*"detail";/);
    expect(metadata).toMatch(/justify-self:\s*start;/);
  });

  test("da a los cuatro KPI el mismo marco y separa etiqueta de valor sin truncarlos entre sí", () => {
    const kpiGrid = ruleBody(".mon-acr-active-kpis");
    const kpiCards = ruleBody(
      ".mon-acr-active-sources .mon-acr-active-kpis .mon-profile-stat",
    );

    expect(kpiGrid).toMatch(/grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(140px,\s*1fr\)\);/);
    expect(kpiCards).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\);/);
    expect(kpiCards).toMatch(/grid-template-rows:\s*auto\s+auto;/);
    expect(kpiCards).toMatch(/align-content:\s*center;/);
  });
});

describe("Acreditacion modelo: marcos estables por actor", () => {
  test("iguala las filas repetidas y estira cada tarjeta dentro de su marco", () => {
    const actorGrid = ruleBody(".mon-profile-canonical-shell .mon-acr-model-actor-grid");
    const actorCard = ruleBody(".mon-profile-canonical-shell .mon-acr-model-actor");

    expect(actorGrid).toMatch(/grid-auto-rows:\s*304px;/);
    expect(actorGrid).not.toMatch(/grid-auto-rows:\s*(?:max-content|1fr|minmax\(0,\s*1fr\));/);
    expect(actorGrid).toMatch(/align-items:\s*stretch;/);
    expect(actorCard).toMatch(/align-self:\s*stretch;/);
    expect(actorCard).toMatch(/height:\s*100%;/);
    expect(actorCard).toMatch(/grid-template-rows:\s*auto\s+auto\s+auto\s+auto\s+minmax\(76px,\s*1fr\);/);
  });

  test("conserva la cardinalidad dentro de una lista acotada y desplazable", () => {
    const sourceList = ruleBodies(".mon-profile-canonical-shell .mon-acr-model-source-list").join("\n");

    expect(sourceList).toMatch(/min-height:\s*76px;/);
    expect(sourceList).toMatch(/max-height:\s*160px;/);
    expect(sourceList).toMatch(/overflow:\s*auto;/);
  });

  test("declara el grupo par y la capacidad interna para que el QA mida las cuatro tarjetas", () => {
    expect(page).toContain('data-qa-geometry-group={cards.length ? "acreditacion-model-actors" : undefined}');
    expect(page).toContain('data-qa-geometry-contract={cards.length ? "equal" : undefined}');
    expect(page).toMatch(/<article\s+className=\{`mon-acr-model-actor[^>]+data-qa-geometry-member>/);
    expect(page).toMatch(/className="mon-acr-model-source-list"[^>]+data-qa-geometry-capacity="owned"[^>]+data-qa-geometry-content/);
  });
});

describe("Acreditacion telefono: pareja superior del resumen", () => {
  test("declara una raiz propia para no aplicar el pulido de Acreditacion al perfil Telefonico", () => {
    expect(page).toContain('className="mon-profile-canonical-shell is-acreditacion-profile"');
  });

  test("declara el par superior sin atribuir al panel exterior la capacidad de Cuotas", () => {
    const overviewTag = page.match(/<section\s+className="mon-phone-overview-grid"[^>]*>/)?.[0] ?? "";
    const storageMemberTags = Array.from(
      page.matchAll(/<div\s+className="mon-phone-storage(?: mon-phone-storage--statuses)?"[^>]*data-qa-geometry-member[^>]*>/g),
      (match) => match[0],
    );
    const emptyQuotaBlock = page.match(/if\s*\(!quotaRows\.length\)\s*\{([\s\S]*?)\n\s*\}/)?.[1] ?? "";
    const emptyQuotaTag = emptyQuotaBlock.match(/<section\s+className="mon-phone-quota-panel is-empty"[^>]*>/)?.[0] ?? "";
    const expandedQuotaTag = page.match(/<section\s+className=\{[^>]*mon-phone-quota-panel[^>]*is-expanded[^>]*>/)?.[0] ?? "";

    expect(overviewTag).toMatch(
      /data-qa-geometry-group=\{[^}]*\?\s*["']acreditacion-phone-summary-top["']\s*:\s*undefined\}/,
    );
    expect(overviewTag).toMatch(
      /data-qa-geometry-contract=\{[^}]*\?\s*["']equal["']\s*:\s*undefined\}/,
    );
    expect(storageMemberTags).toHaveLength(2);
    expect(emptyQuotaTag).not.toContain('data-qa-geometry-capacity="owned"');
    expect(expandedQuotaTag).not.toContain('data-qa-geometry-capacity="owned"');
    expect(expandedQuotaTag).toMatch(/expanded[^>]*is-expanded|is-expanded[^>]*expanded/);
    expect(emptyQuotaBlock).toMatch(
      /<(?:div|section|article)\s+[^>]*data-qa-geometry-capacity="owned"[^>]*>\s*<EmptyPanel/,
    );
  });

  test("inicializa el detalle una sola vez y conserva un toggle accesible", () => {
    expect(page).toMatch(
      /const\s+\[expanded,\s*setExpanded\]\s*=\s*useState\(\(\)\s*=>\s*shouldStartPhoneQuotaExpanded\([^)]*\)\);/,
    );
    expect(page).toMatch(/aria-expanded=\{expanded\}/);
    expect(page).toMatch(/aria-controls=\{detailId\}/);
    expect(page).toMatch(/onClick=\{\(\)\s*=>\s*setExpanded\(\(value\)\s*=>\s*!value\)\}/);
    expect(page).not.toMatch(/addEventListener\(["']resize["'][\s\S]{0,500}setExpanded/);
  });

  test("estira los dos marcos de la fila sin estirar sus filas internas", () => {
    const overview = ruleBody(`${acreditacionShell} .mon-phone-overview-grid`);
    const storage = ruleBody(".mon-phone-storage");

    expect(overview).toMatch(/align-items:\s*stretch;/);
    expect(storage).toMatch(/align-content:\s*start;/);
  });

  test("en escritorio distribuye la capacidad del panel de barrido entre cuatro tarjetas", () => {
    const storageSelector = `${acreditacionShell} .mon-phone-overview-grid > .mon-phone-storage:not(.mon-phone-storage--statuses)`;
    const flowSelector = `${acreditacionShell} .mon-phone-overview-grid > .mon-phone-storage:not(.mon-phone-storage--statuses) .mon-phone-flow`;
    const cardSelector = `${flowSelector} span`;
    const storage = minMediaRuleBody(1181, storageSelector);
    const flow = minMediaRuleBody(1181, flowSelector);
    const cards = minMediaRuleBody(1181, cardSelector);

    expect(storage).toMatch(/grid-template-rows:\s*auto\s+auto\s+minmax\(0,\s*1fr\)\s+auto;/);
    expect(storage).toMatch(/align-content:\s*stretch;/);
    expect(flow).toMatch(/grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/);
    expect(flow).toMatch(/grid-template-rows:\s*repeat\(2,\s*minmax\(64px,\s*1fr\)\);/);
    expect(flow).toMatch(/align-self:\s*stretch;/);
    expect(cards).toMatch(/height:\s*100%;/);
    expect(cards).toMatch(/align-content:\s*center;/);
  });

  test("en compacto conserva el alto intrinseco del barrido y de sus tarjetas", () => {
    const storageSelector = `${acreditacionShell} .mon-phone-overview-grid > .mon-phone-storage:not(.mon-phone-storage--statuses)`;
    const flowSelector = `${acreditacionShell} .mon-phone-overview-grid > .mon-phone-storage:not(.mon-phone-storage--statuses) .mon-phone-flow`;
    const compactStorage = mediaRuleBody(1180, storageSelector);
    const compactFlow = mediaRuleBody(1180, flowSelector);

    expect(compactStorage).not.toMatch(/grid-template-rows:[^;]*minmax\(0,\s*1fr\)/);
    expect(compactStorage).not.toMatch(/height:\s*100%;/);
    expect(compactFlow).not.toMatch(/grid-template-rows:\s*repeat\(2,\s*minmax\(64px,\s*1fr\)\);/);
    expect(compactFlow).not.toMatch(/height:\s*100%;/);
  });

  test("asigna el remanente amplio al contenido visible de Cuotas", () => {
    const overview = minMediaRuleBody(1181, `${acreditacionShell} .mon-phone-overview-grid`);
    const quota = minMediaRuleBody(1181, `${acreditacionShell} .mon-phone-overview-grid > .mon-phone-quota-panel.is-expanded`);
    const detail = minMediaRuleBody(1181, `${acreditacionShell} .mon-phone-overview-grid > .mon-phone-quota-panel.is-expanded .mon-phone-quota-detail`);
    const grid = minMediaRuleBody(1181, `${acreditacionShell} .mon-phone-overview-grid > .mon-phone-quota-panel.is-expanded .mon-phone-quota-grid`);
    const actor = minMediaRuleBody(1181, `${acreditacionShell} .mon-phone-overview-grid > .mon-phone-quota-panel.is-expanded .mon-phone-quota-actor`);

    expect(overview).toMatch(/grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/);
    expect(overview).toMatch(/grid-template-rows:\s*auto\s+minmax\(max-content,\s*1fr\);/);
    expect(quota).toMatch(/grid-template-rows:\s*auto\s+auto\s+minmax\(0,\s*1fr\);/);
    expect(quota).toMatch(/height:\s*100%;/);
    expect(quota).toMatch(/align-content:\s*stretch;/);
    expect(detail).toMatch(/grid-template-rows:\s*auto\s+minmax\(0,\s*1fr\);/);
    expect(detail).toMatch(/min-height:\s*0;/);
    expect(grid).toMatch(/align-items:\s*stretch;/);
    expect(grid).toMatch(/grid-auto-rows:\s*minmax\(max-content,\s*1fr\);/);
    expect(actor).toMatch(/height:\s*100%;/);
    expect(actor).toMatch(/align-content:\s*start;/);
    expect(page).toMatch(
      /<article\s+key=\{group\.variable\}\s+className="mon-phone-quota-actor mon-phone-quota-variable"\s+data-qa-geometry-capacity="owned"/,
    );
  });

  test("conserva el vacio transparente global y restaura el marco solo en Acreditacion", () => {
    const standaloneEmpty = ruleBodies(".mon-phone-quota-panel.is-empty").at(-1) ?? "";
    const acreditacionEmpty = ruleBody(`${acreditacionShell} .mon-phone-quota-panel.is-empty`);

    expect(standaloneEmpty).toMatch(/padding:\s*0;/);
    expect(standaloneEmpty).toMatch(/background:\s*transparent;/);
    expect(standaloneEmpty).toMatch(/border:\s*0;/);
    expect(standaloneEmpty).toMatch(/box-shadow:\s*none;/);
    expect(acreditacionEmpty).toMatch(/padding:\s*(?!0(?:px)?\s*;)[^;]+;/);
    expect(acreditacionEmpty).toMatch(/background:\s*(?!transparent\s*;)[^;]+;/);
    expect(acreditacionEmpty).toMatch(/border:\s*(?!0(?:px)?\s*;)[^;]+;/);
  });

  test("acota todos los overrides amplios de Iter69 y 70 a la raiz de Acreditacion", () => {
    const marker = "@media (min-width: 1181px)";
    const start = css.indexOf(marker);
    const nextMedia = css.indexOf("@media ", start + marker.length);
    const wide = css.slice(start, nextMedia < 0 ? undefined : nextMedia);

    expect(start).toBeGreaterThanOrEqual(0);
    expect(wide).not.toMatch(/\.mon-profile-canonical-shell(?!\.is-acreditacion-profile)\s+\.mon-phone-overview-grid/);
    expect(wide).toContain(`${acreditacionShell} .mon-phone-overview-grid`);
    expect(wide).toContain(`${acreditacionShell} .mon-phone-overview-grid > .mon-phone-storage:not(.mon-phone-storage--statuses)`);
    expect(wide).toContain(`${acreditacionShell} .mon-phone-overview-grid > .mon-phone-quota-panel.is-expanded`);
    expect(wide).toContain(`${acreditacionShell} .mon-phone-overview-grid > .mon-phone-quota-panel.is-empty`);
  });

  test("en compacto libera el alto y los tracks expansivos de Cuotas", () => {
    const basePanel = ruleBody(".mon-phone-quota-panel");
    const baseDetail = ruleBodies(".mon-phone-quota-detail").at(-1) ?? "";
    const compactQuota = mediaRuleBody(1180, `${acreditacionShell} .mon-phone-overview-grid > .mon-phone-quota-panel.is-expanded`);
    const compactDetail = mediaRuleBody(1180, `${acreditacionShell} .mon-phone-overview-grid > .mon-phone-quota-panel.is-expanded .mon-phone-quota-detail`);

    expect(basePanel).not.toMatch(/height:\s*100%;/);
    expect(basePanel).not.toMatch(/grid-template-rows:/);
    expect(baseDetail).not.toMatch(/grid-template-rows:/);
    expect(compactQuota).not.toMatch(/height:\s*100%;/);
    expect(compactQuota).not.toMatch(/grid-template-rows:/);
    expect(compactDetail).not.toMatch(/grid-template-rows:/);
  });
});
