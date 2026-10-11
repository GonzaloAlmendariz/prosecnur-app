import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

/**
 * **L24 / D4 — el marco del vacío es de la superficie.**
 *
 * `EmptyState` tenía una variante `panel` que no dibujaba panel: el nombre
 * prometía un marco que nunca existió y las features lo compensaban cada una a
 * su modo. La variante se renombró a `en-superficie` (no dibuja marco: se lo da
 * la superficie que lo contiene). El nombre viejo queda como alias — en la
 * prop TS (`variant="panel"`, deprecado) y en la clase CSS
 * `.pulso-empty-state--panel`, que EmptyState sigue emitiendo — para no migrar
 * los ~125 usos en una sola tanda.
 *
 * RATCHET: los usos del nombre viejo por archivo solo pueden BAJAR. Al migrar
 * uno, se baja el conteo aquí (y si llega a cero, se borra la entrada).
 *
 * Además: el skeleton del kit nunca publica `data-audit-ready` (trampa
 * «Readiness ≠ render» del GOAL).
 */

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** `variant="panel"` dentro de un `<EmptyState …>`, a 2026-10-11. Solo baja. */
const SNAPSHOT_PROP_PANEL: Record<string, number> = {
  "features/analitica/panes/PanelBasePane.tsx": 1,
};

/** Selectores CSS `.pulso-empty-state--panel` fuera del kit, a 2026-10-11. Solo baja. */
const SNAPSHOT_CSS_PANEL: Record<string, number> = {
  "features/bitacora/logbook/logbook.css": 1,
  "features/calcMuestra/universidad/calculo/calculo.css": 4,
};

/** Donde el alias se define: no son consumidores. */
const KIT = new Set(["components/states.css", "components/States.tsx"]);

function archivos(dir: string, ext: RegExp): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const completo = path.join(dir, e.name);
    if (e.isDirectory()) return archivos(completo, ext);
    return ext.test(e.name) && !/\.test\./.test(e.name) ? [completo] : [];
  });
}

function rel(f: string) {
  return path.relative(SRC, f).split(path.sep).join("/");
}

/** Apertura completa de cada `<EmptyState …>`: respeta llaves (`icon={<X />}`). */
function aperturas(fuente: string): string[] {
  const out: string[] = [];
  let desde = 0;
  for (;;) {
    const i = fuente.indexOf("<EmptyState", desde);
    if (i < 0) return out;
    let prof = 0;
    let j = i + 1;
    for (; j < fuente.length; j += 1) {
      const c = fuente[j];
      if (c === "{") prof += 1;
      else if (c === "}") prof -= 1;
      else if (c === ">" && prof === 0) break;
    }
    out.push(fuente.slice(i, j + 1));
    desde = j + 1;
  }
}

/** Cuenta `variant="panel"` dentro de la apertura de cada `<EmptyState`. */
function contarPropPanel(fuente: string): number {
  return aperturas(fuente).filter((tag) =>
    /\bvariant\s*=\s*(?:"panel"|\{\s*["']panel["']\s*\})/.test(tag),
  ).length;
}

describe("D4 — el nombre viejo de la variante del vacío no crece", () => {
  test("detector: reconoce la prop vieja y no confunde la nueva", () => {
    expect(contarPropPanel('<EmptyState variant="panel" icon={<X />} title="a" />')).toBe(1);
    expect(contarPropPanel("<EmptyState\n  icon={<X />}\n  variant={'panel'}\n  title=\"a\"\n/>")).toBe(1);
    expect(contarPropPanel('<EmptyState variant="en-superficie" icon={<X />} title="a" />')).toBe(0);
    expect(contarPropPanel('<EmptyState icon={<X />} title="a" />')).toBe(0);
  });

  test("`variant=\"panel\"` solo baja", () => {
    const actual: Record<string, number> = {};
    for (const f of archivos(SRC, /\.tsx$/)) {
      const n = contarPropPanel(readFileSync(f, "utf8"));
      if (n > 0) actual[rel(f)] = n;
    }
    for (const [archivo, n] of Object.entries(actual)) {
      expect(
        n,
        `${archivo} usa variant="panel" ${n} vez/veces; usa variant="en-superficie" (D4)`,
      ).toBeLessThanOrEqual(SNAPSHOT_PROP_PANEL[archivo] ?? 0);
    }
  });

  test("`.pulso-empty-state--panel` en CSS de feature solo baja", () => {
    const actual: Record<string, number> = {};
    for (const f of archivos(SRC, /\.css$/)) {
      const r = rel(f);
      if (KIT.has(r)) continue;
      const n = (readFileSync(f, "utf8").match(/\.pulso-empty-state--panel\b/g) ?? []).length;
      if (n > 0) actual[r] = n;
    }
    for (const [archivo, n] of Object.entries(actual)) {
      expect(
        n,
        `${archivo} selecciona .pulso-empty-state--panel ${n} vez/veces; usa --en-superficie (D4)`,
      ).toBeLessThanOrEqual(SNAPSHOT_CSS_PANEL[archivo] ?? 0);
    }
  });

  test("ningún TS/TSX escribe la clase vieja a mano", () => {
    const culpables = archivos(SRC, /\.tsx?$/)
      .filter((f) => !KIT.has(rel(f)))
      .filter((f) => readFileSync(f, "utf8").includes("pulso-empty-state--panel"))
      .map(rel);
    expect(culpables).toEqual([]);
  });

  test("el kit define el alias junto al nombre nuevo", () => {
    const css = readFileSync(path.join(SRC, "components/states.css"), "utf8");
    expect(css).toMatch(/\.pulso-empty-state--en-superficie,\s*\.pulso-empty-state--panel\s*\{/);
  });
});

describe("Skeleton — no declara readiness", () => {
  test("ni el componente ni su hoja mencionan data-audit-ready como atributo", () => {
    const tsx = readFileSync(path.join(SRC, "components/Skeleton.tsx"), "utf8");
    // El JSDoc lo nombra para prohibirlo; lo que no puede haber es un atributo JSX.
    expect(tsx).not.toMatch(/data-audit-ready\s*=/);
    expect(tsx).not.toMatch(/["']data-audit-ready["']\s*:/);
  });

  test("el shimmer usa tokens de movimiento y se apaga con reduced-motion", () => {
    const css = readFileSync(path.join(SRC, "components/kit-skeleton.css"), "utf8");
    const reglas = css.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(css).toMatch(/--pulso-skeleton-shimmer-dur:\s*calc\(var\(--motion-dur-panel\)\s*\*\s*5\)/);
    expect(reglas).not.toMatch(/\d(?:ms|s)\b/);
    expect(reglas).not.toMatch(/cubic-bezier/);
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.pulso-skeleton::after\s*\{[^}]*animation:\s*none/,
    );
  });
});
